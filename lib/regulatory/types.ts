import type {
  FgasLeakCheckReasonCode,
  FgasThresholdBasis,
} from "@/lib/fgas-rules"
import type { RefrigerantLegalClassification } from "@/lib/refrigerants"

export type RegulatoryInstallationRegisterType = "STATIONARY" | "MOBILE"

export type ReportingScope = "PROPERTY" | "INDIVIDUAL" | "VESSEL"

export type ReportRecipient = "MUNICIPALITY" | "TRANSPORT_AGENCY" | "UNKNOWN"

export type ReportRequirementStatus = "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"

export type RegulatoryReasonCode =
  | FgasLeakCheckReasonCode
  | "STATIONARY_PROPERTY_AT_OR_ABOVE_THRESHOLD"
  | "STATIONARY_PROPERTY_BELOW_THRESHOLD"
  | "MOBILE_INDIVIDUAL_AT_OR_ABOVE_THRESHOLD"
  | "MOBILE_INDIVIDUAL_BELOW_THRESHOLD"
  | "VESSEL_AT_OR_ABOVE_THRESHOLD"
  | "VESSEL_BELOW_THRESHOLD"
  | "MISSING_REPORTING_CONTEXT"
  | "NOT_IN_REPORTING_SCOPE"
  | "REPORTING_CLASSIFICATION_UNCERTAIN"
  | "REGISTER_COMPLETE"
  | "REGISTER_NEEDS_DATA"
  | "REGISTER_RECOMMENDED_REVIEW"

export type RegulatoryDecision = {
  reasonCode: RegulatoryReasonCode
  message: string
}

export type ComplianceRuleBasis = {
  legalClassification: RefrigerantLegalClassification
  thresholdBasis: FgasThresholdBasis
}
