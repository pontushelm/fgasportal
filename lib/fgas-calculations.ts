import { getRefrigerant, normalizeRefrigerantCode } from "./refrigerants"
import {
  classifyInspectionStatus,
  type InspectionStatus,
} from "./inspection-status"

export type ComplianceStatus = InspectionStatus

type InspectionObligationOptions = {
  refrigerantType?: string | null
  refrigerantAmountKg?: number | null
  isHermeticallySealed?: boolean
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
) {
  const isHermeticallySealed = options.isHermeticallySealed ?? false
  const annexIiSection1 = isAnnexIiSection1Refrigerant(options.refrigerantType)
  const refrigerantAmountKg = options.refrigerantAmountKg

  if (annexIiSection1) {
    if (
      refrigerantAmountKg == null ||
      !Number.isFinite(refrigerantAmountKg)
    ) {
      return {
        isInspectionRequired: false,
        intervalMonths: null,
        label: "Kan inte beräknas",
        explanation: "Ange köldmedium och mängd för att beräkna kontrollplikt.",
        isHermeticInspectionExempt: false,
      }
    }

    const thresholdKg = isHermeticallySealed ? 2 : 1

    if (refrigerantAmountKg < thresholdKg) {
      return {
        isInspectionRequired: false,
        intervalMonths: null,
        label: "Ej kontrollpliktigt",
        explanation: isHermeticallySealed
          ? "Undantaget från periodisk läckagekontroll enligt hermetiskt slutet-undantaget."
          : "Aggregat under 1 kg av Annex II avsnitt 1-gas omfattas inte av periodisk läckagekontroll.",
        isHermeticInspectionExempt: isHermeticallySealed,
      }
    }

    const baseIntervalMonths =
      refrigerantAmountKg >= 100 ? 3 : refrigerantAmountKg >= 10 ? 6 : 12
    const intervalMonths = hasLeakDetectionSystem
      ? baseIntervalMonths * 2
      : baseIntervalMonths

    return {
      isInspectionRequired: true,
      intervalMonths,
      label: `Kontroll var ${intervalMonths}:e månad`,
      explanation: isHermeticallySealed
        ? "Aggregatet är hermetiskt slutet men omfattas ändå av periodisk läckagekontroll eftersom fyllnadsmängden överstiger gränsvärdet."
        : "Aggregatet är kontrollpliktigt eftersom det innehåller minst 1 kg av Annex II avsnitt 1-gas.",
      isHermeticInspectionExempt: false,
    }
  }

  if (co2eTonnes == null || !Number.isFinite(co2eTonnes)) {
    return {
      isInspectionRequired: false,
      intervalMonths: null,
      label: "Kan inte beräknas",
      explanation: "Ange köldmedium och mängd för att beräkna kontrollplikt.",
      isHermeticInspectionExempt: false,
    }
  }

  const thresholdCo2eTonnes = isHermeticallySealed ? 10 : 5

  if (co2eTonnes < thresholdCo2eTonnes) {
    return {
      isInspectionRequired: false,
      intervalMonths: null,
      label: "Ej kontrollpliktigt",
      explanation: isHermeticallySealed
        ? "Undantaget från periodisk läckagekontroll enligt hermetiskt slutet-undantaget."
        : "Aggregat under 5 ton CO₂e omfattas inte av periodisk läckagekontroll.",
      isHermeticInspectionExempt: isHermeticallySealed,
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
    explanation: isHermeticallySealed
      ? "Aggregatet är hermetiskt slutet men omfattas ändå av periodisk läckagekontroll eftersom fyllnadsmängden överstiger gränsvärdet."
      : hasLeakDetectionSystem
        ? "Aggregatet är kontrollpliktigt och läckagevarningssystem förlänger det lagstadgade kontrollintervallet."
        : "Aggregatet är kontrollpliktigt eftersom det innehåller minst 5 ton CO₂e.",
    isHermeticInspectionExempt: false,
  }
}

export function calculateInstallationCompliance(
  refrigerantType: string,
  refrigerantAmount: number,
  hasLeakDetectionSystem = false,
  lastInspection?: Date | string | null,
  nextInspection?: Date | string | null,
  isHermeticallySealed = false
) {
  const co2e = calculateCO2e(
    refrigerantType,
    refrigerantAmount
  )
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
    isHermeticInspectionExempt:
      inspectionObligation.isHermeticInspectionExempt,
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

export function isAnnexIiSection1Refrigerant(
  refrigerantType: string | null | undefined
) {
  const refrigerant = getRefrigerant(refrigerantType)
  return refrigerant?.category === "HFO" || refrigerant?.category === "HFO blend"
}
