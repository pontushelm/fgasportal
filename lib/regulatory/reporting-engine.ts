import { ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON } from "@/lib/dashboard/annual-report-status"
import type {
  ReportRecipient,
  ReportingScope,
  ReportRequirementStatus,
  RegulatoryInstallationRegisterType,
} from "@/lib/regulatory/types"

export type ReportingRequirementInput = {
  installationRegisterType?: RegulatoryInstallationRegisterType | null
  co2eTon: number | null | undefined
}

export type ReportingRequirementEvaluation = {
  annualReportRequirement: ReportRequirementStatus
  isReportable: boolean | null
  reportRecipient: ReportRecipient
  reportingScope: ReportingScope
  thresholdTonCo2e: number
  reasonCode:
    | "REPORTING_REQUIRED"
    | "REPORTING_NOT_REQUIRED"
    | "REPORTING_CO2E_UNKNOWN"
  message: string
}

export function evaluateReportingRequirement({
  installationRegisterType = "STATIONARY",
  co2eTon,
}: ReportingRequirementInput): ReportingRequirementEvaluation {
  const reportingScope =
    installationRegisterType === "MOBILE" ? "INDIVIDUAL" : "PROPERTY"
  // TODO(PR2): Resolve mobile reporting recipient and aggregation rules.
  // This preserves the current application behavior while exposing the boundary.
  const reportRecipient =
    installationRegisterType === "MOBILE" ? "UNKNOWN" : "MUNICIPALITY"

  if (co2eTon == null || !Number.isFinite(co2eTon)) {
    return {
      annualReportRequirement: "UNCERTAIN",
      isReportable: null,
      message: "CO2e kan inte beraknas for rapporteringsbedomning.",
      reasonCode: "REPORTING_CO2E_UNKNOWN",
      reportRecipient,
      reportingScope,
      thresholdTonCo2e: ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON,
    }
  }

  const isReportable = co2eTon >= ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON

  return {
    annualReportRequirement: isReportable ? "REQUIRED" : "NOT_REQUIRED",
    isReportable,
    message: isReportable
      ? "Installerad CO2e uppfyller nuvarande arsrapportrutin."
      : "Installerad CO2e ligger under nuvarande arsrapportrutin.",
    reasonCode: isReportable
      ? "REPORTING_REQUIRED"
      : "REPORTING_NOT_REQUIRED",
    reportRecipient,
    reportingScope,
    thresholdTonCo2e: ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON,
  }
}
