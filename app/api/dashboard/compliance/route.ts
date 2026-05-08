import { NextRequest, NextResponse } from "next/server"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import {
  getCurrentYearRange,
  isDateInRange,
  summarizeCo2eCompleteness,
} from "@/lib/dashboard/compliance-metrics"
import { prisma } from "@/lib/db"
import {
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import {
  calculateInstallationRisk,
  type InstallationRiskLevel,
} from "@/lib/risk-classification"

type DistributionItem = {
  label: string
  count: number
  co2eTon: number
  refrigerantAmount: number
}

type RiskSummary = {
  high: number
  medium: number
  low: number
}

const STATUS_SORT_ORDER: Record<ComplianceStatus, number> = {
  OVERDUE: 1,
  DUE_SOON: 2,
  NOT_INSPECTED: 3,
  OK: 4,
  NOT_REQUIRED: 5,
}

const ACTION_PREVIEW_LIMIT = 10

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const currentYearRange = getCurrentYearRange()
    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
        scrappedAt: null,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
      },
      include: {
        events: {
          where: {
            type: "LEAK",
          },
          orderBy: {
            date: "desc",
          },
        },
        property: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const statusCounts: Record<ComplianceStatus, number> = {
      OK: 0,
      DUE_SOON: 0,
      OVERDUE: 0,
      NOT_REQUIRED: 0,
      NOT_INSPECTED: 0,
    }
    const refrigerantMap = new Map<string, DistributionItem>()
    const riskSummary: RiskSummary = {
      high: 0,
      medium: 0,
      low: 0,
    }
    const installationRows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      statusCounts[compliance.status] += 1
      const leakageEventsCount = installation.events.length
      const risk = calculateInstallationRisk({
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        gwp: compliance.gwp,
        hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
        leakageEventsCount,
        isInspectionOverdue: compliance.status === "OVERDUE",
      })
      incrementRiskSummary(riskSummary, risk.level)

      const refrigerantType =
        installation.refrigerantType?.trim() || "Okänt köldmedium"
      const refrigerant = refrigerantMap.get(refrigerantType) ?? {
        label: refrigerantType,
        count: 0,
        co2eTon: 0,
        refrigerantAmount: 0,
      }
      refrigerant.count += 1
      refrigerant.co2eTon += compliance.co2eTon ?? 0
      refrigerant.refrigerantAmount += installation.refrigerantAmount
      refrigerantMap.set(refrigerantType, refrigerant)

      return {
        id: installation.id,
        name: installation.name,
        location: installation.location,
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        gwp: compliance.gwp,
        co2eTon: compliance.co2eTon,
        baseInspectionInterval: compliance.baseInspectionIntervalMonths,
        inspectionInterval: compliance.inspectionIntervalMonths,
        hasAdjustedInspectionInterval: compliance.hasAdjustedInspectionInterval,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
        nextInspection: installation.nextInspection,
        lastInspection: installation.lastInspection,
        assignedContractorId: installation.assignedContractorId,
        propertyName: installation.property?.name ?? installation.propertyName,
        leakageEventsCount,
        risk,
      }
    })

    const leakageEvents = installations.flatMap((installation) =>
      installation.events.map((event) => ({
        ...event,
        installationName: installation.name,
        installationLocation: installation.location,
        propertyName: installation.property?.name ?? installation.propertyName,
      }))
    )
    const currentYearLeakageEvents = leakageEvents.filter((event) =>
      isDateInRange(event.date, currentYearRange)
    )
    const leakageInstallationCount = new Set(
      currentYearLeakageEvents.map((event) => event.installationId)
    ).size
    const actionItems = generateDashboardActions({
      installations: installationRows,
      leakageEvents,
    }).slice(0, ACTION_PREVIEW_LIMIT)
    const co2eCompleteness = summarizeCo2eCompleteness(installationRows)
    const totalRefrigerantAmount = installationRows.reduce(
      (sum, installation) => sum + installation.refrigerantAmount,
      0
    )
    const requiringInspection = installationRows.filter(
      (installation) => installation.inspectionInterval !== null
    ).length

    return NextResponse.json(
      {
        metrics: {
          totalInstallations: installationRows.length,
          ok: statusCounts.OK,
          overdue: statusCounts.OVERDUE,
          dueSoon: statusCounts.DUE_SOON,
          notInspected: statusCounts.NOT_INSPECTED,
          notRequired: statusCounts.NOT_REQUIRED,
        },
        environmental: {
          totalCo2eTon: co2eCompleteness.totalCo2eTon,
          co2eIsComplete: co2eCompleteness.isComplete,
          unknownCo2eInstallations: co2eCompleteness.unknownCo2eInstallations,
          totalRefrigerantAmount,
          requiringInspection,
          leakageInstallationCount,
          leakageEvents: currentYearLeakageEvents.length,
          leakageYear: currentYearRange.startDate.getFullYear(),
        },
        riskSummary,
        statusDistribution: statusCounts,
        refrigerantDistribution: Array.from(refrigerantMap.values()).sort(
          (first, second) => second.count - first.count
        ),
        installations: installationRows.sort(compareInstallations),
        actionItems,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get compliance dashboard error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function compareInstallations(
  first: { complianceStatus: ComplianceStatus; nextInspection?: Date | null },
  second: { complianceStatus: ComplianceStatus; nextInspection?: Date | null }
) {
  const statusDiff =
    STATUS_SORT_ORDER[first.complianceStatus] -
    STATUS_SORT_ORDER[second.complianceStatus]

  if (statusDiff !== 0) return statusDiff

  return compareOptionalDates(first.nextInspection, second.nextInspection)
}

function compareOptionalDates(firstDate?: Date | null, secondDate?: Date | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return firstDate.getTime() - secondDate.getTime()
}

function incrementRiskSummary(
  summary: RiskSummary,
  level: InstallationRiskLevel
) {
  if (level === "HIGH") summary.high += 1
  if (level === "MEDIUM") summary.medium += 1
  if (level === "LOW") summary.low += 1
}
