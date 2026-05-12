import type { Prisma } from "@prisma/client"
import type {
  AnnualFgasReportData,
  AnnualFgasSigningMetadata,
} from "@/lib/reports/annualFgasReportTypes"

type SignedAnnualReportCreateInput = {
  companyId: string
  userId: string | null
  report: AnnualFgasReportData
  reportYear: number
  municipality: string | null
  propertyId: string | null
}

export type SignedAnnualReportHistoryItem = {
  id: string
  reportYear: number
  municipality: string | null
  propertyId: string | null
  propertyName: string | null
  signerName: string
  signerRole: string
  signingDate: Date
  comment: string | null
  readinessStatus: string
  blockingIssueCount: number
  reviewWarningCount: number
  createdAt: Date
  createdBy: {
    name: string
    email: string
  } | null
  scopeSummary: string
  regenerateHref: string
}

export function buildSignedAnnualReportHistoryWhere({
  companyId,
  isContractor,
  userId,
}: {
  companyId: string
  isContractor: boolean
  userId: string
}): Prisma.SignedAnnualFgasReportWhereInput {
  return {
    companyId,
    ...(isContractor ? { userId } : {}),
  }
}

export function buildSignedAnnualReportCreateData({
  companyId,
  municipality,
  propertyId,
  report,
  reportYear,
  userId,
}: SignedAnnualReportCreateInput): Prisma.SignedAnnualFgasReportUncheckedCreateInput | null {
  const signing = report.signingMetadata
  if (!signing) return null

  return {
    companyId,
    userId,
    reportYear,
    municipality,
    propertyId,
    propertyName: propertyId ? report.facility.name : null,
    signerName: signing.signerName,
    signerRole: signing.signerRole,
    signingDate: signing.signingDate,
    comment: signing.comment,
    readinessStatus: report.qualitySummary.status,
    blockingIssueCount: report.qualitySummary.blockingIssueCount,
    reviewWarningCount: report.qualitySummary.warningCount,
  }
}

export function mapSignedAnnualReportHistoryItem(record: {
  id: string
  reportYear: number
  municipality: string | null
  propertyId: string | null
  propertyName: string | null
  signerName: string
  signerRole: string
  signingDate: Date
  comment: string | null
  readinessStatus: string
  blockingIssueCount: number
  reviewWarningCount: number
  createdAt: Date
  user: { name: string; email: string } | null
}): SignedAnnualReportHistoryItem {
  return {
    id: record.id,
    reportYear: record.reportYear,
    municipality: record.municipality,
    propertyId: record.propertyId,
    propertyName: record.propertyName,
    signerName: record.signerName,
    signerRole: record.signerRole,
    signingDate: record.signingDate,
    comment: record.comment,
    readinessStatus: record.readinessStatus,
    blockingIssueCount: record.blockingIssueCount,
    reviewWarningCount: record.reviewWarningCount,
    createdAt: record.createdAt,
    createdBy: record.user,
    scopeSummary: formatSignedReportScope(record),
    regenerateHref: `/api/reports/annual-fgas?historyId=${encodeURIComponent(record.id)}`,
  }
}

export function buildSigningMetadataFromHistory(record: {
  signerName: string
  signerRole: string
  signingDate: Date
  comment: string | null
}): AnnualFgasSigningMetadata {
  return {
    signerName: record.signerName,
    signerRole: record.signerRole,
    signingDate: record.signingDate,
    comment: record.comment,
    attestationText:
      "Jag intygar att uppgifterna i rapporten är granskade utifrån tillgängliga underlag.",
  }
}

export function formatSignedReportScope(record: {
  municipality: string | null
  propertyName: string | null
}) {
  if (record.propertyName) return `Fastighet: ${record.propertyName}`
  if (record.municipality) return `Kommun: ${record.municipality}`
  return "Alla fastigheter"
}
