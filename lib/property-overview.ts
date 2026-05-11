import type { DashboardAction } from "@/lib/actions/generate-actions"
import { calculateCO2e } from "@/lib/fgas-calculations"

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
