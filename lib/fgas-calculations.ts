import { getRefrigerant, normalizeRefrigerantCode } from "./refrigerants"
import {
  classifyInspectionStatus,
  type InspectionStatus,
} from "./inspection-status"

export type ComplianceStatus = InspectionStatus

export function calculateCO2e(
  refrigerantType: string,
  refrigerantAmount: number
) {
  const refrigerant = getRefrigerant(refrigerantType)
  const gwp = refrigerant?.gwp ?? null

  const co2eKg = gwp === null ? null : refrigerantAmount * gwp
  const co2eTon = co2eKg === null ? null : co2eKg / 1000

  return {
    gwp,
    co2eKg,
    co2eTon,
    refrigerantCode: refrigerant?.code ?? normalizeRefrigerantCode(refrigerantType),
    isKnownRefrigerant: Boolean(refrigerant),
    warning: refrigerant ? null : "Okänt GWP-värde",
  }
}

export function calculateInspectionInterval(co2eTon: number | null) {
  return calculateInspectionObligation(co2eTon, false).intervalMonths
}

export function calculateInspectionObligation(
  co2eTonnes: number | null | undefined,
  hasLeakDetectionSystem: boolean
) {
  if (co2eTonnes == null || !Number.isFinite(co2eTonnes)) {
    return {
      isInspectionRequired: false,
      intervalMonths: null,
      label: "Kan inte beräknas",
      explanation: "Ange köldmedium och mängd för att beräkna kontrollplikt.",
    }
  }

  if (co2eTonnes < 5) {
    return {
      isInspectionRequired: false,
      intervalMonths: null,
      label: "Ej kontrollpliktigt",
      explanation:
        "Aggregat under 5 ton CO₂e omfattas inte av periodisk läckagekontroll.",
    }
  }

  const baseIntervalMonths =
    co2eTonnes >= 500 ? 3 : co2eTonnes >= 50 ? 6 : 12
  const intervalMonths = hasLeakDetectionSystem
    ? baseIntervalMonths * 2
    : baseIntervalMonths

  return {
    isInspectionRequired: true,
    intervalMonths,
    label: `Kontroll var ${intervalMonths}:e månad`,
    explanation: hasLeakDetectionSystem
      ? "Aggregatet är kontrollpliktigt och läckagevarningssystem förlänger det lagstadgade kontrollintervallet."
      : "Aggregatet är kontrollpliktigt eftersom det innehåller minst 5 ton CO₂e.",
  }
}

export function calculateInstallationCompliance(
  refrigerantType: string,
  refrigerantAmount: number,
  hasLeakDetectionSystem = false,
  lastInspection?: Date | string | null,
  nextInspection?: Date | string | null
) {
  const co2e = calculateCO2e(
    refrigerantType,
    refrigerantAmount
  )
  const baseInspectionIntervalMonths = calculateInspectionInterval(co2e.co2eTon)
  const inspectionObligation = calculateInspectionObligation(
    co2e.co2eTon,
    hasLeakDetectionSystem
  )
  const inspectionIntervalMonths = inspectionObligation.intervalMonths
  const dueStatus = classifyInspectionStatus({
    inspectionRequired: Boolean(inspectionIntervalMonths),
    lastInspection,
    nextInspection
  })

  return {
    gwp: co2e.gwp,
    co2eKg: co2e.co2eKg,
    co2eTon: co2e.co2eTon,
    refrigerantCode: co2e.refrigerantCode,
    isKnownRefrigerant: co2e.isKnownRefrigerant,
    gwpWarning: co2e.warning,
    baseInspectionIntervalMonths,
    inspectionIntervalMonths,
    inspectionObligation,
    hasAdjustedInspectionInterval:
      Boolean(baseInspectionIntervalMonths) && hasLeakDetectionSystem,
    status: dueStatus.status,
    daysUntilDue: dueStatus.daysUntilDue,
  }
}

export function calculateComplianceStatus(
  inspectionIntervalMonths: number | null,
  lastInspection?: Date | string | null,
  nextInspection?: Date | string | null,
  today = new Date()
): { status: ComplianceStatus; daysUntilDue: number | null } {
  return classifyInspectionStatus({
    inspectionRequired: Boolean(inspectionIntervalMonths),
    lastInspection,
    nextInspection,
    today,
  })
}
