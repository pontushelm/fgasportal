import type {
  ReportRecipient,
  ReportRequirementStatus,
  ReportingScope,
} from "@/lib/regulatory/types"
import type { ReportingReasonCode } from "@/lib/regulatory/reporting-engine"

export type ReportingPresentationInput = {
  annualReportRequirement?: ReportRequirementStatus | null
  evaluatedAmount?: number | null
  evaluatedCo2eTon?: number | null
  installedCo2eTon?: number | null
  isReportable?: boolean | null
  reportRecipient?: ReportRecipient | null
  recipient?: ReportRecipient | null
  reportReason?: ReportingReasonCode | string | null
  reportable?: boolean | null
  reportingScope?: ReportingScope | null
  thresholdValue?: number | null
}

export type ReportingPresentation = {
  statusLabel: string
  title: string
  reason: string
  recipientLabel: string
  recipientExplanation: string
  scopeLabel: string
  thresholdLabel: string
  evaluatedValueLabel: string
  details: string[]
}

const DEFAULT_REPORTING_THRESHOLD_TON = 14

export function createReportingExplanation(
  input: ReportingPresentationInput
): ReportingPresentation {
  const scope = input.reportingScope ?? null
  const recipient = input.reportRecipient ?? input.recipient ?? "UNKNOWN"
  const evaluatedValue =
    input.evaluatedAmount ??
    input.evaluatedCo2eTon ??
    input.installedCo2eTon ??
    null
  const thresholdValue = input.thresholdValue ?? DEFAULT_REPORTING_THRESHOLD_TON
  const requirement = resolveRequirement(input)
  const statusLabel = formatReportingRequirementLabel(requirement)
  const scopeLabel = formatReportingScopeLabel(scope)
  const recipientLabel = formatReportingRecipientLabel(recipient)
  const thresholdLabel = `${formatNumber(thresholdValue)} ton CO₂e`
  const evaluatedValueLabel =
    evaluatedValue == null
      ? "Kan inte beräknas"
      : `${formatNumber(evaluatedValue)} ton CO₂e`
  const reason = buildReason({
    evaluatedValueLabel,
    reasonCode: input.reportReason ?? null,
    requirement,
    scope,
    thresholdLabel,
  })

  return {
    details: buildDetails({
      evaluatedValueLabel,
      recipient,
      scope,
      thresholdLabel,
    }),
    evaluatedValueLabel,
    reason,
    recipientExplanation: getRecipientExplanation(recipient),
    recipientLabel,
    scopeLabel,
    statusLabel,
    thresholdLabel,
    title: buildTitle({ requirement, scope }),
  }
}

export function formatReportingScopeLabel(scope?: ReportingScope | null) {
  switch (scope) {
    case "PROPERTY":
      return "Stationär anläggning"
    case "INDIVIDUAL":
      return "Mobilt aggregat"
    case "VESSEL":
      return "Fartyg"
    default:
      return "Omfattning behöver kontrolleras"
  }
}

export function formatReportingRecipientLabel(
  recipient?: ReportRecipient | null
) {
  switch (recipient) {
    case "MUNICIPALITY":
      return "Kommun"
    case "TRANSPORT_AGENCY":
      return "Transportstyrelsen"
    default:
      return "Mottagare behöver kontrolleras"
  }
}

export function formatReportingRequirementLabel(
  requirement: ReportRequirementStatus
) {
  switch (requirement) {
    case "REQUIRED":
      return "Rapportpliktig"
    case "NOT_REQUIRED":
      return "Ej rapportpliktig"
    case "UNCERTAIN":
      return "Bedömning behöver granskas"
  }
}

export function getRecipientExplanation(recipient?: ReportRecipient | null) {
  switch (recipient) {
    case "MUNICIPALITY":
      return "Rapportering sker normalt till kommunens miljökontor."
    case "TRANSPORT_AGENCY":
      return "Utrustning på fartyg rapporteras till Transportstyrelsen."
    default:
      return "Mottagare kan inte avgöras automatiskt och behöver granskas."
  }
}

function resolveRequirement(
  input: ReportingPresentationInput
): ReportRequirementStatus {
  if (input.annualReportRequirement) return input.annualReportRequirement

  const reportable = input.reportable ?? input.isReportable
  if (reportable === true) return "REQUIRED"
  if (reportable === false) return "NOT_REQUIRED"
  return "UNCERTAIN"
}

function buildTitle({
  requirement,
  scope,
}: {
  requirement: ReportRequirementStatus
  scope: ReportingScope | null
}) {
  if (requirement === "UNCERTAIN") return "Rapporteringskrav behöver granskas"

  if (scope === "INDIVIDUAL") {
    return requirement === "REQUIRED"
      ? "Årsrapport krävs för aggregatet"
      : "Aggregatet ligger under rapportgränsen"
  }

  if (scope === "VESSEL") {
    return requirement === "REQUIRED"
      ? "Årsrapport krävs för fartygsgruppen"
      : "Fartygsgruppen ligger under rapportgränsen"
  }

  return requirement === "REQUIRED"
    ? "Årsrapport krävs för fastigheten"
    : "Fastigheten ligger under rapportgränsen"
}

function buildReason({
  evaluatedValueLabel,
  reasonCode,
  requirement,
  scope,
  thresholdLabel,
}: {
  evaluatedValueLabel: string
  reasonCode: ReportingPresentationInput["reportReason"]
  requirement: ReportRequirementStatus
  scope: ReportingScope | null
  thresholdLabel: string
}) {
  if (
    requirement === "UNCERTAIN" ||
    reasonCode === "REPORTING_CLASSIFICATION_UNCERTAIN" ||
    reasonCode === "MISSING_REPORTING_CONTEXT"
  ) {
    return "Polar kan inte avgöra rapporteringskravet automatiskt eftersom underlaget saknar uppgifter som behövs för bedömningen."
  }

  const scopeText =
    scope === "INDIVIDUAL"
      ? "det mobila aggregatet"
      : scope === "VESSEL"
        ? "fartygsgruppen"
        : "fastigheten"

  if (requirement === "REQUIRED") {
    return `Den utvärderade mängden för ${scopeText} är ${evaluatedValueLabel}, vilket är minst rapportgränsen ${thresholdLabel}.`
  }

  return `Den utvärderade mängden för ${scopeText} är ${evaluatedValueLabel}, vilket är under rapportgränsen ${thresholdLabel}.`
}

function buildDetails({
  evaluatedValueLabel,
  recipient,
  scope,
  thresholdLabel,
}: {
  evaluatedValueLabel: string
  recipient: ReportRecipient
  scope: ReportingScope | null
  thresholdLabel: string
}) {
  return [
    `Omfattning: ${formatReportingScopeLabel(scope)}.`,
    `Utvärderat värde: ${evaluatedValueLabel}.`,
    `Rapportgräns: ${thresholdLabel}.`,
    getRecipientExplanation(recipient),
  ]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
