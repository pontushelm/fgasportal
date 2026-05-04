import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  getMaxImportRows,
  normalizeImportRow,
  type ImportInstallationInput,
} from "@/lib/installation-import"

const importRequestSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number(),
      name: z.string(),
      location: z.string(),
      refrigerantType: z.string(),
      refrigerantAmount: z.number().nullable(),
      lastInspection: z.string().nullable(),
      inspectionIntervalMonths: z.number().nullable(),
      serialNumber: z.string().nullable(),
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

      const duplicate = await prisma.installation.findFirst({
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

      if (duplicate) {
        skipped += 1
        errors.push({
          row: parsed.row,
          message: "Duplicate installation with same name and location",
        })
        continue
      }

      await prisma.installation.create({
        data: {
          name: parsed.name,
          location: parsed.location,
          serialNumber: parsed.serialNumber,
          refrigerantType: parsed.refrigerantType,
          refrigerantAmount: parsed.refrigerantAmount,
          installationDate: new Date(),
          lastInspection: parsed.lastInspection
            ? new Date(parsed.lastInspection)
            : null,
          inspectionIntervalMonths: parsed.inspectionIntervalMonths,
          nextInspection: parsed.nextInspection
            ? new Date(parsed.nextInspection)
            : null,
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
