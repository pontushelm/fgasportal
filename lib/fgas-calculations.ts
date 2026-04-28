import { REFRIGERANT_GWP } from "./refrigerants"

export type ComplianceStatus =
  | "OK"
  | "DUE_SOON"
  | "OVERDUE"
  | "NOT_REQUIRED"
  | "NOT_INSPECTED"

const DUE_SOON_DAYS = 30
const MS_PER_DAY = 1000 * 60 * 60 * 24

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
  const dueStatus = calculateComplianceStatus(
    inspectionIntervalMonths,
    nextInspection
  )

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
  nextInspection?: Date | string | null,
  today = new Date()
): { status: ComplianceStatus; daysUntilDue: number | null } {
  if (!inspectionIntervalMonths) {
    return {
      status: "NOT_REQUIRED",
      daysUntilDue: null,
    }
  }

  if (!nextInspection) {
    return {
      status: "NOT_INSPECTED",
      daysUntilDue: null,
    }
  }

  const dueDate = startOfDay(new Date(nextInspection))
  const currentDate = startOfDay(today)
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - currentDate.getTime()) / MS_PER_DAY
  )

  if (daysUntilDue < 0) {
    return {
      status: "OVERDUE",
      daysUntilDue,
    }
  }

  if (daysUntilDue <= DUE_SOON_DAYS) {
    return {
      status: "DUE_SOON",
      daysUntilDue,
    }
  }

  return {
    status: "OK",
    daysUntilDue,
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
