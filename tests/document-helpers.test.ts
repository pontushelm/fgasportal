import { describe, expect, it } from "vitest"
import {
  buildDocumentDownloadMetadata,
  buildFutureDocumentLinksFromInstallationDocument,
  buildFutureDocumentMetadataFromInstallationDocument,
  buildFutureDocumentMetadataFromScrapCertificate,
  buildFutureScrapCertificateLinkMetadata,
  buildGenericDocumentDownloadHref,
  mapInstallationDocumentTypeToDocumentCategory,
} from "@/lib/documents/documentHelpers"

describe("document architecture helpers", () => {
  it("maps legacy installation document types to generic document categories", () => {
    expect(mapInstallationDocumentTypeToDocumentCategory("INSPECTION_REPORT")).toBe(
      "INSPECTION_REPORT"
    )
    expect(mapInstallationDocumentTypeToDocumentCategory("SERVICE_REPORT")).toBe(
      "SERVICE_REPORT"
    )
    expect(mapInstallationDocumentTypeToDocumentCategory("LEAK_REPORT")).toBe(
      "LEAK_REPORT"
    )
    expect(mapInstallationDocumentTypeToDocumentCategory("PHOTO")).toBe("PHOTO")
    expect(mapInstallationDocumentTypeToDocumentCategory("AUTHORITY_DOCUMENT")).toBe(
      "AUTHORITY_DOCUMENT"
    )
    expect(mapInstallationDocumentTypeToDocumentCategory("OTHER")).toBe("OTHER")
  })

  it("builds future document metadata from a legacy installation document", () => {
    const metadata = buildFutureDocumentMetadataFromInstallationDocument({
      id: "legacy-document-1",
      installationId: "installation-1",
      eventId: "event-1",
      companyId: "company-1",
      uploadedById: "user-1",
      originalFileName: "Kontrollrapport 2026.pdf",
      fileName: "kontrollrapport-2026.pdf",
      blobPath:
        "companies/company-1/installations/installation-1/documents/document.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      documentType: "INSPECTION_REPORT",
      description: "Årlig kontroll",
    })

    expect(metadata).toEqual({
      companyId: "company-1",
      uploadedByUserId: "user-1",
      originalFileName: "Kontrollrapport 2026.pdf",
      fileName: "kontrollrapport-2026.pdf",
      contentType: "application/pdf",
      sizeBytes: 1234,
      storageKey:
        "companies/company-1/installations/installation-1/documents/document.pdf",
      category: "INSPECTION_REPORT",
      source: "USER_UPLOAD",
      status: "ACTIVE",
      visibility: "COMPANY_INTERNAL",
      retentionPolicy: "STANDARD",
      description: "Årlig kontroll",
      legacyInstallationDocumentId: "legacy-document-1",
    })
  })

  it("builds installation and event links for legacy event attachments", () => {
    const links = buildFutureDocumentLinksFromInstallationDocument({
      id: "legacy-document-1",
      installationId: "installation-1",
      eventId: "event-1",
      companyId: "company-1",
      uploadedById: "user-1",
      originalFileName: "Service.pdf",
      fileName: "service.pdf",
      blobPath: "companies/company-1/installations/installation-1/documents/service.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      documentType: "SERVICE_REPORT",
      description: null,
    })

    expect(links).toEqual([
      {
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "ATTACHMENT",
        linkedByUserId: "user-1",
      },
      {
        companyId: "company-1",
        entityType: "INSTALLATION_EVENT",
        entityId: "event-1",
        role: "ATTACHMENT",
        linkedByUserId: "user-1",
      },
    ])
  })

  it("builds future authenticated document download metadata", () => {
    expect(buildGenericDocumentDownloadHref("document 1")).toBe(
      "/api/documents/document%201/download"
    )
    expect(
      buildDocumentDownloadMetadata({
        id: "document-1",
        fileName: "rapport.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      })
    ).toEqual({
      id: "document-1",
      fileName: "rapport.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      downloadHref: "/api/documents/document-1/download",
    })
  })

  it("builds retained scrap certificate metadata and link roles", () => {
    expect(
      buildFutureDocumentMetadataFromScrapCertificate({
        installationId: "installation-1",
        companyId: "company-1",
        fileName: "Skrotningsintyg.pdf",
        storageKey:
          "companies/company-1/installations/installation-1/scrap/skrotningsintyg.pdf",
        uploadedByUserId: "owner-1",
      })
    ).toEqual({
      companyId: "company-1",
      uploadedByUserId: "owner-1",
      originalFileName: "Skrotningsintyg.pdf",
      fileName: "Skrotningsintyg.pdf",
      contentType: "application/pdf",
      sizeBytes: 0,
      storageKey:
        "companies/company-1/installations/installation-1/scrap/skrotningsintyg.pdf",
      category: "SCRAP_CERTIFICATE",
      source: "USER_UPLOAD",
      status: "ACTIVE",
      visibility: "COMPANY_INTERNAL",
      retentionPolicy: "RETAINED",
      description: "Skrotningsintyg",
      legacyInstallationDocumentId: null,
    })

    expect(
      buildFutureScrapCertificateLinkMetadata({
        companyId: "company-1",
        installationId: "installation-1",
        linkedByUserId: "owner-1",
      })
    ).toEqual({
      companyId: "company-1",
      entityType: "INSTALLATION",
      entityId: "installation-1",
      role: "SCRAP_CERTIFICATE",
      linkedByUserId: "owner-1",
    })
  })
})
