import { calculateCO2e } from "@/lib/fgas-calculations"

export type Co2eCompletenessSummary = {
  totalCo2eTon: number
  isComplete: boolean
  unknownCo2eInstallations: number
}

export function getCurrentYearRange(today = new Date()) {
  const year = today.getFullYear()

  return {
    startDate: new Date(year, 0, 1),
    endDate: new Date(year + 1, 0, 1),
  }
}

export function isDateInRange(
  value: Date,
  range: { startDate: Date; endDate: Date }
) {
  return value >= range.startDate && value < range.endDate
}

export function summarizeCo2eCompleteness(
  installations: Array<{ co2eTon: number | null }>
): Co2eCompletenessSummary {
  const unknownCo2eInstallations = installations.filter(
    (installation) => installation.co2eTon === null
  ).length

  return {
    totalCo2eTon: installations.reduce(
      (sum, installation) => sum + (installation.co2eTon ?? 0),
      0
    ),
    isComplete: unknownCo2eInstallations === 0,
    unknownCo2eInstallations,
  }
}

export function summarizeLeakageClimateImpact(
  events: Array<{ leakageKg: number | null; refrigerantType: string | null }>
) {
  return events.reduce(
    (summary, event) => {
      if (event.leakageKg === null) {
        summary.unknownEvents += 1
        summary.isComplete = false
        return summary
      }

      const co2e = calculateCO2e(event.refrigerantType ?? "", event.leakageKg).co2eTon
      if (co2e === null) {
        summary.unknownEvents += 1
        summary.isComplete = false
        return summary
      }

      summary.totalCo2eTon += co2e
      return summary
    },
    {
      totalCo2eTon: 0,
      isComplete: true,
      unknownEvents: 0,
    }
  )
}
