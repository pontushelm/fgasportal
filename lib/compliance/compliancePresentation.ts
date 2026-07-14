import type { ComplianceStatus, InspectionObligationResult } from "@/lib/fgas-calculations"
import type { FgasThresholdBasis } from "@/lib/fgas-rules"

type CompliancePresentationInput = {
  status?: ComplianceStatus
  co2eTon?: number | null
  refrigerantAmountKg?: number | null
  lastInspection?: Date | string | null
  inspectionIntervalMonths?: number | null
  baseInspectionIntervalMonths?: number | null
  hasAdjustedInspectionInterval?: boolean
  hasLeakDetectionSystem?: boolean
  isHermeticallySealed?: boolean
  gwpWarning?: string | null
  legalClassificationWarning?: string | null
  thresholdBasis?: FgasThresholdBasis | null
  thresholdValue?: number | null
  leakCheckReasonCode?: InspectionObligationResult["reasonCode"] | null
  inspectionObligation?: Pick<
    InspectionObligationResult,
    | "intervalMonths"
    | "isInspectionRequired"
    | "reasonCode"
    | "thresholdBasis"
    | "thresholdValue"
  > | null
}

export type CompliancePresentation = {
  statusLabel: string
  title: string
  reason: string
  details: string[]
  intervalLabel: string
  thresholdLabel: string | null
  evaluatedValueLabel: string | null
}

export function createComplianceExplanation(
  input: CompliancePresentationInput
): CompliancePresentation {
  const obligation = input.inspectionObligation
  const reasonCode = obligation?.reasonCode ?? input.leakCheckReasonCode ?? null
  const intervalMonths =
    input.inspectionIntervalMonths ?? obligation?.intervalMonths ?? null
  const thresholdBasis =
    obligation?.thresholdBasis ?? input.thresholdBasis ?? null
  const thresholdValue =
    obligation?.thresholdValue ?? input.thresholdValue ?? null
  const isMissingInput =
    thresholdValue == null &&
    reasonCode !== "UNKNOWN_CLASSIFICATION" &&
    reasonCode !== "OUT_OF_SCOPE"
  const thresholdLabel = formatThreshold(thresholdBasis, thresholdValue)
  const evaluatedValueLabel = formatEvaluatedValue({
    thresholdBasis,
    co2eTon: input.co2eTon,
    refrigerantAmountKg: input.refrigerantAmountKg,
  })

  const statusLabel = getStatusLabel({
    status: input.status,
    reasonCode,
    intervalMonths,
    isMissingInput,
  })
  const reason = buildReason({
    status: input.status,
    reasonCode,
    intervalMonths,
    isMissingInput,
    isHermeticallySealed: input.isHermeticallySealed,
    thresholdBasis,
    thresholdLabel,
    evaluatedValueLabel,
    lastInspection: input.lastInspection,
  })
  const details = buildDetails({
    intervalMonths,
    baseInspectionIntervalMonths: input.baseInspectionIntervalMonths,
    hasAdjustedInspectionInterval: input.hasAdjustedInspectionInterval,
    hasLeakDetectionSystem: input.hasLeakDetectionSystem,
  })

  return {
    statusLabel,
    title: getTitle(statusLabel, reasonCode, isMissingInput),
    reason,
    details,
    intervalLabel: formatInterval(intervalMonths),
    thresholdLabel,
    evaluatedValueLabel,
  }
}

function getStatusLabel({
  status,
  reasonCode,
  intervalMonths,
  isMissingInput,
}: {
  status?: ComplianceStatus
  reasonCode: InspectionObligationResult["reasonCode"] | null
  intervalMonths: number | null
  isMissingInput: boolean
}) {
  if (isMissingInput) return "Kan inte bedömas"
  if (reasonCode === "UNKNOWN_CLASSIFICATION") return "Behöver granskas"
  if (reasonCode === "OUT_OF_SCOPE") return "Ej kontrollpliktig"

  if (status === "OVERDUE") return "Försenad kontroll"
  if (status === "DUE_SOON") return "Kontroll inom 30 dagar"
  if (status === "OK") return "OK"
  if (intervalMonths) return "Kontrollpliktig"

  return "Ej kontrollpliktig"
}

function getTitle(
  statusLabel: string,
  reasonCode: InspectionObligationResult["reasonCode"] | null,
  isMissingInput: boolean
) {
  if (isMissingInput) return "Underlag saknas"
  if (reasonCode === "UNKNOWN_CLASSIFICATION") return "Regelklassificering saknas"

  return statusLabel
}

function buildReason({
  status,
  reasonCode,
  intervalMonths,
  isMissingInput,
  isHermeticallySealed,
  thresholdBasis,
  thresholdLabel,
  evaluatedValueLabel,
  lastInspection,
}: {
  status?: ComplianceStatus
  reasonCode: InspectionObligationResult["reasonCode"] | null
  intervalMonths: number | null
  isMissingInput: boolean
  isHermeticallySealed?: boolean
  thresholdBasis: FgasThresholdBasis | null
  thresholdLabel: string | null
  evaluatedValueLabel: string | null
  lastInspection?: Date | string | null
}) {
  if (isMissingInput) {
    return "Fyll i köldmedium och fyllnadsmängd för att Polar ska kunna avgöra kontrollkravet."
  }

  if (reasonCode === "UNKNOWN_CLASSIFICATION") {
    return "Polar kan inte avgöra kontrollkravet eftersom köldmediets regelklassificering saknas."
  }

  if (reasonCode === "OUT_OF_SCOPE") {
    return "Köldmediet omfattas inte av periodisk F-gasläckagekontroll i Polar."
  }

  if (
    reasonCode === "ANNEX_I_HERMETIC_BELOW_THRESHOLD" ||
    reasonCode === "ANNEX_II_HERMETIC_BELOW_THRESHOLD"
  ) {
    return `Aggregatet är märkt som hermetiskt slutet. Kontroll krävs först från ${thresholdLabel ?? "gällande gränsvärde"}.`
  }

  if (status === "OVERDUE" && lastInspection) {
    return `Senaste kontrollen utfördes ${formatDate(lastInspection)}. Kontrollintervallet är ${formatMonths(intervalMonths ?? 0)}.`
  }

  if (isHermeticallySealed && intervalMonths) {
    return `Aggregatet är hermetiskt slutet men omfattas ändå av läckagekontroll eftersom fyllnadsmängden är minst ${thresholdLabel ?? "gällande gränsvärde"}.`
  }

  if (thresholdBasis === "KG" && intervalMonths) {
    return `För detta köldmedium bedöms kontrollkravet utifrån fyllnadsmängd i kilogram. ${evaluatedValueLabel ? `Fyllnadsmängden är ${evaluatedValueLabel}.` : ""}`.trim()
  }

  if (intervalMonths) {
    return `Aggregatet omfattas av läckagekontroll eftersom fyllnadsmängden motsvarar ${evaluatedValueLabel ?? "minst gällande gränsvärde"}.`
  }

  if (lastInspection) {
    return `Senaste kontrollen utfördes ${formatDate(lastInspection)}.`
  }

  return "Fyllnadsmängden ligger under gränsen för periodisk läckagekontroll."
}

function buildDetails({
  intervalMonths,
  baseInspectionIntervalMonths,
  hasAdjustedInspectionInterval,
  hasLeakDetectionSystem,
}: {
  intervalMonths: number | null
  baseInspectionIntervalMonths?: number | null
  hasAdjustedInspectionInterval?: boolean
  hasLeakDetectionSystem?: boolean
}) {
  const details: string[] = []

  if (
    intervalMonths &&
    hasAdjustedInspectionInterval &&
    baseInspectionIntervalMonths
  ) {
    details.push(
      `Basintervallet är ${formatMonths(baseInspectionIntervalMonths)} och är förlängt eftersom aggregatet har läckagevarningssystem.`
    )
  } else if (hasLeakDetectionSystem && intervalMonths) {
    details.push("Läckagevarningssystem kan påverka kontrollintervallet.")
  }

  return details
}

export function formatInterval(intervalMonths?: number | null) {
  return intervalMonths
    ? `Kontrollintervall: ${formatMonths(intervalMonths)}`
    : "Inget kontrollintervall"
}

export function formatThreshold(
  thresholdBasis?: FgasThresholdBasis | null,
  thresholdValue?: number | null
) {
  if (thresholdValue == null || thresholdBasis === "NONE" || thresholdBasis === "UNKNOWN") {
    return null
  }

  if (thresholdBasis === "KG") return `${formatNumber(thresholdValue)} kg`

  return `${formatNumber(thresholdValue)} ton CO₂e`
}

function formatEvaluatedValue({
  thresholdBasis,
  co2eTon,
  refrigerantAmountKg,
}: {
  thresholdBasis?: FgasThresholdBasis | null
  co2eTon?: number | null
  refrigerantAmountKg?: number | null
}) {
  if (thresholdBasis === "KG" && refrigerantAmountKg != null) {
    return `${formatNumber(refrigerantAmountKg)} kg`
  }

  if (thresholdBasis === "CO2E_TONNES" && co2eTon != null) {
    return `${formatNumber(co2eTon)} ton CO₂e`
  }

  return null
}

function formatMonths(months: number) {
  return `${months} månader`
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
