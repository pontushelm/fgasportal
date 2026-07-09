import type { RefrigerantLegalClassification } from "@/lib/refrigerants"

export type FgasThresholdBasis = "CO2E_TONNES" | "KG" | "NONE" | "UNKNOWN"

export type FgasLeakCheckReasonCode =
  | "ANNEX_I_BELOW_THRESHOLD"
  | "ANNEX_I_HERMETIC_BELOW_THRESHOLD"
  | "ANNEX_I_REQUIRES_CHECK"
  | "ANNEX_II_BELOW_THRESHOLD"
  | "ANNEX_II_HERMETIC_BELOW_THRESHOLD"
  | "ANNEX_II_REQUIRES_CHECK"
  | "OUT_OF_SCOPE"
  | "UNKNOWN_CLASSIFICATION"

export type FgasLeakCheckObligationResult = {
  legalClassification: RefrigerantLegalClassification
  thresholdBasis: FgasThresholdBasis
  isLeakCheckRequired: boolean
  intervalMonths: number | null
  reasonCode: FgasLeakCheckReasonCode
  message: string
}

export const UNKNOWN_LEGAL_CLASSIFICATION_MESSAGE =
  "Köldmediets regelklassificering saknas och behöver kontrolleras innan kontrollkrav kan bedömas."

type FgasRule = {
  thresholdBasis: "CO2E_TONNES" | "KG"
  ordinaryThreshold: number
  hermeticThreshold: number
  tiers: Array<{
    minimum: number
    intervalMonths: number
  }>
  belowThresholdReasonCode: FgasLeakCheckReasonCode
  hermeticBelowThresholdReasonCode: FgasLeakCheckReasonCode
  requiresCheckReasonCode: FgasLeakCheckReasonCode
}

export const FGAS_RULES: Record<"ANNEX_I" | "ANNEX_II_SECTION_1", FgasRule> = {
  ANNEX_I: {
    thresholdBasis: "CO2E_TONNES",
    ordinaryThreshold: 5,
    hermeticThreshold: 10,
    tiers: [
      { minimum: 500, intervalMonths: 3 },
      { minimum: 50, intervalMonths: 6 },
      { minimum: 5, intervalMonths: 12 },
    ],
    belowThresholdReasonCode: "ANNEX_I_BELOW_THRESHOLD",
    hermeticBelowThresholdReasonCode: "ANNEX_I_HERMETIC_BELOW_THRESHOLD",
    requiresCheckReasonCode: "ANNEX_I_REQUIRES_CHECK",
  },
  ANNEX_II_SECTION_1: {
    thresholdBasis: "KG",
    ordinaryThreshold: 1,
    hermeticThreshold: 2,
    tiers: [
      { minimum: 100, intervalMonths: 3 },
      { minimum: 10, intervalMonths: 6 },
      { minimum: 1, intervalMonths: 12 },
    ],
    belowThresholdReasonCode: "ANNEX_II_BELOW_THRESHOLD",
    hermeticBelowThresholdReasonCode: "ANNEX_II_HERMETIC_BELOW_THRESHOLD",
    requiresCheckReasonCode: "ANNEX_II_REQUIRES_CHECK",
  },
}

export function calculateFgasLeakCheckObligation({
  legalClassification,
  co2eTonnes,
  refrigerantAmountKg,
  isHermeticallySealed = false,
  hasLeakDetectionSystem = false,
}: {
  legalClassification: RefrigerantLegalClassification
  co2eTonnes?: number | null
  refrigerantAmountKg?: number | null
  isHermeticallySealed?: boolean
  hasLeakDetectionSystem?: boolean
}): FgasLeakCheckObligationResult {
  if (legalClassification === "OUT_OF_SCOPE") {
    return {
      legalClassification,
      thresholdBasis: "NONE",
      isLeakCheckRequired: false,
      intervalMonths: null,
      reasonCode: "OUT_OF_SCOPE",
      message: "Köldmediet omfattas inte av F-gasläckagekontroll i Polar.",
    }
  }

  if (legalClassification === "UNKNOWN") {
    return {
      legalClassification,
      thresholdBasis: "UNKNOWN",
      isLeakCheckRequired: false,
      intervalMonths: null,
      reasonCode: "UNKNOWN_CLASSIFICATION",
      message: UNKNOWN_LEGAL_CLASSIFICATION_MESSAGE,
    }
  }

  const rule = FGAS_RULES[legalClassification]
  const thresholdValue =
    rule.thresholdBasis === "CO2E_TONNES" ? co2eTonnes : refrigerantAmountKg

  if (thresholdValue == null || !Number.isFinite(thresholdValue)) {
    return {
      legalClassification,
      thresholdBasis: rule.thresholdBasis,
      isLeakCheckRequired: false,
      intervalMonths: null,
      reasonCode:
        legalClassification === "ANNEX_I"
          ? "ANNEX_I_BELOW_THRESHOLD"
          : "ANNEX_II_BELOW_THRESHOLD",
      message: "Ange köldmedium och mängd för att beräkna kontrollplikt.",
    }
  }

  const threshold = isHermeticallySealed
    ? rule.hermeticThreshold
    : rule.ordinaryThreshold

  if (thresholdValue < threshold) {
    return {
      legalClassification,
      thresholdBasis: rule.thresholdBasis,
      isLeakCheckRequired: false,
      intervalMonths: null,
      reasonCode: isHermeticallySealed
        ? rule.hermeticBelowThresholdReasonCode
        : rule.belowThresholdReasonCode,
      message: buildBelowThresholdMessage({
        legalClassification,
        thresholdBasis: rule.thresholdBasis,
        threshold,
        isHermeticallySealed,
      }),
    }
  }

  const baseIntervalMonths =
    rule.tiers.find((tier) => thresholdValue >= tier.minimum)?.intervalMonths ?? null
  const intervalMonths =
    baseIntervalMonths && hasLeakDetectionSystem
      ? baseIntervalMonths * 2
      : baseIntervalMonths

  return {
    legalClassification,
    thresholdBasis: rule.thresholdBasis,
    isLeakCheckRequired: true,
    intervalMonths,
    reasonCode: rule.requiresCheckReasonCode,
    message: buildRequiredMessage({
      legalClassification,
      thresholdBasis: rule.thresholdBasis,
      threshold: rule.ordinaryThreshold,
      isHermeticallySealed,
      hasLeakDetectionSystem,
    }),
  }
}

function buildBelowThresholdMessage({
  legalClassification,
  thresholdBasis,
  threshold,
  isHermeticallySealed,
}: {
  legalClassification: RefrigerantLegalClassification
  thresholdBasis: FgasThresholdBasis
  threshold: number
  isHermeticallySealed: boolean
}) {
  if (isHermeticallySealed) {
    return "Undantaget från periodisk läckagekontroll enligt hermetiskt slutet-undantaget."
  }

  if (legalClassification === "ANNEX_II_SECTION_1") {
    return `Aggregat under ${threshold} kg av Annex II avsnitt 1-gas omfattas inte av periodisk läckagekontroll.`
  }

  const unit = thresholdBasis === "CO2E_TONNES" ? "ton CO₂e" : "kg"
  return `Aggregat under ${threshold} ${unit} omfattas inte av periodisk läckagekontroll.`
}

function buildRequiredMessage({
  legalClassification,
  threshold,
  isHermeticallySealed,
  hasLeakDetectionSystem,
}: {
  legalClassification: RefrigerantLegalClassification
  thresholdBasis: FgasThresholdBasis
  threshold: number
  isHermeticallySealed: boolean
  hasLeakDetectionSystem: boolean
}) {
  if (isHermeticallySealed) {
    return "Aggregatet är hermetiskt slutet men omfattas ändå av periodisk läckagekontroll eftersom fyllnadsmängden överstiger gränsvärdet."
  }

  if (hasLeakDetectionSystem) {
    return "Aggregatet är kontrollpliktigt och läckagevarningssystem förlänger det lagstadgade kontrollintervallet."
  }

  if (legalClassification === "ANNEX_II_SECTION_1") {
    return `Aggregatet är kontrollpliktigt eftersom det innehåller minst ${threshold} kg av Annex II avsnitt 1-gas.`
  }

  return `Aggregatet är kontrollpliktigt eftersom det innehåller minst ${threshold} ton CO₂e.`
}
