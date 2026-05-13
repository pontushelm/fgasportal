export type DashboardSignedReportRecord = {
  propertyId: string | null
  readinessStatus: string
  blockingIssueCount: number
  reviewWarningCount: number
  createdAt: Date
}

export type DashboardReportProperty = {
  id: string
  name: string
  municipality: string | null
  installedCo2eTon: number
  co2eIsComplete: boolean
}

export type DashboardAnnualReportPropertyStatus =
  DashboardReportProperty & {
    requirementStatus: "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
    signedStatus: "SIGNED" | "NOT_SIGNED" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA" | null
    signedAt: Date | null
    blockingIssueCount: number
    reviewWarningCount: number
    href: string
  }

export type DashboardAnnualReportStatusSummary = {
  year: number
  requiredReports: number
  signedRequiredReports: number
  remainingRequiredReports: number
  uncertainProperties: number
  requiredReportsWithWarnings: number
  requiredReportsRequiringCompletion: number
  properties: DashboardAnnualReportPropertyStatus[]
}

export const ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON = 14

export function buildDashboardAnnualReportStatus({
  properties,
  records,
  year,
}: {
  properties: DashboardReportProperty[]
  records: DashboardSignedReportRecord[]
  year: number
}): DashboardAnnualReportStatusSummary {
  const latestAllPropertiesRecord = records
    .filter((record) => !record.propertyId)
    .sort(compareRecordsByCreatedAtDesc)[0]
  const recordsByProperty = new Map<string, DashboardSignedReportRecord>()

  for (const record of records.filter((item) => item.propertyId)) {
    const propertyId = record.propertyId
    if (!propertyId) continue

    const current = recordsByProperty.get(propertyId)
    if (!current || record.createdAt > current.createdAt) {
      recordsByProperty.set(propertyId, record)
    }
  }

  const propertyStatuses = properties
    .map((property) => {
      const requirementStatus = getAnnualReportRequirementStatus(property)
      const record = recordsByProperty.get(property.id) ?? latestAllPropertiesRecord
      const signedStatus =
        requirementStatus === "NOT_REQUIRED" ? null : getSignedReportStatus(record)
      const blockingIssueCount = record?.blockingIssueCount ?? 0
      const reviewWarningCount = record?.reviewWarningCount ?? 0

      return {
        ...property,
        requirementStatus,
        signedStatus,
        signedAt: record?.createdAt ?? null,
        blockingIssueCount,
        reviewWarningCount,
        href: `/dashboard/reports?propertyId=${encodeURIComponent(property.id)}`,
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name, "sv"))

  const requiredProperties = propertyStatuses.filter(
    (property) => property.requirementStatus === "REQUIRED"
  )
  const signedRequiredReports = requiredProperties.filter(
    (property) => property.signedStatus !== "NOT_SIGNED"
  ).length
  const requiredReportsRequiringCompletion = requiredProperties.filter(
    (property) => property.signedStatus === "MISSING_REQUIRED_DATA"
  ).length
  const requiredReportsWithWarnings = requiredProperties.filter(
    (property) => property.signedStatus === "HAS_WARNINGS"
  ).length

  return {
    year,
    requiredReports: requiredProperties.length,
    signedRequiredReports,
    remainingRequiredReports: requiredProperties.length - signedRequiredReports,
    uncertainProperties: propertyStatuses.filter(
      (property) => property.requirementStatus === "UNCERTAIN"
    ).length,
    requiredReportsWithWarnings,
    requiredReportsRequiringCompletion,
    properties: propertyStatuses,
  }
}

function getAnnualReportRequirementStatus(
  property: DashboardReportProperty
): DashboardAnnualReportPropertyStatus["requirementStatus"] {
  if (!property.co2eIsComplete) return "UNCERTAIN"
  if (property.installedCo2eTon >= ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON) {
    return "REQUIRED"
  }

  return "NOT_REQUIRED"
}

function getSignedReportStatus(
  record: DashboardSignedReportRecord | undefined
): NonNullable<DashboardAnnualReportPropertyStatus["signedStatus"]> {
  if (!record) return "NOT_SIGNED"
  if (record.readinessStatus === "MISSING_REQUIRED_DATA") {
    return "MISSING_REQUIRED_DATA"
  }
  if (
    record.readinessStatus === "HAS_WARNINGS" ||
    record.reviewWarningCount > 0
  ) {
    return "HAS_WARNINGS"
  }

  return "SIGNED"
}

function compareRecordsByCreatedAtDesc(
  first: DashboardSignedReportRecord,
  second: DashboardSignedReportRecord
) {
  return second.createdAt.getTime() - first.createdAt.getTime()
}
