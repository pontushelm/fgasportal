import { describe, expect, it } from "vitest"

import {
  SIGNED_REPORT_BLOB_ACCESS,
  SIGNED_REPORT_PDF_CONTENT_TYPE,
  SIGNED_REPORT_STORAGE_PROVIDER,
  SignedReportArtifactStorageConfigurationError,
  buildSignedReportPdfArtifactMetadata,
  buildSignedReportPdfStorageKey,
  storeSignedReportPdfArtifact,
} from "@/lib/reports/reportArtifactStorage"

describe("signed report artifact storage helpers", () => {
  it("uses the current app Blob store access mode", () => {
    expect(SIGNED_REPORT_BLOB_ACCESS).toBe("public")
  })

  it("builds stable tenant-scoped annual F-gas PDF storage keys", () => {
    const key = buildSignedReportPdfStorageKey({
      companyId: "company-123",
      artifactId: "artifact-456",
      reportType: "ANNUAL_FGAS",
      reportYear: 2025,
    })

    expect(key).toBe("companies/company-123/reports/annual-fgas/2025/artifact-456.pdf")
  })

  it("normalizes unsafe storage key segments", () => {
    const key = buildSignedReportPdfStorageKey({
      companyId: "Kund AB / Stockholm",
      artifactId: "Rapport #1",
      reportType: "CUSTOMER_EXPORT",
      reportYear: null,
    })

    expect(key).toBe("companies/kund-ab-stockholm/reports/customer-export/undated/rapport-1.pdf")
  })

  it("builds PDF metadata with size, content type, provider and SHA-256 hash", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\nsigned report", "utf8")
    const metadata = buildSignedReportPdfArtifactMetadata({
      companyId: "company-123",
      artifactId: "artifact-456",
      reportType: "ANNUAL_FGAS",
      reportYear: 2025,
      fileName: "arsrapport-2025.pdf",
      pdfBuffer,
      pdfStoredAt: new Date("2026-01-01T00:00:00.000Z"),
    })

    expect(metadata).toEqual({
      storageProvider: SIGNED_REPORT_STORAGE_PROVIDER,
      pdfStorageKey: "companies/company-123/reports/annual-fgas/2025/artifact-456.pdf",
      pdfFileName: "arsrapport-2025.pdf",
      pdfContentType: SIGNED_REPORT_PDF_CONTENT_TYPE,
      pdfSizeBytes: pdfBuffer.byteLength,
      pdfSha256: "c3733018bbb22e10173641f6568a15d2fb378d45f67e59d3d189418d3406f5e8",
      pdfStoredAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  })

  it("fails clearly when Blob storage is not configured", async () => {
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.BLOB_READ_WRITE_TOKEN

    try {
      await expect(
        storeSignedReportPdfArtifact({
          companyId: "company-123",
          artifactId: "artifact-456",
          reportType: "ANNUAL_FGAS",
          reportYear: 2025,
          fileName: "arsrapport-2025.pdf",
          pdfBuffer: Buffer.from("%PDF-1.4\nsigned report", "utf8"),
        })
      ).rejects.toBeInstanceOf(SignedReportArtifactStorageConfigurationError)
    } finally {
      if (originalToken) {
        process.env.BLOB_READ_WRITE_TOKEN = originalToken
      }
    }
  })
})
