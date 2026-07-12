import type {
  FgasLeakCheckReasonCode,
  FgasThresholdBasis,
} from "@/lib/fgas-rules"
import type { RefrigerantLegalClassification } from "@/lib/refrigerants"

export type RegulatoryInstallationRegisterType = "STATIONARY" | "MOBILE"

export type ReportingScope = "PROPERTY" | "INDIVIDUAL"

export type ReportRecipient = "MUNICIPALITY" | "TRANSPORT_AGENCY" | "UNKNOWN"

export type ReportRequirementStatus = "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"

export type RegulatoryReasonCode =
  | FgasLeakCheckReasonCode
  | "REPORTING_REQUIRED"
  | "REPORTING_NOT_REQUIRED"
  | "REPORTING_CO2E_UNKNOWN"
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
