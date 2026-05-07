import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateInstallationRisk } from "@/lib/risk-classification"

type PropertySummary = {
  id: string
  name: string
  municipality: string | null
  city: string | null
  installationsCount: number
  totalCo2eTon: number
  overdueInspections: number
  highRiskInstallations: number
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user

    if (isContractor(auth.user)) {
      const installations = await prisma.installation.findMany({
        where: {
          companyId,
          archivedAt: null,
          scrappedAt: null,
          assignedContractorId: userId,
          propertyId: {
            not: null,
          },
        },
        include: {
          property: true,
          events: {
            where: {
              type: "LEAK",
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          property: {
            name: "asc",
          },
        },
      })

      return NextResponse.json(
        Array.from(aggregateInstallationsByProperty(installations).values()),
        { status: 200 }
      )
    }

    const properties = await prisma.property.findMany({
      where: {
        companyId,
      },
      include: {
        installations: {
          where: {
            archivedAt: null,
            scrappedAt: null,
          },
          include: {
            events: {
              where: {
                type: "LEAK",
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    })

    const summaries = properties.map((property) => {
      const summary = createEmptyPropertySummary(property)

      for (const installation of property.installations) {
        applyInstallationToSummary(summary, installation)
      }

      return summary
    })

    return NextResponse.json(summaries, { status: 200 })
  } catch (error: unknown) {
    console.error("Get property overview error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function aggregateInstallationsByProperty(
  installations: Array<{
    property: {
      id: string
      name: string
      municipality: string | null
      city: string | null
    } | null
    refrigerantType: string
    refrigerantAmount: number
    hasLeakDetectionSystem: boolean
    lastInspection: Date | null
    nextInspection: Date | null
    events: Array<{ id: string }>
  }>
) {
  const summaries = new Map<string, PropertySummary>()

  for (const installation of installations) {
    if (!installation.property) continue

    const summary =
      summaries.get(installation.property.id) ??
      createEmptyPropertySummary(installation.property)

    applyInstallationToSummary(summary, installation)
    summaries.set(installation.property.id, summary)
  }

  return summaries
}

function createEmptyPropertySummary(property: {
  id: string
  name: string
  municipality: string | null
  city: string | null
}): PropertySummary {
  return {
    id: property.id,
    name: property.name,
    municipality: property.municipality,
    city: property.city,
    installationsCount: 0,
    totalCo2eTon: 0,
    overdueInspections: 0,
    highRiskInstallations: 0,
  }
}

function applyInstallationToSummary(
  summary: PropertySummary,
  installation: {
    refrigerantType: string
    refrigerantAmount: number
    hasLeakDetectionSystem: boolean
    lastInspection: Date | null
    nextInspection: Date | null
    events: Array<{ id: string }>
  }
) {
  const compliance = calculateInstallationCompliance(
    installation.refrigerantType,
    installation.refrigerantAmount,
    installation.hasLeakDetectionSystem,
    installation.lastInspection,
    installation.nextInspection
  )
  const risk = calculateInstallationRisk({
    refrigerantType: installation.refrigerantType,
    refrigerantAmount: installation.refrigerantAmount,
    gwp: compliance.gwp,
    hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
    leakageEventsCount: installation.events.length,
    isInspectionOverdue: compliance.status === "OVERDUE",
  })

  summary.installationsCount += 1
  summary.totalCo2eTon += compliance.co2eTon ?? 0
  if (compliance.status === "OVERDUE") summary.overdueInspections += 1
  if (risk.level === "HIGH") summary.highRiskInstallations += 1
}
