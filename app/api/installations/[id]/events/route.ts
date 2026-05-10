import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { createInstallationEventSchema } from "@/lib/validations"
import { getEventActivityAction, logActivity } from "@/lib/activity-log"
import { normalizeRefrigerantCode } from "@/lib/refrigerants"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const { companyId, userId } = auth.user
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
      },
      select: {
        id: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    const events = await prisma.installationEvent.findMany({
      where: {
        installationId: installation.id,
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    })

    return NextResponse.json(events, { status: 200 })
  } catch (error: unknown) {
    console.error("Get installation events error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const { companyId, userId } = auth.user
    const body = await request.json()
    const validatedData = createInstallationEventSchema.parse(body)
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
        scrappedAt: null,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
      },
      select: {
        id: true,
        inspectionIntervalMonths: true,
        refrigerantType: true,
        refrigerantAmount: true,
        hasLeakDetectionSystem: true,
        lastInspection: true,
        nextInspection: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    if (validatedData.type === "INSPECTION") {
      const result = await prisma.$transaction(async (tx) => {
        const createdBy = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            name: true,
            email: true,
          },
        })
        const event = await tx.installationEvent.create({
          data: {
            installationId: installation.id,
            date: validatedData.date,
            type: validatedData.type,
            refrigerantAddedKg: validatedData.refrigerantAddedKg,
            notes: emptyToNull(validatedData.notes),
            createdById: userId,
          },
          include: {
            createdBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })

        const nextInspection = calculateNextInspectionDate(
          validatedData.date,
          installation.inspectionIntervalMonths
        )
        await tx.inspection.create({
          data: {
            inspectionDate: validatedData.date,
            inspectorName:
              createdBy?.name || createdBy?.email || "Okänd användare",
            status: "Registrerad",
            notes: emptyToNull(validatedData.notes),
            nextDueDate: nextInspection,
            installationId: installation.id,
          },
        })
        const updatedInstallation = await tx.installation.update({
          where: {
            id: installation.id,
          },
          data: {
            lastInspection: validatedData.date,
            nextInspection,
          },
          select: {
            lastInspection: true,
            nextInspection: true,
          },
        })

        return {
          event,
          inspectionSchedule: {
            lastInspection: updatedInstallation.lastInspection,
            nextInspection: updatedInstallation.nextInspection,
          },
        }
      })

      await logActivity({
        companyId,
        installationId: installation.id,
        userId,
        action: getEventActivityAction(result.event.type),
        entityType: "event",
        entityId: result.event.id,
        metadata: {
          eventType: result.event.type,
          date: result.event.date.toISOString(),
        },
      })

      return NextResponse.json(result, { status: 201 })
    }

    if (validatedData.type === "REFRIGERANT_CHANGE") {
      const nextRefrigerantType =
        normalizeRefrigerantCode(validatedData.newRefrigerantType) ??
        validatedData.newRefrigerantType
      const previousRefrigerantType = installation.refrigerantType
      const recoveredRefrigerantKg = validatedData.recoveredRefrigerantKg
      const addedRefrigerantKg = validatedData.refrigerantAddedKg
      const changeNote = [
        `Byte av köldmedium från ${previousRefrigerantType} till ${nextRefrigerantType}.`,
        recoveredRefrigerantKg !== null
          ? `Omhändertagen mängd: ${recoveredRefrigerantKg} kg.`
          : null,
        addedRefrigerantKg !== null
          ? `Påfylld mängd nytt köldmedium: ${addedRefrigerantKg} kg.`
          : null,
        emptyToNull(validatedData.notes),
      ].filter(Boolean).join(" ")
      const nextCompliance = calculateInstallationCompliance(
        nextRefrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )
      const nextInspection = calculateNextInspectionDate(
        installation.lastInspection,
        nextCompliance.inspectionIntervalMonths
      )

      const result = await prisma.$transaction(async (tx) => {
        const event = await tx.installationEvent.create({
          data: {
            installationId: installation.id,
            date: validatedData.date,
            type: validatedData.type,
            refrigerantAddedKg: addedRefrigerantKg,
            notes: changeNote,
            createdById: userId,
          },
          include: {
            createdBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })

        const updatedInstallation = await tx.installation.update({
          where: {
            id: installation.id,
          },
          data: {
            refrigerantType: nextRefrigerantType,
            inspectionIntervalMonths: nextCompliance.inspectionIntervalMonths,
            nextInspection,
          },
          select: {
            lastInspection: true,
            nextInspection: true,
          },
        })

        return {
          event,
          inspectionSchedule: {
            lastInspection: updatedInstallation.lastInspection,
            nextInspection: updatedInstallation.nextInspection,
          },
        }
      })

      await logActivity({
        companyId,
        installationId: installation.id,
        userId,
        action: getEventActivityAction(result.event.type),
        entityType: "event",
        entityId: result.event.id,
        metadata: {
          eventType: result.event.type,
          date: result.event.date.toISOString(),
          previousRefrigerantType,
          newRefrigerantType: nextRefrigerantType,
          recoveredRefrigerantKg,
          refrigerantAddedKg: addedRefrigerantKg,
        },
      })

      return NextResponse.json(result, { status: 201 })
    }

    const event = await prisma.installationEvent.create({
      data: {
        installationId: installation.id,
        date: validatedData.date,
        type: validatedData.type,
        refrigerantAddedKg: validatedData.refrigerantAddedKg,
        notes: emptyToNull(validatedData.notes),
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    await logActivity({
      companyId,
      installationId: installation.id,
      userId,
      action: getEventActivityAction(event.type),
      entityType: "event",
      entityId: event.id,
      metadata: {
        eventType: event.type,
        date: event.date.toISOString(),
        refrigerantAddedKg: event.refrigerantAddedKg,
      },
    })

    return NextResponse.json(
      {
        event,
        inspectionSchedule: null,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create installation event error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function emptyToNull(value?: string) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}
