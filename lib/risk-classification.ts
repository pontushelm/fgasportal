export type InstallationRiskLevel = "LOW" | "MEDIUM" | "HIGH"

type InstallationRiskInput = {
  refrigerantType: string
  refrigerantAmount: number
  gwp: number
  hasLeakDetectionSystem: boolean
  leakageEventsCount: number
}

export function calculateInstallationRisk({
  refrigerantAmount,
  gwp,
  hasLeakDetectionSystem,
  leakageEventsCount,
}: InstallationRiskInput): { level: InstallationRiskLevel; score: number } {
  const co2eTon = (refrigerantAmount * gwp) / 1000
  const leakDetectionAdjustment = hasLeakDetectionSystem ? -1 : 0

  if (co2eTon >= 50 || refrigerantAmount >= 50 || leakageEventsCount > 2) {
    return {
      level: "HIGH",
      score: Math.max(3, 4 + leakDetectionAdjustment),
    }
  }

  if (co2eTon >= 10 || refrigerantAmount >= 10 || leakageEventsCount >= 1) {
    return {
      level: "MEDIUM",
      score: Math.max(2, 3 + leakDetectionAdjustment),
    }
  }

  return {
    level: "LOW",
    score: Math.max(1, 1 + leakDetectionAdjustment),
  }
}
