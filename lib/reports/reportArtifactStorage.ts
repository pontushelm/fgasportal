import { del, get, put, type GetBlobResult } from "@vercel/blob"

import { hashBuffer } from "@/lib/reports/hash"

export const SIGNED_REPORT_PDF_CONTENT_TYPE = "application/pdf"
export const SIGNED_REPORT_STORAGE_PROVIDER = "VERCEL_BLOB"
export const SIGNED_REPORT_BLOB_ACCESS = "public"

export class SignedReportArtifactStorageConfigurationError extends Error {
  constructor() {
    super("BLOB_READ_WRITE_TOKEN is required to store signed report artifacts")
    this.name = "SignedReportArtifactStorageConfigurationError"
  }
}

export type SignedReportStorageReportType =
  | "ANNUAL_FGAS"
  | "CLIMATE"
  | "COMPLIANCE"
  | "AUDIT"
  | "CUSTOMER_EXPORT"

export type BuildSignedReportPdfStorageKeyArgs = {
  companyId: string
  artifactId: string
  reportType: SignedReportStorageReportType
  reportYear?: number | null
}

export type BuildSignedReportPdfMetadataArgs = BuildSignedReportPdfStorageKeyArgs & {
  fileName: string
  pdfBuffer: Buffer | Uint8Array
  pdfStoredAt?: Date
}

export type StoreSignedReportPdfArtifactArgs = BuildSignedReportPdfMetadataArgs & {
  token?: string
}

export type SignedReportPdfArtifactStorageMetadata = {
  storageProvider: typeof SIGNED_REPORT_STORAGE_PROVIDER
  pdfStorageKey: string
  pdfFileName: string
  pdfContentType: typeof SIGNED_REPORT_PDF_CONTENT_TYPE
  pdfSizeBytes: number
  pdfSha256: string
  pdfStoredAt: Date
}

const REPORT_TYPE_STORAGE_SEGMENTS: Record<SignedReportStorageReportType, string> = {
  ANNUAL_FGAS: "annual-fgas",
  CLIMATE: "climate",
  COMPLIANCE: "compliance",
  AUDIT: "audit",
  CUSTOMER_EXPORT: "customer-export",
}

function requireBlobToken(token?: string): string {
  const resolvedToken = token ?? process.env.BLOB_READ_WRITE_TOKEN
  if (!resolvedToken) {
    throw new SignedReportArtifactStorageConfigurationError()
  }

  return resolvedToken
}

function safeStorageSegment(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "unknown"
  )
}

function reportYearSegment(reportYear?: number | null): string {
  return typeof reportYear === "number" && Number.isInteger(reportYear)
    ? String(reportYear)
    : "undated"
}

export function buildSignedReportPdfStorageKey({
  companyId,
  artifactId,
  reportType,
  reportYear,
}: BuildSignedReportPdfStorageKeyArgs): string {
  return [
    "companies",
    safeStorageSegment(companyId),
    "reports",
    REPORT_TYPE_STORAGE_SEGMENTS[reportType],
    reportYearSegment(reportYear),
    `${safeStorageSegment(artifactId)}.pdf`,
  ].join("/")
}

export function buildSignedReportPdfArtifactMetadata({
  companyId,
  artifactId,
  reportType,
  reportYear,
  fileName,
  pdfBuffer,
  pdfStoredAt = new Date(),
}: BuildSignedReportPdfMetadataArgs): SignedReportPdfArtifactStorageMetadata {
  return {
    storageProvider: SIGNED_REPORT_STORAGE_PROVIDER,
    pdfStorageKey: buildSignedReportPdfStorageKey({
      companyId,
      artifactId,
      reportType,
      reportYear,
    }),
    pdfFileName: fileName,
    pdfContentType: SIGNED_REPORT_PDF_CONTENT_TYPE,
    pdfSizeBytes: pdfBuffer.byteLength,
    pdfSha256: hashBuffer(pdfBuffer),
    pdfStoredAt,
  }
}

export async function storeSignedReportPdfArtifact({
  token,
  ...args
}: StoreSignedReportPdfArtifactArgs): Promise<SignedReportPdfArtifactStorageMetadata> {
  const resolvedToken = requireBlobToken(token)
  const metadata = buildSignedReportPdfArtifactMetadata(args)
  const pdfBody = Buffer.isBuffer(args.pdfBuffer)
    ? args.pdfBuffer
    : Buffer.from(args.pdfBuffer)

  const blob = await put(metadata.pdfStorageKey, pdfBody, {
    // Current FgasPortal Blob store is public. Signed report access must still be
    // enforced by future authenticated download routes; do not expose blob URLs.
    access: SIGNED_REPORT_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: SIGNED_REPORT_PDF_CONTENT_TYPE,
    token: resolvedToken,
  })

  return {
    ...metadata,
    pdfStorageKey: blob.pathname,
  }
}

export async function deleteSignedReportPdfArtifact(
  storageKey: string,
  options: { token?: string } = {},
): Promise<void> {
  await del(storageKey, {
    token: requireBlobToken(options.token),
  })
}

export async function getSignedReportPdfArtifact(
  storageKey: string,
  options: { token?: string } = {},
): Promise<GetBlobResult | null> {
  return get(storageKey, {
    access: SIGNED_REPORT_BLOB_ACCESS,
    token: requireBlobToken(options.token),
  })
}
