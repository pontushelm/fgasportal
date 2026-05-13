import type { DashboardAction } from "@/lib/actions/generate-actions"
import { calculateCO2e, calculateInstallationCompliance } from "@/lib/fgas-calculations"

export type PropertyLeakageEventInput = {
  date: Date | string
  refrigerantAddedKg: number | null
}

export type PropertyLeakageClimateImpact = {
  leakageEventsCount: number
  leakageAmountKg: number
  leakageCo2eTon: number
  unknownLeakageCo2eCount: number
  isLeakageCo2eIncomplete: boolean
}

export function calculatePropertyLeakageClimateImpact({
  events,
  refrigerantType,
  year = new Date().getFullYear(),
}: {
  events: PropertyLeakageEventInput[]
  refrigerantType: string
  year?: number
}): PropertyLeakageClimateImpact {
  return events.reduce<PropertyLeakageClimateImpact>(
    (summary, event) => {
      if (new Date(event.date).getFullYear() !== year) return summary

      summary.leakageEventsCount += 1

      if (event.refrigerantAddedKg === null) {
        summary.unknownLeakageCo2eCount += 1
        summary.isLeakageCo2eIncomplete = true
        return summary
      }

      const co2e = calculateCO2e(refrigerantType, event.refrigerantAddedKg)
      summary.leakageAmountKg += event.refrigerantAddedKg

      if (co2e.co2eTon === null) {
        summary.unknownLeakageCo2eCount += 1
        summary.isLeakageCo2eIncomplete = true
      } else {
        summary.leakageCo2eTon += co2e.co2eTon
      }

      return summary
    },
    {
      leakageEventsCount: 0,
      leakageAmountKg: 0,
      leakageCo2eTon: 0,
      unknownLeakageCo2eCount: 0,
      isLeakageCo2eIncomplete: false,
    }
  )
}

export function mergePropertyLeakageClimateImpact(
  target: PropertyLeakageClimateImpact,
  source: PropertyLeakageClimateImpact
) {
  target.leakageEventsCount += source.leakageEventsCount
  target.leakageAmountKg += source.leakageAmountKg
  target.leakageCo2eTon += source.leakageCo2eTon
  target.unknownLeakageCo2eCount += source.unknownLeakageCo2eCount
  target.isLeakageCo2eIncomplete =
    target.isLeakageCo2eIncomplete || source.isLeakageCo2eIncomplete
}

export function createEmptyPropertyLeakageClimateImpact(): PropertyLeakageClimateImpact {
  return {
    leakageEventsCount: 0,
    leakageAmountKg: 0,
    leakageCo2eTon: 0,
    unknownLeakageCo2eCount: 0,
    isLeakageCo2eIncomplete: false,
  }
}

export function filterPropertyActions(
  actions: DashboardAction[],
  installationIds: Iterable<string>
) {
  const propertyInstallationIds = new Set(installationIds)
  return actions.filter((action) => propertyInstallationIds.has(action.installationId))
}

export type PropertyReportOverview = {
  controlRequiredInstallations: number
  completeReportDataInstallations: number
  installationsWithReportWarnings: number
  leakageEventsThisYear: number
  recoveredAmountKgThisYear: number
  totalCo2eTon: number | null
  knownCo2eTon: number
  unknownCo2eInstallations: number
}

export type PropertyHistoricalMetric = {
  year: number
  leakageEventsCount: number
  leakedAmountKg: number
  recoveredAmountKg: number
  controlsPerformed: number
}

type PropertyReportInstallationInput = {
  refrigerantType: string
  refrigerantAmount: number
  hasLeakDetectionSystem: boolean
  lastInspection: Date | null
  nextInspection: Date | null
  events: Array<{
    date: Date | string
    type: string
    refrigerantAddedKg: number | null
    recoveredAmountKg?: number | null
  }>
  inspections?: Array<{
    inspectionDate: Date | string
  }>
}

export function buildPropertyReportOverview({
  installations,
  propertyHasMunicipality,
  propertyHasDesignation,
  year = new Date().getFullYear(),
}: {
  installations: PropertyReportInstallationInput[]
  propertyHasMunicipality: boolean
  propertyHasDesignation: boolean
  year?: number
}): PropertyReportOverview {
  let controlRequiredInstallations = 0
  let completeReportDataInstallations = 0
  let installationsWithReportWarnings = 0
  let leakageEventsThisYear = 0
  let recoveredAmountKgThisYear = 0
  let knownCo2eTon = 0
  let unknownCo2eInstallations = 0

  installations.forEach((installation) => {
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )
    const isControlRequired = Boolean(compliance.inspectionIntervalMonths)
    const hasUnknownCo2e = compliance.co2eTon === null
    const hasReportWarning =
      hasUnknownCo2e ||
      installation.refrigerantAmount <= 0 ||
      !installation.refrigerantType.trim() ||
      !propertyHasMunicipality ||
      !propertyHasDesignation ||
      (isControlRequired && !installation.lastInspection)

    if (isControlRequired) {
      controlRequiredInstallations += 1
      if (!hasReportWarning) completeReportDataInstallations += 1
    }
    if (hasReportWarning) installationsWithReportWarnings += 1

    if (hasUnknownCo2e) {
      unknownCo2eInstallations += 1
    } else {
      knownCo2eTon += compliance.co2eTon ?? 0
    }

    installation.events.forEach((event) => {
      if (new Date(event.date).getFullYear() !== year) return
      if (event.type === "LEAK") leakageEventsThisYear += 1
      recoveredAmountKgThisYear += getRecoveredAmountForEvent(event)
    })
  })

  return {
    controlRequiredInstallations,
    completeReportDataInstallations,
    installationsWithReportWarnings,
    leakageEventsThisYear,
    recoveredAmountKgThisYear,
    totalCo2eTon: unknownCo2eInstallations > 0 ? null : knownCo2eTon,
    knownCo2eTon,
    unknownCo2eInstallations,
  }
}

export function buildPropertyHistoricalMetrics(
  installations: PropertyReportInstallationInput[]
): PropertyHistoricalMetric[] {
  const metricsByYear = new Map<number, PropertyHistoricalMetric>()

  installations.forEach((installation) => {
    installation.events.forEach((event) => {
      const year = new Date(event.date).getFullYear()
      const metric = getOrCreateHistoricalMetric(metricsByYear, year)

      if (event.type === "LEAK") {
        metric.leakageEventsCount += 1
        metric.leakedAmountKg += event.refrigerantAddedKg ?? 0
      }

      metric.recoveredAmountKg += getRecoveredAmountForEvent(event)
    })

    installation.inspections?.forEach((inspection) => {
      const year = new Date(inspection.inspectionDate).getFullYear()
      getOrCreateHistoricalMetric(metricsByYear, year).controlsPerformed += 1
    })
  })

  return Array.from(metricsByYear.values()).sort((first, second) => second.year - first.year)
}

function getOrCreateHistoricalMetric(
  metricsByYear: Map<number, PropertyHistoricalMetric>,
  year: number
) {
  const metric =
    metricsByYear.get(year) ?? {
      year,
      leakageEventsCount: 0,
      leakedAmountKg: 0,
      recoveredAmountKg: 0,
      controlsPerformed: 0,
    }

  metricsByYear.set(year, metric)
  return metric
}

function getRecoveredAmountForEvent(event: {
  type: string
  refrigerantAddedKg: number | null
  recoveredAmountKg?: number | null
}) {
  if (event.type === "RECOVERY") {
    return event.recoveredAmountKg ?? event.refrigerantAddedKg ?? 0
  }
  if (event.type === "REFRIGERANT_CHANGE") {
    return event.recoveredAmountKg ?? 0
  }

  return 0
}
