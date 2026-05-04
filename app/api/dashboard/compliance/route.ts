import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import {
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
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

type AttentionItem = {
  id: string
  installationId: string
  installationName: string
  location: string
  type: ComplianceStatus | "LEAK"
  label: string
  date: Date | null
  daysUntilDue: number | null
  notes: string | null
}

type ActionItemType =
  | "OVERDUE_INSPECTION"
  | "DUE_SOON_INSPECTION"
  | "NOT_INSPECTED"
  | "HIGH_RISK"
  | "NO_SERVICE_PARTNER"
  | "RECENT_LEAKAGE"

type ActionItemPriority = "HIGH" | "MEDIUM" | "LOW"

type ActionItem = {
  id: string
  type: ActionItemType
  title: string
  description: string
  priority: ActionItemPriority
  installationId?: string
  href: string
  dueDate?: Date | null
  createdAt?: Date | null
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

const ACTION_PRIORITY_ORDER: Record<ActionItemPriority, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const ACTION_TYPE_ORDER: Record<ActionItemType, number> = {
  OVERDUE_INSPECTION: 1,
  DUE_SOON_INSPECTION: 2,
  NOT_INSPECTED: 3,
  HIGH_RISK: 4,
  NO_SERVICE_PARTNER: 5,
  RECENT_LEAKAGE: 6,
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
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
      refrigerant.co2eTon += compliance.co2eTon
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
        leakageEventsCount,
        risk,
      }
    })

    const leakageEvents = installations.flatMap((installation) =>
      installation.events.map((event) => ({
        ...event,
        installationName: installation.name,
        installationLocation: installation.location,
      }))
    )
    const leakageInstallationCount = installations.filter((installation) =>
      installation.events.length > 0
    ).length

    const complianceAttention: AttentionItem[] = installationRows
      .filter((installation) =>
        ["OVERDUE", "DUE_SOON", "NOT_INSPECTED"].includes(
          installation.complianceStatus
        )
      )
      .map((installation) => ({
        id: `status-${installation.id}`,
        installationId: installation.id,
        installationName: installation.name,
        location: installation.location,
        type: installation.complianceStatus,
        label: getStatusLabel(installation.complianceStatus),
        date: installation.nextInspection,
        daysUntilDue: installation.daysUntilDue,
        notes: null,
      }))

    const leakageAttention: AttentionItem[] = leakageEvents
      .sort((first, second) => second.date.getTime() - first.date.getTime())
      .slice(0, 5)
      .map((event) => ({
        id: `leak-${event.id}`,
        installationId: event.installationId,
        installationName: event.installationName,
        location: event.installationLocation,
        type: "LEAK",
        label: "Läckagehändelse",
        date: event.date,
        daysUntilDue: null,
        notes: event.notes,
      }))

    const attentionItems = [...complianceAttention, ...leakageAttention].sort(
      compareAttentionItems
    )
    const actionItems = buildActionItems(installationRows, leakageEvents).sort(
      compareActionItems
    ).slice(0, 10)

    const totalCo2eTon = installationRows.reduce(
      (sum, installation) => sum + installation.co2eTon,
      0
    )
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
          totalCo2eTon,
          totalRefrigerantAmount,
          requiringInspection,
          leakageInstallationCount,
          leakageEvents: leakageEvents.length,
        },
        riskSummary,
        statusDistribution: statusCounts,
        refrigerantDistribution: Array.from(refrigerantMap.values()).sort(
          (first, second) => second.count - first.count
        ),
        installations: installationRows.sort(compareInstallations),
        attentionItems,
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

function buildActionItems(
  installations: Array<{
    id: string
    name: string
    nextInspection: Date | null
    lastInspection: Date | null
    inspectionInterval: number | null
    complianceStatus: ComplianceStatus
    daysUntilDue: number | null
    assignedContractorId: string | null
    risk: { level: InstallationRiskLevel; score: number }
  }>,
  leakageEvents: Array<{
    id: string
    installationId: string
    installationName: string
    date: Date
  }>
): ActionItem[] {
  const items: ActionItem[] = []
  const today = startOfDay(new Date())
  const recentLeakageThreshold = new Date(today)
  recentLeakageThreshold.setDate(recentLeakageThreshold.getDate() - 30)

  installations.forEach((installation) => {
    const href = `/dashboard/installations/${installation.id}`

    if (installation.complianceStatus === "OVERDUE" && installation.nextInspection) {
      items.push({
        id: `overdue-${installation.id}`,
        type: "OVERDUE_INSPECTION",
        title: "Försenad kontroll",
        description: `${installation.name} skulle ha kontrollerats ${formatDate(installation.nextInspection)}`,
        priority: "HIGH",
        installationId: installation.id,
        href,
        dueDate: installation.nextInspection,
      })
    }

    if (installation.complianceStatus === "DUE_SOON" && installation.nextInspection) {
      items.push({
        id: `due-soon-${installation.id}`,
        type: "DUE_SOON_INSPECTION",
        title: "Kontroll inom 30 dagar",
        description: `${installation.name} ska kontrolleras ${formatDate(installation.nextInspection)}`,
        priority: "MEDIUM",
        installationId: installation.id,
        href,
        dueDate: installation.nextInspection,
      })
    }

    if (installation.complianceStatus === "NOT_INSPECTED") {
      items.push({
        id: `not-inspected-${installation.id}`,
        type: "NOT_INSPECTED",
        title: "Aggregat saknar kontroll",
        description: `${installation.name} saknar registrerad kontroll`,
        priority: installation.inspectionInterval ? "HIGH" : "LOW",
        installationId: installation.id,
        href,
      })
    }

    if (installation.risk.level === "HIGH") {
      items.push({
        id: `high-risk-${installation.id}`,
        type: "HIGH_RISK",
        title: "Aggregat med hög risk",
        description: `${installation.name} har hög klimat- eller compliance-risk`,
        priority: "HIGH",
        installationId: installation.id,
        href,
      })
    }

    if (installation.inspectionInterval && !installation.assignedContractorId) {
      items.push({
        id: `no-service-partner-${installation.id}`,
        type: "NO_SERVICE_PARTNER",
        title: "Servicepartner saknas",
        description: `${installation.name} saknar tilldelad servicepartner`,
        priority: "MEDIUM",
        installationId: installation.id,
        href,
      })
    }
  })

  leakageEvents.forEach((event) => {
    const eventDate = startOfDay(event.date)
    const isRecent = eventDate >= recentLeakageThreshold

    items.push({
      id: `recent-leakage-${event.id}`,
      type: "RECENT_LEAKAGE",
      title: "Nyligt läckage registrerat",
      description: `${event.installationName} har läckage registrerat ${formatDate(event.date)}`,
      priority: isRecent ? "HIGH" : "MEDIUM",
      installationId: event.installationId,
      href: `/dashboard/installations/${event.installationId}`,
      createdAt: event.date,
    })
  })

  return items
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

function compareAttentionItems(first: AttentionItem, second: AttentionItem) {
  const priorityDiff = getAttentionPriority(first.type) - getAttentionPriority(second.type)
  if (priorityDiff !== 0) return priorityDiff

  return compareOptionalDates(first.date, second.date)
}

function compareOptionalDates(firstDate?: Date | null, secondDate?: Date | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return firstDate.getTime() - secondDate.getTime()
}

function compareActionItems(first: ActionItem, second: ActionItem) {
  const priorityDiff =
    ACTION_PRIORITY_ORDER[first.priority] - ACTION_PRIORITY_ORDER[second.priority]
  if (priorityDiff !== 0) return priorityDiff

  const typeDiff = ACTION_TYPE_ORDER[first.type] - ACTION_TYPE_ORDER[second.type]
  if (typeDiff !== 0) return typeDiff

  if (first.type === "RECENT_LEAKAGE" && second.type === "RECENT_LEAKAGE") {
    return compareOptionalDatesDesc(first.createdAt, second.createdAt)
  }

  return compareOptionalDates(first.dueDate, second.dueDate)
}

function compareOptionalDatesDesc(firstDate?: Date | null, secondDate?: Date | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return secondDate.getTime() - firstDate.getTime()
}

function incrementRiskSummary(
  summary: RiskSummary,
  level: InstallationRiskLevel
) {
  if (level === "HIGH") summary.high += 1
  if (level === "MEDIUM") summary.medium += 1
  if (level === "LOW") summary.low += 1
}

function getAttentionPriority(type: ComplianceStatus | "LEAK") {
  if (type === "OVERDUE") return 1
  if (type === "DUE_SOON") return 2
  if (type === "NOT_INSPECTED") return 3
  if (type === "LEAK") return 4
  return 5
}

function getStatusLabel(status: ComplianceStatus) {
  const labels: Record<ComplianceStatus, string> = {
    OK: "OK",
    DUE_SOON: "Kontroll inom 30 dagar",
    OVERDUE: "Försenad kontroll",
    NOT_REQUIRED: "Ej kontrollpliktig",
    NOT_INSPECTED: "Ej kontrollerad",
  }

  return labels[status]
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sv-SE").format(value)
}
