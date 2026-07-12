import type {
  ReportRecipient,
  ReportingScope,
  ReportRequirementStatus,
  RegulatoryInstallationRegisterType,
} from "@/lib/regulatory/types"

export const SWEDISH_ANNUAL_REPORT_CO2E_THRESHOLD_TON = 14

export type ReportingReasonCode =
  | "STATIONARY_PROPERTY_AT_OR_ABOVE_THRESHOLD"
  | "STATIONARY_PROPERTY_BELOW_THRESHOLD"
  | "MOBILE_INDIVIDUAL_AT_OR_ABOVE_THRESHOLD"
  | "MOBILE_INDIVIDUAL_BELOW_THRESHOLD"
  | "VESSEL_AT_OR_ABOVE_THRESHOLD"
  | "VESSEL_BELOW_THRESHOLD"
  | "MISSING_REPORTING_CONTEXT"
  | "NOT_IN_REPORTING_SCOPE"
  | "REPORTING_CLASSIFICATION_UNCERTAIN"

export type ReportingRequirementInput = {
  installationRegisterType?: RegulatoryInstallationRegisterType | null
  isInstalledOnVessel?: boolean | null
  co2eTon: number | null | undefined
}

export type ReportingInstallationInput = {
  id: string
  name?: string | null
  equipmentId?: string | null
  installationRegisterType?: RegulatoryInstallationRegisterType | null
  isInstalledOnVessel?: boolean | null
  propertyId?: string | null
  propertyName?: string | null
  propertyMunicipality?: string | null
  mobileUnitId?: string | null
  mobileUnitName?: string | null
  mobileRegistrationOrVehicleNumber?: string | null
  mobileBaseLocation?: string | null
  co2eTon: number | null
}

export type InstallationReportingContext = {
  installation: ReportingInstallationInput
  reportingScope: ReportingScope | null
  reportRecipient: ReportRecipient
  reportGroupId: string | null
  reportGroupLabel: string
  reportReason: ReportingReasonCode | null
  missingContextReason: string | null
}

export type ReportingGroupEvaluation = {
  annualReportRequirement: ReportRequirementStatus
  evaluatedAmount: number | null
  installationIds: string[]
  installations: ReportingInstallationInput[]
  isReportable: boolean | null
  reportGroupId: string
  reportGroupLabel: string
  reportReason: ReportingReasonCode
  reportRecipient: ReportRecipient
  reportingScope: ReportingScope
  thresholdBasis: "CO2E_TONNES"
  thresholdValue: number
}

export type ReportingRequirementEvaluation = Omit<
  ReportingGroupEvaluation,
  "installations"
> & {
  message: string
}

export function evaluateInstallationReportingContext(
  installation: ReportingInstallationInput
): InstallationReportingContext {
  const registerType = installation.installationRegisterType ?? "STATIONARY"

  if (registerType !== "MOBILE") {
    if (!installation.propertyId) {
      return {
        installation,
        missingContextReason: "Stationart aggregat saknar fastighetskoppling.",
        reportGroupId: null,
        reportGroupLabel: installation.propertyName?.trim() || "Fastighet saknas",
        reportReason: "MISSING_REPORTING_CONTEXT",
        reportRecipient: "MUNICIPALITY",
        reportingScope: "PROPERTY",
      }
    }

    return {
      installation,
      missingContextReason: null,
      reportGroupId: `property:${installation.propertyId}`,
      reportGroupLabel:
        installation.propertyName?.trim() || installation.propertyId,
      reportReason: null,
      reportRecipient: "MUNICIPALITY",
      reportingScope: "PROPERTY",
    }
  }

  if (installation.isInstalledOnVessel) {
    const vesselIdentity = getVesselReportingIdentity(installation)

    if (!vesselIdentity) {
      return {
        installation,
        missingContextReason:
          "Utrustning pa fartyg saknar fartygsidentifiering.",
        reportGroupId: null,
        reportGroupLabel: installation.name?.trim() || installation.id,
        reportReason: "MISSING_REPORTING_CONTEXT",
        reportRecipient: "TRANSPORT_AGENCY",
        reportingScope: "VESSEL",
      }
    }

    return {
      installation,
      missingContextReason: null,
      reportGroupId: `vessel:${vesselIdentity.key}`,
      reportGroupLabel: vesselIdentity.label,
      reportReason: null,
      reportRecipient: "TRANSPORT_AGENCY",
      reportingScope: "VESSEL",
    }
  }

  return {
    installation,
    missingContextReason: null,
    reportGroupId: `installation:${installation.id}`,
    reportGroupLabel:
      installation.mobileUnitId?.trim() ||
      installation.mobileRegistrationOrVehicleNumber?.trim() ||
      installation.mobileUnitName?.trim() ||
      installation.equipmentId?.trim() ||
      installation.name?.trim() ||
      installation.id,
    reportReason: null,
    reportRecipient: "MUNICIPALITY",
    reportingScope: "INDIVIDUAL",
  }
}

export function buildReportingGroups(
  installations: ReportingInstallationInput[]
): ReportingGroupEvaluation[] {
  const groups = new Map<
    string,
    {
      installations: ReportingInstallationInput[]
      reportGroupLabel: string
      reportRecipient: ReportRecipient
      reportingScope: ReportingScope
    }
  >()

  for (const installation of installations) {
    const context = evaluateInstallationReportingContext(installation)
    if (!context.reportGroupId || !context.reportingScope) continue

    const existing = groups.get(context.reportGroupId)
    if (existing) {
      existing.installations.push(installation)
    } else {
      groups.set(context.reportGroupId, {
        installations: [installation],
        reportGroupLabel: context.reportGroupLabel,
        reportRecipient: context.reportRecipient,
        reportingScope: context.reportingScope,
      })
    }
  }

  return Array.from(groups.entries())
    .map(([reportGroupId, group]) =>
      evaluateReportingGroup({
        ...group,
        reportGroupId,
      })
    )
    .sort(compareReportingGroups)
}

export function evaluateReportingGroup({
  installations,
  reportGroupId,
  reportGroupLabel,
  reportRecipient,
  reportingScope,
}: {
  installations: ReportingInstallationInput[]
  reportGroupId: string
  reportGroupLabel: string
  reportRecipient: ReportRecipient
  reportingScope: ReportingScope
}): ReportingGroupEvaluation {
  const hasUnknownCo2e = installations.some(
    (installation) => installation.co2eTon === null
  )
  const evaluatedAmount = hasUnknownCo2e
    ? null
    : installations.reduce((sum, installation) => sum + (installation.co2eTon ?? 0), 0)

  if (evaluatedAmount === null) {
    return {
      annualReportRequirement: "UNCERTAIN",
      evaluatedAmount,
      installationIds: installations.map((installation) => installation.id),
      installations,
      isReportable: null,
      reportGroupId,
      reportGroupLabel,
      reportReason: "REPORTING_CLASSIFICATION_UNCERTAIN",
      reportRecipient,
      reportingScope,
      thresholdBasis: "CO2E_TONNES",
      thresholdValue: SWEDISH_ANNUAL_REPORT_CO2E_THRESHOLD_TON,
    }
  }

  const isReportable =
    evaluatedAmount >= SWEDISH_ANNUAL_REPORT_CO2E_THRESHOLD_TON

  return {
    annualReportRequirement: isReportable ? "REQUIRED" : "NOT_REQUIRED",
    evaluatedAmount,
    installationIds: installations.map((installation) => installation.id),
    installations,
    isReportable,
    reportGroupId,
    reportGroupLabel,
    reportReason: getThresholdReason(reportingScope, isReportable),
    reportRecipient,
    reportingScope,
    thresholdBasis: "CO2E_TONNES",
    thresholdValue: SWEDISH_ANNUAL_REPORT_CO2E_THRESHOLD_TON,
  }
}

export function evaluateReportingRequirement({
  installationRegisterType = "STATIONARY",
  isInstalledOnVessel = false,
  co2eTon,
}: ReportingRequirementInput): ReportingRequirementEvaluation {
  const reportingScope =
    installationRegisterType === "MOBILE"
      ? isInstalledOnVessel
        ? "VESSEL"
        : "INDIVIDUAL"
      : "PROPERTY"
  const reportRecipient =
    reportingScope === "VESSEL" ? "TRANSPORT_AGENCY" : "MUNICIPALITY"
  const group = evaluateReportingGroup({
    installations: [
      {
        co2eTon: co2eTon ?? null,
        id: "__single__",
        installationRegisterType,
        isInstalledOnVessel,
      },
    ],
    reportGroupId: "__single__",
    reportGroupLabel: "__single__",
    reportRecipient,
    reportingScope,
  })

  return {
    ...group,
    message: getReportingMessage(group),
  }
}

export function getVesselReportingIdentity(
  installation: Pick<
    ReportingInstallationInput,
    "mobileUnitId" | "mobileRegistrationOrVehicleNumber" | "mobileUnitName"
  >
) {
  const rawIdentity =
    installation.mobileUnitId?.trim() ||
    installation.mobileRegistrationOrVehicleNumber?.trim() ||
    installation.mobileUnitName?.trim()

  if (!rawIdentity) return null

  return {
    key: normalizeReportingIdentity(rawIdentity),
    label: rawIdentity,
  }
}

function getThresholdReason(
  scope: ReportingScope,
  isReportable: boolean
): ReportingReasonCode {
  if (scope === "VESSEL") {
    return isReportable
      ? "VESSEL_AT_OR_ABOVE_THRESHOLD"
      : "VESSEL_BELOW_THRESHOLD"
  }

  if (scope === "INDIVIDUAL") {
    return isReportable
      ? "MOBILE_INDIVIDUAL_AT_OR_ABOVE_THRESHOLD"
      : "MOBILE_INDIVIDUAL_BELOW_THRESHOLD"
  }

  return isReportable
    ? "STATIONARY_PROPERTY_AT_OR_ABOVE_THRESHOLD"
    : "STATIONARY_PROPERTY_BELOW_THRESHOLD"
}

function getReportingMessage(group: ReportingGroupEvaluation) {
  if (group.reportReason === "REPORTING_CLASSIFICATION_UNCERTAIN") {
    return "Rapporteringskravet kan inte bedomas automatiskt for detta underlag."
  }

  return group.isReportable
    ? "Underlaget nar rapporteringsgransen pa minst 14 ton CO2e."
    : "Underlaget ligger under rapporteringsgransen pa minst 14 ton CO2e."
}

function normalizeReportingIdentity(value: string) {
  return value.trim().toLocaleLowerCase("sv").replace(/\s+/g, "-")
}

function compareReportingGroups(
  first: ReportingGroupEvaluation,
  second: ReportingGroupEvaluation
) {
  const scopeRank: Record<ReportingScope, number> = {
    PROPERTY: 0,
    INDIVIDUAL: 1,
    VESSEL: 2,
  }
  const scopeDifference =
    scopeRank[first.reportingScope] - scopeRank[second.reportingScope]

  if (scopeDifference !== 0) return scopeDifference
  return first.reportGroupLabel.localeCompare(second.reportGroupLabel, "sv")
}
