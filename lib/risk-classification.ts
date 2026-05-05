export type InstallationRiskLevel = "LOW" | "MEDIUM" | "HIGH"

type InstallationRiskInput = {
  refrigerantType: string
  refrigerantAmount: number
  gwp: number
  hasLeakDetectionSystem: boolean
  leakageEventsCount: number
  isInspectionOverdue?: boolean
}

type InstallationRiskResult = {
  level: InstallationRiskLevel
  score: number
  reasons: string[]
}

const RISK_SCORE: Record<InstallationRiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

export function calculateInstallationRisk({
  refrigerantAmount,
  gwp,
  hasLeakDetectionSystem,
  leakageEventsCount,
  isInspectionOverdue = false,
}: InstallationRiskInput): InstallationRiskResult {
  const co2eTon = (refrigerantAmount * gwp) / 1000
  const reasons: string[] = []

  let climateLevel: InstallationRiskLevel = "LOW"
  if (co2eTon >= 50) {
    climateLevel = "HIGH"
    reasons.push("Hög klimatpåverkan (≥50 ton CO₂e)")
  } else if (co2eTon >= 5) {
    climateLevel = "MEDIUM"
    reasons.push("Kontrollpliktig klimatpåverkan (≥5 ton CO₂e)")
  }

  if (hasLeakDetectionSystem && climateLevel !== "LOW") {
    climateLevel = climateLevel === "HIGH" ? "MEDIUM" : "LOW"
    reasons.push("Läckagevarningssystem minskar CO₂e-baserad risk")
  }

  let operationalLevel: InstallationRiskLevel = "LOW"
  if (isInspectionOverdue) {
    operationalLevel = "HIGH"
    reasons.push("Kontroll är försenad")
  }

  if (leakageEventsCount >= 2) {
    operationalLevel = "HIGH"
    reasons.push("Flera läckage registrerade")
  } else if (leakageEventsCount >= 1) {
    operationalLevel = maxRiskLevel(operationalLevel, "MEDIUM")
    reasons.push("Tidigare läckage registrerat")
  }

  const level = maxRiskLevel(climateLevel, operationalLevel)

  return {
    level,
    score: RISK_SCORE[level],
    reasons: reasons.length ? reasons : ["Inga tydliga riskfaktorer identifierade"],
  }
}

function maxRiskLevel(
  first: InstallationRiskLevel,
  second: InstallationRiskLevel
) {
  return RISK_SCORE[first] >= RISK_SCORE[second] ? first : second
}
