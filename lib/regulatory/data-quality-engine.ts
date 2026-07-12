import {
  buildDataQualityReport,
  type DataQualityCertificationInput,
  type DataQualityInstallationInput,
  type DataQualityPropertyInput,
  type DataQualityReport,
} from "@/lib/dashboard/data-quality"

export type DataQualityEvaluationInput = {
  installations: DataQualityInstallationInput[]
  properties: DataQualityPropertyInput[]
  servicePartnerCertifications?: DataQualityCertificationInput[]
  technicianCertifications?: DataQualityCertificationInput[]
}

export function evaluateDataQuality(
  input: DataQualityEvaluationInput
): DataQualityReport {
  return buildDataQualityReport(input)
}
