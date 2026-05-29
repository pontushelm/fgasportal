import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  normalizePropertyDesignation,
  normalizePropertyImportRow,
} from "@/lib/property-import"

const propertyImportRequestSchema = z.object({
  rows: z.array(
    z.object({
      row: z.number(),
      propertyDesignation: z.string().nullable(),
      name: z.string().nullable().optional(),
      municipality: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      internalReference: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    })
  ),
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

    const body = await request.json()
    const { rows } = propertyImportRequestSchema.parse(body)
    const existingProperties = await prisma.property.findMany({
      where: {
        companyId: auth.user.companyId,
      },
      select: {
        propertyDesignation: true,
      },
    })
    const knownDesignations = new Set(
      existingProperties
        .map((property) => normalizePropertyDesignation(property.propertyDesignation))
        .filter(Boolean)
    )
    const errors: ImportError[] = []
    let created = 0
    let skippedDuplicates = 0
    let invalid = 0

    for (const row of rows) {
      const parsed = normalizePropertyImportRow(row, row.row)
      const normalizedDesignation = normalizePropertyDesignation(
        parsed.propertyDesignation
      )

      if (parsed.errors.length > 0 || !normalizedDesignation) {
        invalid += 1
        errors.push({
          row: parsed.row,
          message: parsed.errors.join(", ") || "Ogiltig rad",
        })
        continue
      }

      if (knownDesignations.has(normalizedDesignation)) {
        skippedDuplicates += 1
        errors.push({
          row: parsed.row,
          message: "Finns redan",
        })
        continue
      }

      await prisma.property.create({
        data: {
          companyId: auth.user.companyId,
          name: parsed.name ?? parsed.propertyDesignation ?? "Fastighet",
          propertyDesignation: parsed.propertyDesignation,
          municipality: parsed.municipality,
          city: parsed.city,
          address: parsed.address,
          postalCode: parsed.postalCode,
          internalReference: parsed.internalReference,
          description: parsed.description,
        },
      })

      knownDesignations.add(normalizedDesignation)
      created += 1
    }

    return NextResponse.json(
      {
        created,
        skippedDuplicates,
        invalid,
        errors,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Import properties error:", error)

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
