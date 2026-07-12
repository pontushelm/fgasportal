import { evaluateInstallationCompliance } from "@/lib/regulatory/compliance-engine"
import {
  buildReportingGroups,
  type ReportingGroupEvaluation,
} from "@/lib/regulatory/reporting-engine"
import type { AnnualFgasReportGroup } from "@/lib/reports/annualFgasReportTypes"

export type AnnualFgasReportGroupInstallation = {
  id: string
  name: string
  equipmentId?: string | null
  installationRegisterType?: "STATIONARY" | "MOBILE" | null
  isInstalledOnVessel?: boolean | null
  propertyId?: string | null
  propertyName?: string | null
  property?: {
    id: string
    name: string
    municipality: string | null
    propertyDesignation: string | null
  } | null
  mobileUnitId?: string | null
  mobileUnitName?: string | null
  mobileRegistrationOrVehicleNumber?: string | null
  mobileBaseLocation?: string | null
  refrigerantType: string
  refrigerantAmount: number
  hasLeakDetectionSystem: boolean
  isHermeticallySealed: boolean
  lastInspection?: Date | string | null
  nextInspection?: Date | string | null
}

export function buildAnnualFgasReportGroups(
  installations: AnnualFgasReportGroupInstallation[],
  reportingYear: number
): AnnualFgasReportGroup[] {
  const groups = buildReportingGroups(
    installations.map((installation) => {
      const compliance = evaluateInstallationCompliance({
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
        isHermeticallySealed: installation.isHermeticallySealed,
        lastInspection: installation.lastInspection,
        nextInspection: installation.nextInspection,
      })

      return {
        co2eTon: compliance.co2eTon,
        equipmentId: installation.equipmentId,
        id: installation.id,
        installationRegisterType: installation.installationRegisterType,
        isInstalledOnVessel: installation.isInstalledOnVessel,
        mobileBaseLocation: installation.mobileBaseLocation,
        mobileRegistrationOrVehicleNumber:
          installation.mobileRegistrationOrVehicleNumber,
        mobileUnitId: installation.mobileUnitId,
        mobileUnitName: installation.mobileUnitName,
        name: installation.name,
        propertyId: installation.property?.id ?? installation.propertyId ?? null,
        propertyMunicipality: installation.property?.municipality ?? null,
        propertyName:
          installation.property?.name ?? installation.propertyName ?? null,
      }
    })
  )

  return groups.map((group) =>
    mapReportingGroupToAnnualGroup(group, installations, reportingYear)
  )
}

export function findAnnualFgasReportGroup(
  groups: AnnualFgasReportGroup[],
  reportGroupId: string | null | undefined
) {
  if (!reportGroupId) return null
  return groups.find((group) => group.id === reportGroupId) ?? null
}

function mapReportingGroupToAnnualGroup(
  group: ReportingGroupEvaluation,
  installations: AnnualFgasReportGroupInstallation[],
  reportingYear: number
): AnnualFgasReportGroup {
  const groupInstallations = installations.filter((installation) =>
    group.installationIds.includes(installation.id)
  )
  const firstInstallation = groupInstallations[0] ?? null
  const property =
    group.reportingScope === "PROPERTY" && firstInstallation?.property
      ? {
          id: firstInstallation.property.id,
          municipality: firstInstallation.property.municipality,
          name: firstInstallation.property.name,
          propertyDesignation: firstInstallation.property.propertyDesignation,
        }
      : null
  const mobileMetadata =
    group.reportingScope === "INDIVIDUAL" && firstInstallation
      ? {
          installationId: firstInstallation.id,
          mobileBaseLocation: firstInstallation.mobileBaseLocation ?? null,
          mobileRegistrationOrVehicleNumber:
            firstInstallation.mobileRegistrationOrVehicleNumber ?? null,
          mobileUnitId: firstInstallation.mobileUnitId ?? null,
          mobileUnitName: firstInstallation.mobileUnitName ?? null,
        }
      : null

  return {
    evaluatedCo2eTon: group.evaluatedAmount,
    id: group.reportGroupId,
    installationIds: group.installationIds,
    label: group.reportGroupLabel,
    mobileMetadata,
    property,
    recipient: group.reportRecipient,
    reportReason: group.reportReason,
    reportable: group.isReportable,
    reportingScope: group.reportingScope,
    reportingYear,
    vesselMetadata:
      group.reportingScope === "VESSEL"
        ? { vesselIdentifier: group.reportGroupLabel }
        : null,
  }
}
