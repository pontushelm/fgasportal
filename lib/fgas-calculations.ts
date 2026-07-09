import {
  calculateFgasLeakCheckObligation,
  type FgasLeakCheckObligationResult,
} from "./fgas-rules"
import {
  getRefrigerant,
  normalizeRefrigerantCode,
  type RefrigerantLegalClassification,
} from "./refrigerants"
import {
  classifyInspectionStatus,
  type InspectionStatus,
} from "./inspection-status"

export type ComplianceStatus = InspectionStatus

type InspectionObligationOptions = {
  refrigerantType?: string | null
  refrigerantAmountKg?: number | null
  isHermeticallySealed?: boolean
  legalClassification?: RefrigerantLegalClassification
}

export type InspectionObligationResult = FgasLeakCheckObligationResult & {
  isInspectionRequired: boolean
  label: string
  explanation: string
  isHermeticInspectionExempt: boolean
}

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

export function calculateInspectionInterval(
  co2eTon: number | null,
  options: InspectionObligationOptions = {}
) {
  return calculateInspectionObligation(co2eTon, false, options).intervalMonths
}

export function calculateInspectionObligation(
  co2eTonnes: number | null | undefined,
  hasLeakDetectionSystem: boolean,
  options: InspectionObligationOptions = {}
): InspectionObligationResult {
  const obligation = calculateFgasLeakCheckObligation({
    legalClassification: resolveLegalClassification(options),
    co2eTonnes,
    refrigerantAmountKg: options.refrigerantAmountKg,
    isHermeticallySealed: options.isHermeticallySealed ?? false,
    hasLeakDetectionSystem,
  })

  return toInspectionObligationResult(obligation)
}

export function calculateInstallationCompliance(
  refrigerantType: string,
  refrigerantAmount: number,
  hasLeakDetectionSystem = false,
  lastInspection?: Date | string | null,
  nextInspection?: Date | string | null,
  isHermeticallySealed = false
) {
  const co2e = calculateCO2e(refrigerantType, refrigerantAmount)
  const inspectionOptions = {
    refrigerantType,
    refrigerantAmountKg: refrigerantAmount,
    isHermeticallySealed,
  }
  const baseInspectionIntervalMonths = calculateInspectionInterval(
    co2e.co2eTon,
    inspectionOptions
  )
  const inspectionObligation = calculateInspectionObligation(
    co2e.co2eTon,
    hasLeakDetectionSystem,
    inspectionOptions
  )
  const inspectionIntervalMonths = inspectionObligation.intervalMonths
  const dueStatus = classifyInspectionStatus({
    inspectionRequired: Boolean(inspectionIntervalMonths),
    lastInspection,
    nextInspection,
  })

  return {
    gwp: co2e.gwp,
    co2eKg: co2e.co2eKg,
    co2eTon: co2e.co2eTon,
    refrigerantCode: co2e.refrigerantCode,
    isKnownRefrigerant: co2e.isKnownRefrigerant,
    gwpWarning: co2e.warning,
    legalClassification: inspectionObligation.legalClassification,
    thresholdBasis: inspectionObligation.thresholdBasis,
    leakCheckReasonCode: inspectionObligation.reasonCode,
    legalClassificationWarning:
      inspectionObligation.reasonCode === "UNKNOWN_CLASSIFICATION"
        ? inspectionObligation.message
        : null,
    baseInspectionIntervalMonths,
    inspectionIntervalMonths,
    inspectionObligation,
    leakCheckObligation: inspectionObligation,
    isHermeticInspectionExempt:
      inspectionObligation.isHermeticInspectionExempt,
    hasAdjustedInspectionInterval:
      Boolean(baseInspectionIntervalMonths) &&
      hasLeakDetectionSystem &&
      baseInspectionIntervalMonths !== inspectionIntervalMonths,
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

export function isAnnexIiSection1Refrigerant(
  refrigerantType: string | null | undefined
) {
  const refrigerant = getRefrigerant(refrigerantType)
  return refrigerant?.legalClassification === "ANNEX_II_SECTION_1"
}

function resolveLegalClassification(
  options: InspectionObligationOptions
): RefrigerantLegalClassification {
  if (options.legalClassification) return options.legalClassification

  if (options.refrigerantType == null || options.refrigerantType.trim() === "") {
    // Keep the historical CO2e-only helper behavior for callers that have not
    // yet passed a refrigerant. Installation-level calculations always pass one.
    return "ANNEX_I"
  }

  return getRefrigerant(options.refrigerantType)?.legalClassification ?? "UNKNOWN"
}

function toInspectionObligationResult(
  obligation: FgasLeakCheckObligationResult
): InspectionObligationResult {
  return {
    ...obligation,
    isInspectionRequired: obligation.isLeakCheckRequired,
    label: buildInspectionLabel(obligation),
    explanation: obligation.message,
    isHermeticInspectionExempt:
      obligation.reasonCode === "ANNEX_I_HERMETIC_BELOW_THRESHOLD" ||
      obligation.reasonCode === "ANNEX_II_HERMETIC_BELOW_THRESHOLD",
  }
}

function buildInspectionLabel(obligation: FgasLeakCheckObligationResult) {
  if (obligation.intervalMonths) {
    return `Kontroll var ${obligation.intervalMonths}:e månad`
  }

  if (obligation.reasonCode === "UNKNOWN_CLASSIFICATION") {
    return "Behöver kontrolleras"
  }

  if (
    obligation.reasonCode === "ANNEX_I_BELOW_THRESHOLD" ||
    obligation.reasonCode === "ANNEX_I_HERMETIC_BELOW_THRESHOLD" ||
    obligation.reasonCode === "ANNEX_II_BELOW_THRESHOLD" ||
    obligation.reasonCode === "ANNEX_II_HERMETIC_BELOW_THRESHOLD" ||
    obligation.reasonCode === "OUT_OF_SCOPE"
  ) {
    return "Ej kontrollpliktigt"
  }

  return "Kan inte beräknas"
}
