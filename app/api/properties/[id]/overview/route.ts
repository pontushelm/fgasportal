import { NextRequest, NextResponse } from "next/server"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import {
  buildPropertyHistoricalMetrics,
  buildPropertyReportOverview,
  calculatePropertyLeakageClimateImpact,
  createEmptyPropertyLeakageClimateImpact,
  filterPropertyActions,
  mergePropertyLeakageClimateImpact,
} from "@/lib/property-overview"
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
            scrappedAt: null,
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
                supersededAt: null,
              },
              select: {
                id: true,
                date: true,
                type: true,
                refrigerantAddedKg: true,
                recoveredAmountKg: true,
                notes: true,
              },
              orderBy: {
                date: "desc",
              },
            },
            inspections: {
              select: {
                id: true,
                inspectionDate: true,
              },
              orderBy: {
                inspectionDate: "desc",
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
    let dueSoonInspections = 0
    let notInspected = 0
    const leakageClimateImpact = createEmptyPropertyLeakageClimateImpact()
    const leakageEventsForActions: Array<{
      id: string
      installationId: string
      installationName: string
      equipmentId: string | null
      propertyName: string | null
      date: Date
    }> = []

    const installations = property.installations.map((installation) => {
      const { events, inspections, ...installationData } = installation
      const leakEvents = events.filter((event) => event.type === "LEAK")
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
        leakageEventsCount: leakEvents.length,
        isInspectionOverdue: compliance.status === "OVERDUE",
      })

      totalCo2eTon += compliance.co2eTon ?? 0
      if (compliance.status === "DUE_SOON") dueSoonInspections += 1
      if (compliance.status === "OVERDUE") overdueInspections += 1
      if (compliance.status === "NOT_INSPECTED") notInspected += 1
      riskDistribution[risk.level] += 1
      mergePropertyLeakageClimateImpact(
        leakageClimateImpact,
        calculatePropertyLeakageClimateImpact({
          events: leakEvents,
          refrigerantType: installation.refrigerantType,
        })
      )
      leakageEventsForActions.push(
        ...leakEvents.map((event) => ({
          id: event.id,
          installationId: installation.id,
          installationName: installation.name,
          equipmentId: installation.equipmentId,
          propertyId: property.id,
          propertyName: property.name,
          assignedServiceContactId: installation.assignedContractor?.id ?? null,
          assignedServiceContactName: installation.assignedContractor?.name ?? null,
          assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
          date: event.date,
        }))
      )

      return {
        ...installationData,
        co2eTon: compliance.co2eTon,
        complianceStatus: compliance.status,
        inspectionIntervalMonths: compliance.inspectionIntervalMonths,
        daysUntilDue: compliance.daysUntilDue,
        riskLevel: risk.level,
        riskScore: risk.score,
        recentEvents: events.slice(0, 5),
        events,
        inspections,
      }
    })
    const reportOverview = buildPropertyReportOverview({
      installations,
      propertyHasMunicipality: Boolean(property.municipality?.trim()),
      propertyHasDesignation: Boolean(property.propertyDesignation?.trim()),
    })
    const historicalMetrics = buildPropertyHistoricalMetrics(installations)
    const actions = filterPropertyActions(
      generateDashboardActions({
        installations: installations.map((installation) => ({
          id: installation.id,
          name: installation.name,
          equipmentId: installation.equipmentId,
          propertyId: property.id,
          propertyName: property.name,
          nextInspection: installation.nextInspection,
          inspectionInterval: installation.inspectionIntervalMonths,
          complianceStatus: installation.complianceStatus,
          assignedContractorId: installation.assignedContractorId,
          assignedServiceContactId: installation.assignedContractor?.id ?? null,
          assignedServiceContactName: installation.assignedContractor?.name ?? null,
          assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
          risk: {
            level: installation.riskLevel,
            score: installation.riskScore,
          },
        })),
        leakageEvents: leakageEventsForActions,
      }),
      installations.map((installation) => installation.id)
    )
    const serviceContacts = Array.from(
      new Map(
        installations
          .map((installation) => installation.assignedContractor)
          .filter(Boolean)
          .map((contractor) => [contractor!.id, contractor!])
      ).values()
    )
    const recentEvents = installations
      .flatMap((installation) =>
        installation.recentEvents.map((event) => ({
          ...event,
          installationId: installation.id,
          installationName: installation.name,
        }))
      )
      .sort((first, second) => second.date.getTime() - first.date.getTime())
      .slice(0, 8)
    const publicInstallations = installations.map((installation) => ({
      id: installation.id,
      name: installation.name,
      equipmentId: installation.equipmentId,
      location: installation.location,
      refrigerantType: installation.refrigerantType,
      refrigerantAmount: installation.refrigerantAmount,
      assignedContractorId: installation.assignedContractorId,
      nextInspection: installation.nextInspection,
      co2eTon: installation.co2eTon,
      complianceStatus: installation.complianceStatus,
      riskLevel: installation.riskLevel,
    }))

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
          dueSoonInspections,
          overdueInspections,
          notInspected,
          highRiskInstallations: riskDistribution.HIGH,
          riskDistribution,
          leakageClimateImpact,
          reportOverview,
        },
        installations: publicInstallations,
        actions: actions.slice(0, 8),
        serviceContacts,
        recentEvents,
        historicalMetrics,
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
