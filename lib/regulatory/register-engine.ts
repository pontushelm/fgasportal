import type { DataQualityIssueId } from "@/lib/dashboard/data-quality"
import type { RegulatoryInstallationRegisterType } from "@/lib/regulatory/types"

export type RegisterCompletenessInput = {
  installationRegisterType?: RegulatoryInstallationRegisterType | null
  propertyId?: string | null
  refrigerantType?: string | null
  refrigerantAmount?: number | null
  co2eKg?: number | null
  isKnownRefrigerant?: boolean
  leakCheckReasonCode?: string | null
}

export type RegisterCompletenessEvaluation = {
  isComplete: boolean
  issueIds: DataQualityIssueId[]
}

export function evaluateRegisterCompleteness({
  installationRegisterType = "STATIONARY",
  propertyId,
  refrigerantType,
  refrigerantAmount,
  co2eKg,
  isKnownRefrigerant,
  leakCheckReasonCode,
}: RegisterCompletenessInput): RegisterCompletenessEvaluation {
  const issueIds: DataQualityIssueId[] = []

  if (installationRegisterType !== "MOBILE" && !propertyId) {
    issueIds.push("INSTALLATION_MISSING_PROPERTY")
  }

  if (!refrigerantType?.trim()) {
    issueIds.push("INSTALLATION_MISSING_REFRIGERANT")
  }

  if (refrigerantAmount == null || refrigerantAmount <= 0) {
    issueIds.push("INSTALLATION_MISSING_CHARGE")
  }

  if (
    refrigerantType?.trim() &&
    refrigerantAmount != null &&
    refrigerantAmount > 0 &&
    co2eKg === null
  ) {
    issueIds.push("INSTALLATION_MISSING_GWP")
  }

  if (isKnownRefrigerant && leakCheckReasonCode === "UNKNOWN_CLASSIFICATION") {
    issueIds.push("INSTALLATION_UNKNOWN_LEGAL_CLASSIFICATION")
  }

  return {
    isComplete: issueIds.length === 0,
    issueIds,
  }
}
