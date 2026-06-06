import { describe, expect, it, vi } from "vitest"
import { backfillDocuments } from "@/scripts/backfill-documents"

describe("document backfill script", () => {
  it("creates a document with installation and event links for legacy documents", async () => {
    const legacyDocument = createLegacyInstallationDocument({
      eventId: "event-1",
    })
    const prisma = createFakePrisma({
      installationDocuments: [legacyDocument],
      documentCreateResult: { id: "document-new" },
    })

    const summary = await backfillDocuments(prisma, { dryRun: false })

    expect(summary.documentsCreated).toBe(1)
    expect(summary.installationLinksCreated).toBe(1)
    expect(summary.eventLinksCreated).toBe(1)
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        legacyInstallationDocumentId: "legacy-document-1",
        storageKey:
          "companies/company-1/installations/installation-1/documents/file.pdf",
        category: "SERVICE_REPORT",
      }),
    })
    expect(prisma.documentLink.create).toHaveBeenCalledTimes(2)
    expect(prisma.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-new",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "ATTACHMENT",
        linkedByUserId: "user-1",
      },
    })
    expect(prisma.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-new",
        companyId: "company-1",
        entityType: "INSTALLATION_EVENT",
        entityId: "event-1",
        role: "ATTACHMENT",
        linkedByUserId: "user-1",
      },
    })
  })

  it("is idempotent for already migrated legacy documents and links", async () => {
    const prisma = createFakePrisma({
      installationDocuments: [createLegacyInstallationDocument()],
      existingDocumentsByLegacyId: new Map([
        ["legacy-document-1", { id: "document-existing" }],
      ]),
      existingLinkKeys: new Set([
        "document-existing|INSTALLATION|installation-1|ATTACHMENT",
      ]),
    })

    const summary = await backfillDocuments(prisma, { dryRun: false })

    expect(summary.skippedAlreadyMigrated).toBe(1)
    expect(summary.documentsCreated).toBe(0)
    expect(summary.installationLinksCreated).toBe(0)
    expect(prisma.document.create).not.toHaveBeenCalled()
    expect(prisma.documentLink.create).not.toHaveBeenCalled()
  })

  it("adds a scrap certificate link without duplicating an existing generic document", async () => {
    const legacyDocument = createLegacyInstallationDocument({
      id: "scrap-legacy-document",
      blobPath:
        "companies/company-1/installations/installation-1/scrap/certificate.pdf",
      description: "Skrotningsintyg",
    })
    const prisma = createFakePrisma({
      installationDocuments: [legacyDocument],
      installations: [
        {
          id: "installation-1",
          companyId: "company-1",
          scrappedAt: new Date("2026-01-15"),
          scrappedByCompanyMembershipId: "membership-1",
          scrapCertificateBlobPath:
            "companies/company-1/installations/installation-1/scrap/certificate.pdf",
          scrapCertificateFileName: "Skrotningsintyg.pdf",
          documents: [
            {
              id: "scrap-legacy-document",
              blobPath:
                "companies/company-1/installations/installation-1/scrap/certificate.pdf",
              uploadedById: "user-1",
              sizeBytes: 100,
              createdAt: new Date("2026-01-15"),
            },
          ],
        },
      ],
      existingDocumentsByLegacyId: new Map([
        ["scrap-legacy-document", { id: "document-existing" }],
      ]),
    })

    const summary = await backfillDocuments(prisma, { dryRun: false })

    expect(summary.documentsCreated).toBe(0)
    expect(summary.skippedAlreadyMigrated).toBe(1)
    expect(summary.skippedExistingScrapDocuments).toBe(1)
    expect(summary.scrapCertificateLinksCreated).toBe(1)
    expect(prisma.document.create).not.toHaveBeenCalled()
    expect(prisma.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-existing",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "SCRAP_CERTIFICATE",
        linkedByUserId: "user-1",
      },
    })
  })
})

function createLegacyInstallationDocument(
  overrides: Record<string, unknown> = {}
) {
  return {
    ...createLegacyInstallationDocumentBase(),
    ...overrides,
  }
}

function createLegacyInstallationDocumentBase() {
  return {
    id: "legacy-document-1",
    installationId: "installation-1",
    eventId: null,
    companyId: "company-1",
    uploadedById: "user-1",
    originalFileName: "Service.pdf",
    fileName: "service.pdf",
    blobPath:
      "companies/company-1/installations/installation-1/documents/file.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    documentType: "SERVICE_REPORT" as const,
    description: null,
    createdAt: new Date("2026-01-01"),
  }
}

function createFakePrisma({
  documentCreateResult = { id: "document-new" },
  existingDocumentsByLegacyId = new Map<string, { id: string }>(),
  existingDocumentsByStorageKey = new Map<string, { id: string }>(),
  existingLinkKeys = new Set<string>(),
  installationDocuments = [],
  installations = [],
}: {
  documentCreateResult?: { id: string }
  existingDocumentsByLegacyId?: Map<string, { id: string }>
  existingDocumentsByStorageKey?: Map<string, { id: string }>
  existingLinkKeys?: Set<string>
  installationDocuments?: Array<Record<string, unknown>>
  installations?: Array<{
    id: string
    companyId: string
    scrappedAt: Date | null
    scrappedByCompanyMembershipId: string | null
    scrapCertificateBlobPath: string | null
    scrapCertificateFileName: string | null
    documents: Array<{
      id: string
      blobPath: string
      uploadedById: string
      sizeBytes: number
      createdAt: Date
    }>
  }>
}) {
  let installationDocumentFindManyCalls = 0

  return {
    document: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(documentCreateResult),
      findFirst: vi.fn((args) => {
        const where = args.where
        return Promise.resolve(
          existingDocumentsByStorageKey.get(`${where.companyId}|${where.storageKey}`) ??
            null
        )
      }),
      findUnique: vi.fn((args) =>
        Promise.resolve(
          existingDocumentsByLegacyId.get(
            args.where.legacyInstallationDocumentId
          ) ?? null
        )
      ),
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({ id: "link-new" }),
      findUnique: vi.fn((args) => {
        const where = args.where.documentId_entityType_entityId_role
        const key = `${where.documentId}|${where.entityType}|${where.entityId}|${where.role}`
        return Promise.resolve(existingLinkKeys.has(key) ? { id: "link-existing" } : null)
      }),
    },
    installation: {
      findMany: vi.fn().mockResolvedValue(installations),
    },
    installationDocument: {
      count: vi.fn().mockResolvedValue(installationDocuments.length),
      findMany: vi.fn(() => {
        installationDocumentFindManyCalls += 1
        return Promise.resolve(
          installationDocumentFindManyCalls === 1 ? installationDocuments : []
        )
      }),
    },
  }
}
