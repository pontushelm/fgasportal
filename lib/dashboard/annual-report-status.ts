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
}

export type DashboardAnnualReportPropertyStatus =
  DashboardReportProperty & {
    status: "SIGNED" | "NOT_SIGNED" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA"
    signedAt: Date | null
    blockingIssueCount: number
    reviewWarningCount: number
    href: string
  }

export type DashboardAnnualReportStatusSummary = {
  year: number
  expectedReports: number
  signedReports: number
  remainingReports: number
  reportsWithWarnings: number
  reportsRequiringCompletion: number
  properties: DashboardAnnualReportPropertyStatus[]
}

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
      const record = recordsByProperty.get(property.id) ?? latestAllPropertiesRecord
      const blockingIssueCount = record?.blockingIssueCount ?? 0
      const reviewWarningCount = record?.reviewWarningCount ?? 0

      return {
        ...property,
        status: getSignedReportStatus(record),
        signedAt: record?.createdAt ?? null,
        blockingIssueCount,
        reviewWarningCount,
        href: `/dashboard/reports?propertyId=${encodeURIComponent(property.id)}`,
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name, "sv"))

  const signedReports = propertyStatuses.filter(
    (property) => property.status !== "NOT_SIGNED"
  ).length
  const reportsRequiringCompletion = propertyStatuses.filter(
    (property) => property.status === "MISSING_REQUIRED_DATA"
  ).length
  const reportsWithWarnings = propertyStatuses.filter(
    (property) => property.status === "HAS_WARNINGS"
  ).length

  return {
    year,
    expectedReports: propertyStatuses.length,
    signedReports,
    remainingReports: propertyStatuses.length - signedReports,
    reportsWithWarnings,
    reportsRequiringCompletion,
    properties: propertyStatuses,
  }
}

function getSignedReportStatus(
  record: DashboardSignedReportRecord | undefined
): DashboardAnnualReportPropertyStatus["status"] {
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
