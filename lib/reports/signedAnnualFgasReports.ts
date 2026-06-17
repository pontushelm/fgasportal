import type { Prisma } from "@prisma/client"
import type {
  AnnualFgasReportData,
  AnnualFgasSigningMetadata,
} from "@/lib/reports/annualFgasReportTypes"

type SignedAnnualReportCreateInput = {
  artifactId?: string | null
  companyId: string
  userId: string | null
  report: AnnualFgasReportData
  reportYear: number
  municipality: string | null
  propertyId: string | null
}

export type SignedAnnualReportHistoryItem = {
  id: string
  artifactId: string | null
  artifactStatus: string | null
  artifactSupersededAt: Date | null
  downloadHref: string | null
  hasStoredPdf: boolean
  legacyMetadataOnly: boolean
  pdfSha256: string | null
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
  artifactId,
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
    artifactId: artifactId ?? undefined,
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
    legacyMetadataOnly: false,
  }
}

export function mapSignedAnnualReportHistoryItem(record: {
  id: string
  artifactId: string | null
  artifact: {
    status: string
    pdfStorageKey: string | null
    pdfSha256: string | null
    supersededAt: Date | null
  } | null
  legacyMetadataOnly: boolean
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
  const hasStoredPdf =
    Boolean(record.artifactId) &&
    Boolean(record.artifact?.pdfStorageKey) &&
    (record.artifact?.status === "STORED" || record.artifact?.status === "SUPERSEDED")

  return {
    id: record.id,
    artifactId: record.artifactId,
    artifactStatus: record.artifact?.status ?? null,
    artifactSupersededAt: record.artifact?.supersededAt ?? null,
    downloadHref:
      hasStoredPdf && record.artifactId
        ? `/api/reports/artifacts/${encodeURIComponent(record.artifactId)}/download`
        : null,
    hasStoredPdf,
    legacyMetadataOnly: record.legacyMetadataOnly || !record.artifactId,
    pdfSha256: record.artifact?.pdfSha256 ?? null,
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
  user?: { email: string } | null
}): AnnualFgasSigningMetadata {
  return {
    signerName: record.signerName,
    signerEmail: record.user?.email ?? null,
    signerRole: record.signerRole,
    signingDate: record.signingDate,
    comment: record.comment,
    attestationText:
      "Rapporten har signerats elektroniskt av inloggad användare i Helm Polar. Signeringshändelsen loggas i systemets aktivitetslogg.",
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
