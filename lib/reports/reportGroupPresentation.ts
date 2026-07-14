import {
  formatReportingRecipientLabel,
  formatReportingScopeLabel,
} from "@/lib/reporting/reportingPresentation"

export type ReportGroupScope = "PROPERTY" | "INDIVIDUAL" | "VESSEL"
export type ReportGroupRecipient = "MUNICIPALITY" | "TRANSPORT_AGENCY" | "UNKNOWN"
export type ReportGroupRequirement = "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
export type ReportGroupSignedStatus = "SIGNED" | "NOT_SIGNED"
export type ReportGroupFilter = "ALL" | ReportGroupScope

export type ReportGroupPresentationInput = {
  annualReportRequirement: ReportGroupRequirement
  blockingIssueCount: number
  installedCo2eTon: number | null
  name: string
  reportRecipient: ReportGroupRecipient
  reportingScope: ReportGroupScope
  reviewWarningCount: number
  signedStatus: ReportGroupSignedStatus
}

export type ReportGroupPresentationStatus =
  | "SIGNED"
  | "NEEDS_COMPLETION"
  | "READY"
  | "NOT_REPORTABLE"
  | "NEEDS_REVIEW"

export function formatReportGroupScopeLabel(scope: ReportGroupScope) {
  return formatReportingScopeLabel(scope)
}

export function formatReportGroupRecipientLabel(recipient: ReportGroupRecipient) {
  return formatReportingRecipientLabel(recipient)
}

export function getReportGroupPresentationStatus(
  group: Pick<
    ReportGroupPresentationInput,
    "annualReportRequirement" | "blockingIssueCount" | "signedStatus"
  >
): ReportGroupPresentationStatus {
  if (group.signedStatus === "SIGNED") return "SIGNED"
  if (group.annualReportRequirement === "UNCERTAIN") return "NEEDS_REVIEW"
  if (group.annualReportRequirement === "NOT_REQUIRED") return "NOT_REPORTABLE"
  if (group.blockingIssueCount > 0) return "NEEDS_COMPLETION"
  return "READY"
}

export function formatReportGroupStatusLabel(
  status: ReportGroupPresentationStatus
) {
  switch (status) {
    case "SIGNED":
      return "Signerad"
    case "NEEDS_COMPLETION":
      return "Underlag behöver kompletteras"
    case "READY":
      return "Rapportpliktig"
    case "NOT_REPORTABLE":
      return "Ej rapportpliktig"
    case "NEEDS_REVIEW":
      return "Bedömning behöver granskas"
  }
}

export function formatReportGroupReadinessSummary(
  group: Pick<
    ReportGroupPresentationInput,
    | "annualReportRequirement"
    | "blockingIssueCount"
    | "reviewWarningCount"
    | "signedStatus"
  >
) {
  const status = getReportGroupPresentationStatus(group)

  if (status === "SIGNED") return "Signerad rapport finns sparad."
  if (status === "NOT_REPORTABLE") {
    return "Ingen årsrapport krävs för den här gruppen enligt nuvarande bedömning."
  }
  if (status === "NEEDS_REVIEW") {
    return "Bedömningen behöver granskas innan rapportering kan avgöras."
  }
  if (group.blockingIssueCount > 0) {
    return `${group.blockingIssueCount} uppgift${
      group.blockingIssueCount === 1 ? "" : "er"
    } behöver kompletteras.`
  }
  if (group.reviewWarningCount > 0) {
    return `Klar för rapport. ${group.reviewWarningCount} uppgift${
      group.reviewWarningCount === 1 ? "" : "er"
    } bör granskas.`
  }
  return "Klar för rapport."
}

export function sortReportGroupCards<T extends ReportGroupPresentationInput>(
  groups: T[]
) {
  return [...groups].sort((first, second) => {
    const firstPriority = getReportGroupSortPriority(first)
    const secondPriority = getReportGroupSortPriority(second)
    if (firstPriority !== secondPriority) return firstPriority - secondPriority
    return first.name.localeCompare(second.name, "sv", { sensitivity: "base" })
  })
}

export function filterReportGroupCards<T extends { reportingScope: ReportGroupScope }>(
  groups: T[],
  filter: ReportGroupFilter
) {
  if (filter === "ALL") return groups
  return groups.filter((group) => group.reportingScope === filter)
}

function getReportGroupSortPriority(group: ReportGroupPresentationInput) {
  const status = getReportGroupPresentationStatus(group)

  switch (status) {
    case "NEEDS_COMPLETION":
      return 1
    case "READY":
      return 2
    case "SIGNED":
      return 3
    case "NOT_REPORTABLE":
      return 4
    case "NEEDS_REVIEW":
      return 5
  }
}
