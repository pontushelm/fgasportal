import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateInstallationRisk } from "@/lib/risk-classification"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const { id } = await context.params
    const property = await prisma.property.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        installations: {
          where: {
            archivedAt: null,
            ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
          },
          include: {
            assignedContractor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            property: {
              select: {
                id: true,
                name: true,
                municipality: true,
                city: true,
              },
            },
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
            name: "asc",
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json({ error: "Fastigheten hittades inte" }, { status: 404 })
    }

    if (isContractor(auth.user) && property.installations.length === 0) {
      return NextResponse.json({ error: "Fastigheten hittades inte" }, { status: 404 })
    }

    const riskDistribution = {
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    }
    let totalCo2eTon = 0
    let overdueInspections = 0

    const installations = property.installations.map((installation) => {
      const { events, ...installationData } = installation
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
        leakageEventsCount: events.length,
        isInspectionOverdue: compliance.status === "OVERDUE",
      })

      totalCo2eTon += compliance.co2eTon
      if (compliance.status === "OVERDUE") overdueInspections += 1
      riskDistribution[risk.level] += 1

      return {
        ...installationData,
        co2eTon: compliance.co2eTon,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
        riskLevel: risk.level,
        riskScore: risk.score,
      }
    })

    return NextResponse.json(
      {
        property: {
          id: property.id,
          name: property.name,
          address: property.address,
          postalCode: property.postalCode,
          city: property.city,
          municipality: property.municipality,
          propertyDesignation: property.propertyDesignation,
        },
        summary: {
          installationsCount: installations.length,
          totalCo2eTon,
          overdueInspections,
          highRiskInstallations: riskDistribution.HIGH,
          riskDistribution,
        },
        installations,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get property detail overview error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
