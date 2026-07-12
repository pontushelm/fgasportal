import {
  calculateInstallationCompliance,
  type InspectionObligationResult,
} from "@/lib/fgas-calculations"

export type InstallationComplianceInput = {
  refrigerantType: string
  refrigerantAmount: number
  hasLeakDetectionSystem?: boolean
  lastInspection?: Date | string | null
  nextInspection?: Date | string | null
  isHermeticallySealed?: boolean
}

export type InstallationComplianceEvaluation = ReturnType<
  typeof calculateInstallationCompliance
> & {
  isLeakCheckRequired: boolean
  intervalMonths: number | null
  reasonCode: InspectionObligationResult["reasonCode"]
  message: string
}

export function evaluateInstallationCompliance({
  refrigerantType,
  refrigerantAmount,
  hasLeakDetectionSystem = false,
  lastInspection = null,
  nextInspection = null,
  isHermeticallySealed = false,
}: InstallationComplianceInput): InstallationComplianceEvaluation {
  const compliance = calculateInstallationCompliance(
    refrigerantType,
    refrigerantAmount,
    hasLeakDetectionSystem,
    lastInspection,
    nextInspection,
    isHermeticallySealed
  )

  return {
    ...compliance,
    intervalMonths: compliance.inspectionIntervalMonths,
    isLeakCheckRequired: compliance.inspectionObligation.isLeakCheckRequired,
    message: compliance.inspectionObligation.message,
    reasonCode: compliance.inspectionObligation.reasonCode,
  }
}

export function isPeriodicLeakCheckRequired(
  evaluation: Pick<InstallationComplianceEvaluation, "intervalMonths">
) {
  return Boolean(evaluation.intervalMonths)
}
