import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

const MAX_BULK_PROPERTIES = 500

const clearablePropertyFields = [
  "address",
  "postalCode",
  "city",
  "municipality",
  "propertyDesignation",
] as const

const bulkPropertySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("DELETE"),
    propertyIds: propertyIdsSchema(),
  }),
  z.object({
    action: z.literal("CLEAR_FIELDS"),
    fields: z.array(z.enum(clearablePropertyFields)).min(1).max(clearablePropertyFields.length),
    propertyIds: propertyIdsSchema(),
  }),
  z.object({
    action: z.literal("SET_MUNICIPALITY"),
    municipality: z.string().trim().min(1).max(100),
    propertyIds: propertyIdsSchema(),
  }),
])

type BulkPropertyRequest = z.infer<typeof bulkPropertySchema>

function propertyIdsSchema() {
  return z.array(z.string().trim().min(1)).min(1).max(MAX_BULK_PROPERTIES)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const data = bulkPropertySchema.parse(body)

    if (data.action === "DELETE") {
      if (auth.user.role !== "OWNER") return forbiddenResponse()
      return handleBulkDelete(data, auth.user.companyId, auth.user.userId)
    }

    if (!isAdmin(auth.user)) return forbiddenResponse()

    if (data.action === "CLEAR_FIELDS") {
      return handleClearFields(data, auth.user.companyId, auth.user.userId)
    }

    return handleSetMunicipality(data, auth.user.companyId, auth.user.userId)
  } catch (error: unknown) {
    console.error("Bulk property action error:", error)

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

async function handleBulkDelete(
  data: Extract<BulkPropertyRequest, { action: "DELETE" }>,
  companyId: string,
  userId: string
) {
  const properties = await loadCompanyProperties(data.propertyIds, companyId)
  const blocked = properties
    .filter((property) => property._count.installations > 0)
    .map((property) => ({
      id: property.id,
      installationCount: property._count.installations,
      name: property.name,
    }))
  const deletable = properties.filter((property) => property._count.installations === 0)

  if (deletable.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.property.deleteMany({
        where: {
          companyId,
          id: {
            in: deletable.map((property) => property.id),
          },
        },
      })
    })

    await Promise.all(
      deletable.map((property) =>
        logActivity({
          action: "property_deleted",
          companyId,
          entityId: property.id,
          entityType: "PROPERTY",
          metadata: {
            bulk: true,
            name: property.name,
            propertyDesignation: property.propertyDesignation,
          },
          userId,
        })
      )
    )
  }

  return NextResponse.json(
    {
      action: "DELETE",
      blocked,
      blockedCount: blocked.length,
      deletedCount: deletable.length,
      requestedCount: data.propertyIds.length,
    },
    { status: 200 }
  )
}

async function handleClearFields(
  data: Extract<BulkPropertyRequest, { action: "CLEAR_FIELDS" }>,
  companyId: string,
  userId: string
) {
  const properties = await loadCompanyProperties(data.propertyIds, companyId)
  const propertyIds = properties.map((property) => property.id)
  const updateData = Object.fromEntries(
    data.fields.map((field) => [field, null])
  )

  if (propertyIds.length > 0) {
    await prisma.property.updateMany({
      where: {
        companyId,
        id: {
          in: propertyIds,
        },
      },
      data: updateData,
    })

    await logActivity({
      action: "properties_bulk_fields_cleared",
      companyId,
      entityId: null,
      entityType: "PROPERTY",
      metadata: {
        fields: data.fields,
        propertyCount: propertyIds.length,
      },
      userId,
    })
  }

  return NextResponse.json(
    {
      action: "CLEAR_FIELDS",
      fields: data.fields,
      requestedCount: data.propertyIds.length,
      updatedCount: propertyIds.length,
    },
    { status: 200 }
  )
}

async function handleSetMunicipality(
  data: Extract<BulkPropertyRequest, { action: "SET_MUNICIPALITY" }>,
  companyId: string,
  userId: string
) {
  const properties = await loadCompanyProperties(data.propertyIds, companyId)
  const propertyIds = properties.map((property) => property.id)

  if (propertyIds.length > 0) {
    await prisma.property.updateMany({
      where: {
        companyId,
        id: {
          in: propertyIds,
        },
      },
      data: {
        municipality: data.municipality,
      },
    })

    await logActivity({
      action: "properties_bulk_municipality_updated",
      companyId,
      entityId: null,
      entityType: "PROPERTY",
      metadata: {
        municipality: data.municipality,
        propertyCount: propertyIds.length,
      },
      userId,
    })
  }

  return NextResponse.json(
    {
      action: "SET_MUNICIPALITY",
      municipality: data.municipality,
      requestedCount: data.propertyIds.length,
      updatedCount: propertyIds.length,
    },
    { status: 200 }
  )
}

async function loadCompanyProperties(propertyIds: string[], companyId: string) {
  return prisma.property.findMany({
    where: {
      companyId,
      id: {
        in: Array.from(new Set(propertyIds)),
      },
    },
    select: {
      id: true,
      name: true,
      propertyDesignation: true,
      _count: {
        select: {
          installations: true,
        },
      },
    },
  })
}
