import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import {
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"

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

const STATUS_SORT_ORDER: Record<ComplianceStatus, number> = {
  OVERDUE: 1,
  DUE_SOON: 2,
  NOT_INSPECTED: 3,
  OK: 4,
  NOT_REQUIRED: 5,
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId } = auth.user
    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
      },
      include: {
        events: {
          where: {
            type: "LEAK",
          },
          orderBy: {
            date: "desc",
          },
          take: 5,
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
    const installationRows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      statusCounts[compliance.status] += 1

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
        statusDistribution: statusCounts,
        refrigerantDistribution: Array.from(refrigerantMap.values()).sort(
          (first, second) => second.count - first.count
        ),
        installations: installationRows.sort(compareInstallations),
        attentionItems,
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
