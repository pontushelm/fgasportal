import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  DUPLICATE_AGGREGAT_HISTORY_MESSAGE,
  getMaxImportRows,
  findImportPropertyMatch,
  isDuplicateEquipmentIdentity,
  normalizeImportRow,
  type ImportInstallationInput,
} from "@/lib/installation-import"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"

const importRequestSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number(),
      name: z.string().optional().default(""),
      equipmentId: z.string().nullable().optional(),
      location: z.string(),
      propertyName: z.string().nullable().optional(),
      municipality: z.string().nullable().optional(),
      refrigerantType: z.string(),
      refrigerantAmount: z.number().nullable(),
      lastInspection: z.string().nullable(),
      nextInspection: z.string().nullable().optional(),
      inspectionIntervalMonths: z.number().nullable(),
      hasLeakDetectionSystem: z.boolean().optional(),
      servicePartner: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      installationDate: z.string().nullable().optional(),
      serialNumber: z.string().nullable(),
      equipmentType: z.string().nullable().optional(),
      operatorName: z.string().nullable().optional(),
      notes: z.string().nullable(),
    })
  ).max(getMaxImportRows()),
})

type ImportError = {
  row: number
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { rows } = importRequestSchema.parse(body)
    const errors: ImportError[] = []
    let created = 0
    let skipped = 0
    const properties = await prisma.property.findMany({
      where: {
        companyId,
      },
      select: {
        id: true,
        name: true,
      },
    })

    for (const row of rows) {
      const parsed = normalizeImportRow(row as ImportInstallationInput, row.row)

      if (parsed.errors.length > 0 || parsed.refrigerantAmount === null) {
        skipped += 1
        errors.push({
          row: parsed.row,
          message: parsed.errors.join(", ") || "Invalid row",
        })
        continue
      }

      const propertyMatch = findImportPropertyMatch(parsed.propertyName, properties)
      const duplicate = parsed.equipmentId
        ? isDuplicateEquipmentIdentity({
            equipmentId: parsed.equipmentId,
            propertyId: propertyMatch?.id ?? null,
            propertyName: parsed.propertyName,
            existingInstallations: await prisma.installation.findMany({
              where: {
                companyId,
                archivedAt: null,
                equipmentId: parsed.equipmentId,
              },
              select: {
                equipmentId: true,
                propertyId: true,
                propertyName: true,
              },
            }),
          })
        : Boolean(
            await prisma.installation.findFirst({
              where: {
                companyId,
                archivedAt: null,
                name: parsed.name,
                location: parsed.location,
              },
              select: {
                id: true,
              },
            })
          )

      if (duplicate) {
        skipped += 1
        errors.push({
          row: parsed.row,
          message: parsed.equipmentId
            ? DUPLICATE_AGGREGAT_HISTORY_MESSAGE
            : "Duplicate installation with same name and location",
        })
        continue
      }

      const lastInspection = parsed.lastInspection
        ? new Date(parsed.lastInspection)
        : null
      const compliance = calculateInstallationCompliance(
        parsed.refrigerantType,
        parsed.refrigerantAmount,
        parsed.hasLeakDetectionSystem,
        lastInspection
      )
      const inspectionIntervalMonths =
        parsed.inspectionIntervalMonths ?? compliance.inspectionIntervalMonths
      const nextInspection = parsed.nextInspection
        ? new Date(parsed.nextInspection)
        : calculateNextInspectionDate(lastInspection, inspectionIntervalMonths)
      const installationDate = parsed.installationDate
        ? new Date(parsed.installationDate)
        : new Date()

      await prisma.installation.create({
        data: {
          name: parsed.name,
          location: parsed.location,
          equipmentId: parsed.equipmentId,
          propertyId: propertyMatch?.id ?? null,
          propertyName: parsed.propertyName,
          serialNumber: parsed.serialNumber,
          equipmentType: parsed.equipmentType,
          operatorName: parsed.operatorName,
          refrigerantType: parsed.refrigerantType,
          refrigerantAmount: parsed.refrigerantAmount,
          hasLeakDetectionSystem: parsed.hasLeakDetectionSystem,
          installationDate,
          lastInspection,
          inspectionIntervalMonths,
          nextInspection,
          notes: parsed.notes,
          companyId,
          createdById: userId,
          updatedById: userId,
        },
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
    console.error("Import installations error:", error)

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
