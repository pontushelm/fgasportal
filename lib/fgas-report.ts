import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { buildAnnualFgasReportQualitySummary } from "@/lib/reports/annualFgasReportValidation"
import type {
  AnnualFgasReportQualitySummary,
  AnnualFgasReportWarningSeverity,
} from "@/lib/reports/annualFgasReportTypes"

export type FgasReportEventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"

export type FgasReportData = {
  year: number
  period: {
    startDate: Date
    endDate: Date
  }
  metrics: {
    totalInstallations: number
    totalRefrigerantAmountKg: number
    totalCo2eTon: number | null
    knownCo2eTon: number
    unknownCo2eInstallations: number
    requiringInspection: number
    inspectionsPerformed: number
    leakageEvents: number
    refilledAmountKg: number
    serviceEvents: number
  }
  warnings: Array<{
    id: string
    severity: AnnualFgasReportWarningSeverity
    message: string
    installationName?: string | null
  }>
  qualitySummary: AnnualFgasReportQualitySummary
  refrigerants: Array<{
    refrigerantType: string
    installationCount: number
    totalAmountKg: number
    totalCo2eTon: number | null
    refilledAmountKg: number
    leakageEvents: number
  }>
  events: Array<{
    id: string
    date: Date
    installationId: string
    installationName: string
    refrigerantType: string
    type: FgasReportEventType
    refrigerantAddedKg: number | null
    previousRefrigerantType: string | null
    newRefrigerantType: string | null
    previousAmountKg: number | null
    newAmountKg: number | null
    recoveredAmountKg: number | null
    notes: string | null
  }>
}

type RefrigerantSummary = FgasReportData["refrigerants"][number]

const UNKNOWN_REFRIGERANT = "Okänt köldmedium"

export function parseReportYear(value: string | null) {
  const currentYear = new Date().getFullYear()
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return null
  }

  return year
}

export async function getFgasAnnualReport({
  companyId,
  assignedContractorId,
  municipality,
  propertyId,
  year,
}: {
  companyId: string
  assignedContractorId?: string
  municipality?: string
  propertyId?: string
  year: number
}): Promise<FgasReportData> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))
  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      archivedAt: null,
      OR: [
        { scrappedAt: null },
        { scrappedAt: { gte: startDate, lt: endDate } },
      ],
      ...(assignedContractorId ? { assignedContractorId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(municipality ? { property: { municipality } } : {}),
    },
    include: {
      events: {
        where: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      },
      inspections: {
        where: {
          inspectionDate: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          inspectionDate: "desc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  const refrigerantMap = new Map<string, RefrigerantSummary>()
  let totalRefrigerantAmountKg = 0
  let knownCo2eTon = 0
  let unknownCo2eInstallations = 0
  let requiringInspection = 0
  let inspectionEvents = 0
  let inspectionRecords = 0
  let leakageEvents = 0
  let refilledAmountKg = 0
  let serviceEvents = 0
  const warnings: FgasReportData["warnings"] = []

  const events = installations.flatMap((installation) => {
    const refrigerantType =
      installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )
    const summary = refrigerantMap.get(refrigerantType) ?? {
      refrigerantType,
      installationCount: 0,
      totalAmountKg: 0,
      totalCo2eTon: null,
      refilledAmountKg: 0,
      leakageEvents: 0,
    }

    summary.installationCount += 1
    summary.totalAmountKg += installation.refrigerantAmount
    if (compliance.co2eTon !== null) {
      summary.totalCo2eTon = (summary.totalCo2eTon ?? 0) + compliance.co2eTon
    }
    refrigerantMap.set(refrigerantType, summary)

    totalRefrigerantAmountKg += installation.refrigerantAmount
    if (compliance.co2eTon === null) {
      unknownCo2eInstallations += 1
    } else {
      knownCo2eTon += compliance.co2eTon
    }
    if (compliance.inspectionIntervalMonths) requiringInspection += 1
    inspectionRecords += installation.inspections.length

    return installation.events.map((event) => {
      const addedAmount = event.refrigerantAddedKg ?? 0

      if (event.type === "INSPECTION") inspectionEvents += 1
      if (event.type === "LEAK") {
        leakageEvents += 1
        summary.leakageEvents += 1
        if (event.refrigerantAddedKg == null) {
          warnings.push({
            id: `leak-missing-amount-${event.id}`,
            severity: "review",
            installationName: installation.name,
            message: "Läckagehändelse saknar läckagemängd.",
          })
        }
      }
      if (event.type === "REFILL") {
        refilledAmountKg += addedAmount
        summary.refilledAmountKg += addedAmount
      }
      if (event.type === "SERVICE") serviceEvents += 1
      if (
        event.type === "RECOVERY" &&
        event.recoveredAmountKg == null &&
        event.refrigerantAddedKg == null
      ) {
        warnings.push({
          id: `recovery-missing-amount-${event.id}`,
          severity: "review",
          installationName: installation.name,
          message: "Tömning/återvinning saknar omhändertagen mängd.",
        })
      }
      if (
        event.type === "REFRIGERANT_CHANGE" &&
        event.newAmountKg == null &&
        event.refrigerantAddedKg == null
      ) {
        warnings.push({
          id: `refrigerant-change-missing-amount-${event.id}`,
          severity: "review",
          installationName: installation.name,
          message: "Köldmediebyte saknar ny fyllnadsmängd.",
        })
      }

      return {
        id: event.id,
        date: event.date,
        installationId: installation.id,
        installationName: installation.name,
        refrigerantType,
        type: event.type as FgasReportEventType,
        refrigerantAddedKg: event.refrigerantAddedKg,
        previousRefrigerantType: event.previousRefrigerantType,
        newRefrigerantType: event.newRefrigerantType,
        previousAmountKg: event.previousAmountKg,
        newAmountKg: event.newAmountKg,
        recoveredAmountKg: event.recoveredAmountKg,
        notes: event.notes,
      }
    })
  })

  const reportWarnings: FgasReportData["warnings"] = [
    ...(unknownCo2eInstallations > 0
      ? [
          {
            id: "unknown-co2e",
            severity: "blocking" as const,
            message: `${unknownCo2eInstallations} aggregat saknar känt GWP/CO₂e-värde.`,
          },
        ]
      : []),
    ...warnings.sort((first, second) => {
      if (first.severity !== second.severity) {
        return first.severity === "blocking" ? -1 : 1
      }

      return first.id.localeCompare(second.id, "sv")
    }),
  ]
  const qualitySummary = buildAnnualFgasReportQualitySummary(reportWarnings)

  return {
    year,
    period: {
      startDate,
      endDate,
    },
    metrics: {
      totalInstallations: installations.length,
      totalRefrigerantAmountKg,
      totalCo2eTon: unknownCo2eInstallations > 0 ? null : knownCo2eTon,
      knownCo2eTon,
      unknownCo2eInstallations,
      requiringInspection,
      inspectionsPerformed: inspectionEvents + inspectionRecords,
      leakageEvents,
      refilledAmountKg,
      serviceEvents,
    },
    warnings: reportWarnings,
    qualitySummary,
    refrigerants: Array.from(refrigerantMap.values()).sort((first, second) =>
      first.refrigerantType.localeCompare(second.refrigerantType, "sv")
    ),
    events: events.sort(
      (first, second) => second.date.getTime() - first.date.getTime()
    ),
  }
}
