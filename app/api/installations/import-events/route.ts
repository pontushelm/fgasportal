import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { getEventActivityAction, logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildEventImportPreview,
  eventImportRequestSchema,
  type EventImportPreviewRow,
} from "@/lib/installation-event-import"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { createInstallationEventSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { mode, rows } = eventImportRequestSchema.parse(body)
    const [properties, installations] = await Promise.all([
      prisma.property.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.installation.findMany({
        where: {
          companyId,
          archivedAt: null,
          scrappedAt: null,
          equipmentId: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          equipmentId: true,
          propertyId: true,
          propertyName: true,
          inspectionIntervalMonths: true,
          refrigerantType: true,
          refrigerantAmount: true,
          hasLeakDetectionSystem: true,
          lastInspection: true,
          nextInspection: true,
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ])
    const previewRows = buildEventImportPreview({
      rows,
      installations,
      properties,
    })

    if (mode === "preview") {
      return NextResponse.json(
        {
          rows: previewRows,
          summary: summarizePreview(previewRows),
        },
        { status: 200 }
      )
    }

    let created = 0
    let skipped = 0
    const errors: Array<{ row: number; message: string }> = []
    const installationsById = new Map(installations.map((installation) => [
      installation.id,
      installation,
    ]))

    for (const row of previewRows) {
      if (
        row.status === "blocked" ||
        !row.installationId ||
        !row.normalizedType ||
        !row.eventDate
      ) {
        skipped += 1
        errors.push({
          row: row.row,
          message: row.errors.join(", ") || "Raden kunde inte importeras",
        })
        continue
      }

      const installation = installationsById.get(row.installationId)
      if (!installation) {
        skipped += 1
        errors.push({
          row: row.row,
          message: "Aggregatet hittades inte",
        })
        continue
      }

      const amountForEvent =
        row.normalizedType === "LEAK" || row.normalizedType === "REFILL"
          ? row.amountKg
          : null
      const validation = createInstallationEventSchema.safeParse({
        date: row.eventDate,
        type: row.normalizedType,
        refrigerantAddedKg: amountForEvent === null ? "" : String(amountForEvent),
        notes: row.notes ?? "",
      })

      if (!validation.success) {
        skipped += 1
        errors.push({
          row: row.row,
          message: validation.error.issues.map((issue) => issue.message).join(", "),
        })
        continue
      }

      await createImportedEvent({
        companyId,
        userId,
        installation,
        event: validation.data,
      })
      created += 1
    }

    return NextResponse.json(
      {
        created,
        skipped,
        errors,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Import installation events error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Ogiltiga indata",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function summarizePreview(rows: EventImportPreviewRow[]) {
  return {
    total: rows.length,
    importable: rows.filter((row) => row.status !== "blocked").length,
    warnings: rows.filter((row) => row.status === "warning").length,
    blocked: rows.filter((row) => row.status === "blocked").length,
  }
}

async function createImportedEvent({
  companyId,
  event,
  installation,
  userId,
}: {
  companyId: string
  event: ReturnType<typeof createInstallationEventSchema.parse>
  installation: {
    id: string
    inspectionIntervalMonths: number | null
    refrigerantType: string
    refrigerantAmount: number
    hasLeakDetectionSystem: boolean
    lastInspection: Date | null
    nextInspection: Date | null
  }
  userId: string
}) {
  if (event.type === "INSPECTION") {
    const result = await prisma.$transaction(async (tx) => {
      const createdBy = await tx.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
        },
      })
      const importedEvent = await tx.installationEvent.create({
        data: {
          installationId: installation.id,
          date: event.date,
          type: event.type,
          refrigerantAddedKg: null,
          notes: emptyToNull(event.notes),
          createdById: userId,
        },
      })
      const nextInspection = calculateNextInspectionDate(
        event.date,
        installation.inspectionIntervalMonths
      )

      await tx.inspection.create({
        data: {
          inspectionDate: event.date,
          inspectorName:
            createdBy?.name || createdBy?.email || "Okänd användare",
          status: "Importerad",
          notes: emptyToNull(event.notes),
          nextDueDate: nextInspection,
          installationId: installation.id,
        },
      })
      await tx.installation.update({
        where: {
          id: installation.id,
        },
        data: {
          lastInspection: event.date,
          nextInspection,
        },
      })

      return importedEvent
    })

    await logImportedEventActivity({
      companyId,
      eventId: result.id,
      eventType: result.type,
      date: result.date,
      installationId: installation.id,
      userId,
    })
    return
  }

  const importedEvent = await prisma.installationEvent.create({
    data: {
      installationId: installation.id,
      date: event.date,
      type: event.type,
      refrigerantAddedKg: event.refrigerantAddedKg,
      notes: emptyToNull(event.notes),
      createdById: userId,
    },
  })

  await logImportedEventActivity({
    companyId,
    eventId: importedEvent.id,
    eventType: importedEvent.type,
    date: importedEvent.date,
    installationId: installation.id,
    refrigerantAddedKg: importedEvent.refrigerantAddedKg,
    userId,
  })
}

async function logImportedEventActivity({
  companyId,
  date,
  eventId,
  eventType,
  installationId,
  refrigerantAddedKg,
  userId,
}: {
  companyId: string
  date: Date
  eventId: string
  eventType: string
  installationId: string
  refrigerantAddedKg?: number | null
  userId: string
}) {
  await logActivity({
    companyId,
    installationId,
    userId,
    action: getEventActivityAction(eventType),
    entityType: "event",
    entityId: eventId,
    metadata: {
      eventType,
      date: date.toISOString(),
      refrigerantAddedKg,
      imported: true,
    },
  })
}

function emptyToNull(value?: string) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}
