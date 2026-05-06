import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ACTIVITY_LABELS, formatActivityDescription } from "@/lib/activity-labels"
import { authenticateApiRequest, forbiddenResponse, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"

const defaultPageSize = 25
const maxPageSize = 100

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (isContractor(auth.user)) return forbiddenResponse()

    const searchParams = request.nextUrl.searchParams
    const page = parsePositiveInteger(searchParams.get("page"), 1)
    const pageSize = Math.min(
      parsePositiveInteger(searchParams.get("pageSize"), defaultPageSize),
      maxPageSize
    )
    const eventType = searchParams.get("eventType")?.trim()
    const userId = searchParams.get("userId")?.trim()
    const installationId = searchParams.get("installationId")?.trim()
    const propertyId = searchParams.get("propertyId")?.trim()
    const search = searchParams.get("q")?.trim().toLowerCase()
    const fromDate = parseDate(searchParams.get("fromDate"), "start")
    const toDate = parseDate(searchParams.get("toDate"), "end")

    const where: Prisma.ActivityLogWhereInput = {
      companyId: auth.user.companyId,
    }

    if (eventType) {
      where.action = eventType
    }

    if (userId) {
      where.userId = userId
    }

    if (installationId) {
      where.installationId = installationId
    }

    if (propertyId) {
      where.installation = {
        propertyId,
      }
    }

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      }
    }

    const entries = await prisma.activityLog.findMany({
      where,
      include: {
        installation: {
          select: {
            id: true,
            name: true,
            location: true,
            property: {
              select: {
                id: true,
                name: true,
                municipality: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
    const mappedEntries = entries.map((entry) => {
      const metadata = toMetadataObject(entry.metadata)

      return {
        id: entry.id,
        action: entry.action,
        label: ACTIVITY_LABELS[entry.action] ?? entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata,
        description: formatActivityDescription({
          action: entry.action,
          entityType: entry.entityType,
          metadata,
        }),
        createdAt: entry.createdAt,
        installation: entry.installation,
        property: entry.installation?.property ?? getPropertyFromMetadata(metadata),
        user: entry.user,
      }
    })
    const filteredEntries = search
      ? mappedEntries.filter((entry) => matchesActivitySearch(entry, search))
      : mappedEntries
    const paginatedEntries = filteredEntries.slice(
      (page - 1) * pageSize,
      page * pageSize
    )

    return NextResponse.json(
      {
        entries: paginatedEntries,
        filters: {
          eventTypes: Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({
            label,
            value,
          })),
        },
        pagination: {
          page,
          pageSize,
          total: filteredEntries.length,
          totalPages: Math.max(1, Math.ceil(filteredEntries.length / pageSize)),
        },
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get global activity error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsedValue = Number.parseInt(value ?? "", 10)

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  if (boundary === "start") {
    date.setHours(0, 0, 0, 0)
  } else {
    date.setHours(23, 59, 59, 999)
  }

  return date
}

function toMetadataObject(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  return value as Record<string, unknown>
}

function getPropertyFromMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return null
  if (
    typeof metadata.propertyName !== "string" &&
    typeof metadata.municipality !== "string"
  ) {
    return null
  }

  return {
    id: typeof metadata.propertyId === "string" ? metadata.propertyId : null,
    name: typeof metadata.propertyName === "string" ? metadata.propertyName : null,
    municipality:
      typeof metadata.municipality === "string" ? metadata.municipality : null,
  }
}

function matchesActivitySearch(
  entry: {
    action: string
    label: string
    entityType: string
    description: string
    metadata?: Record<string, unknown> | null
    installation?: {
      name: string
      location: string
      property?: {
        name: string | null
        municipality?: string | null
      } | null
    } | null
    property?: {
      name: string | null
      municipality?: string | null
    } | null
    user?: {
      name: string
      email: string
    } | null
  },
  search: string
) {
  return collectSearchValues([
    entry.action,
    entry.label,
    entry.entityType,
    entry.description,
    entry.installation?.name,
    entry.installation?.location,
    entry.installation?.property?.name,
    entry.installation?.property?.municipality,
    entry.property?.name,
    entry.property?.municipality,
    entry.user?.name,
    entry.user?.email,
    ...(entry.metadata ? Object.values(entry.metadata) : []),
  ]).some((value) => value.includes(search))
}

function collectSearchValues(values: unknown[]): string[] {
  return values.flatMap((value) => {
    if (value === null || value === undefined) return []

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return [String(value).toLowerCase()]
    }

    if (Array.isArray(value)) {
      return collectSearchValues(value)
    }

    if (typeof value === "object") {
      return collectSearchValues(Object.values(value))
    }

    return []
  })
}
