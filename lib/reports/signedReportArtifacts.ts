import type { AnnualFgasReportData, AnnualFgasSigningMetadata } from "@/lib/reports/annualFgasReportTypes"
import {
  ANNUAL_FGAS_REPORT_TYPE,
  ANNUAL_FGAS_SNAPSHOT_SCHEMA,
  ANNUAL_FGAS_SNAPSHOT_VERSION,
  buildAnnualFgasReportSnapshotHash,
  type AnnualFgasReportSnapshot,
  type ReportSnapshotHashResult,
  type ReportSnapshotScope,
} from "@/lib/reports/reportSnapshot"

export const ANNUAL_FGAS_TEMPLATE_VERSION = "annual_fgas_template_v1"
export const SIGNED_REPORT_RENDERER_VERSION = "fgasportal_pdf_renderer_v1"

export type SignedReportArtifactPdfMetadata = {
  pdfStorageKey?: string | null
  pdfFileName?: string | null
  pdfContentType?: string
  pdfSizeBytes?: number | null
  pdfSha256?: string | null
}

export type SignedReportArtifactSigner = {
  signedByUserId?: string | null
  signerName: string
  signerEmail?: string | null
  signerRole?: string | null
  signingText?: string | null
  signedAt: Date | string
}

export type SignedReportArtifactDraft = {
  companyId: string
  signedByUserId: string | null
  reportType: typeof ANNUAL_FGAS_REPORT_TYPE
  scopeType: ReportSnapshotScope["type"]
  scopeId: string | null
  scopeLabel: string | null
  reportYear: number | null
  periodStart: Date | null
  periodEnd: Date | null
  signerName: string
  signerEmail: string | null
  signerRole: string | null
  signingText: string | null
  signedAt: Date
  pdfStorageKey: string | null
  pdfFileName: string | null
  pdfContentType: string
  pdfSizeBytes: number | null
  pdfSha256: string | null
  snapshot: unknown
  snapshotSha256: string
  snapshotVersion: number
  snapshotSchema: typeof ANNUAL_FGAS_SNAPSHOT_SCHEMA
  templateVersion: typeof ANNUAL_FGAS_TEMPLATE_VERSION
  rendererVersion: typeof SIGNED_REPORT_RENDERER_VERSION
}

export type BuildAnnualFgasSignedReportArtifactDraftInput = {
  companyId: string
  report: AnnualFgasReportData
  scope: ReportSnapshotScope
  signer: SignedReportArtifactSigner
  signingMetadata?: AnnualFgasSigningMetadata | null
  generatedAt?: Date | string
  pdf?: SignedReportArtifactPdfMetadata
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function buildAnnualFgasSignedReportArtifactDraft({
  companyId,
  report,
  scope,
  signer,
  signingMetadata,
  generatedAt,
  pdf,
}: BuildAnnualFgasSignedReportArtifactDraftInput): {
  artifact: SignedReportArtifactDraft
  snapshotResult: ReportSnapshotHashResult<AnnualFgasReportSnapshot>
} {
  const snapshotResult = buildAnnualFgasReportSnapshotHash(report, {
    generatedAt,
    scope,
    signingMetadata: signingMetadata ?? report.signingMetadata,
  })

  return {
    artifact: {
      companyId,
      signedByUserId: signer.signedByUserId ?? null,
      reportType: ANNUAL_FGAS_REPORT_TYPE,
      scopeType: scope.type,
      scopeId: scope.id ?? null,
      scopeLabel: scope.label ?? null,
      reportYear: scope.reportYear ?? report.reportYear ?? null,
      periodStart: report.period.startDate,
      periodEnd: report.period.endDate,
      signerName: signer.signerName,
      signerEmail: signer.signerEmail ?? null,
      signerRole: signer.signerRole ?? null,
      signingText: signer.signingText ?? null,
      signedAt: toDate(signer.signedAt),
      pdfStorageKey: pdf?.pdfStorageKey ?? null,
      pdfFileName: pdf?.pdfFileName ?? null,
      pdfContentType: pdf?.pdfContentType ?? "application/pdf",
      pdfSizeBytes: pdf?.pdfSizeBytes ?? null,
      pdfSha256: pdf?.pdfSha256 ?? null,
      snapshot: snapshotResult.snapshot,
      snapshotSha256: snapshotResult.snapshotSha256,
      snapshotVersion: ANNUAL_FGAS_SNAPSHOT_VERSION,
      snapshotSchema: ANNUAL_FGAS_SNAPSHOT_SCHEMA,
      templateVersion: ANNUAL_FGAS_TEMPLATE_VERSION,
      rendererVersion: SIGNED_REPORT_RENDERER_VERSION,
    },
    snapshotResult,
  }
}
