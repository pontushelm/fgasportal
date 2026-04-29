import { REFRIGERANT_GWP } from "./refrigerants"
import {
  classifyInspectionStatus,
  type InspectionStatus,
} from "./inspection-status"

export type ComplianceStatus = InspectionStatus

export function calculateCO2e(
  refrigerantType: string,
  refrigerantAmount: number
) {
  const gwp = REFRIGERANT_GWP[refrigerantType] || 0

  const co2eKg = refrigerantAmount * gwp
  const co2eTon = co2eKg / 1000

  return {
    gwp,
    co2eKg,
    co2eTon,
  }
}

export function calculateInspectionInterval(co2eTon: number) {
  if (co2eTon >= 500) return 3
  if (co2eTon >= 50) return 6
  if (co2eTon >= 5) return 12
  return null
}

export function calculateInstallationCompliance(
  refrigerantType: string,
  refrigerantAmount: number,
  hasLeakDetectionSystem = false,
  lastInspection?: Date | string | null,
  nextInspection?: Date | string | null
) {
  const { gwp, co2eKg, co2eTon } = calculateCO2e(
    refrigerantType,
    refrigerantAmount
  )
  const baseInspectionIntervalMonths = calculateInspectionInterval(co2eTon)
  const inspectionIntervalMonths =
    baseInspectionIntervalMonths && hasLeakDetectionSystem
      ? baseInspectionIntervalMonths * 2
      : baseInspectionIntervalMonths
  const dueStatus = classifyInspectionStatus({
    inspectionRequired: Boolean(inspectionIntervalMonths),
    lastInspection,
    nextInspection
  })

  return {
    gwp,
    co2eKg,
    co2eTon,
    baseInspectionIntervalMonths,
    inspectionIntervalMonths,
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
