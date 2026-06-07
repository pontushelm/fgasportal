import { describe, expect, it, vi } from "vitest"
import { backfillScrapCertificates } from "@/scripts/backfill-scrap-certificates"

describe("scrap certificate backfill script", () => {
  it("creates a retained generic document and scrap certificate link", async () => {
    const installation = createScrappedInstallation()
    const prisma = createFakePrisma({
      installations: [installation],
      documentCreateResult: { id: "document-new" },
    })

    const summary = await backfillScrapCertificates(prisma, { dryRun: false })

    expect(summary.installationsScanned).toBe(1)
    expect(summary.legacyCertificatesFound).toBe(1)
    expect(summary.genericCertificatesCreated).toBe(1)
    expect(summary.linksCreated).toBe(1)
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        uploadedByUserId: "user-1",
        originalFileName: "Skrotningsintyg.pdf",
        storageKey:
          "companies/company-1/installations/installation-1/scrap/certificate.pdf",
        category: "SCRAP_CERTIFICATE",
        source: "USER_UPLOAD",
        status: "ACTIVE",
        retentionPolicy: "RETAINED",
        legacyInstallationDocumentId: "legacy-scrap-document-1",
      }),
    })
    expect(prisma.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-new",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "SCRAP_CERTIFICATE",
        linkedByUserId: "user-1",
      },
    })
  })

  it("is idempotent when a scrap certificate link already exists", async () => {
    const installation = createScrappedInstallation()
    const prisma = createFakePrisma({
      installations: [installation],
      existingLinkedDocumentByInstallationId: new Map([
        ["installation-1", { id: "document-existing" }],
      ]),
    })

    const summary = await backfillScrapCertificates(prisma, { dryRun: false })

    expect(summary.alreadyRepresented).toBe(1)
    expect(summary.genericCertificatesCreated).toBe(0)
    expect(summary.linksCreated).toBe(0)
    expect(prisma.document.create).not.toHaveBeenCalled()
    expect(prisma.documentLink.create).not.toHaveBeenCalled()
  })

  it("links an existing generic document by legacy id without duplicating it", async () => {
    const installation = createScrappedInstallation()
    const prisma = createFakePrisma({
      installations: [installation],
      existingDocumentsByLegacyId: new Map([
        ["legacy-scrap-document-1", { id: "document-existing" }],
      ]),
    })

    const summary = await backfillScrapCertificates(prisma, { dryRun: false })

    expect(summary.genericCertificatesCreated).toBe(0)
    expect(summary.linksCreated).toBe(1)
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

  it("does not write in dry-run mode", async () => {
    const installation = createScrappedInstallation()
    const prisma = createFakePrisma({
      installations: [installation],
      documentCreateResult: { id: "document-new" },
    })

    const summary = await backfillScrapCertificates(prisma)

    expect(summary.dryRun).toBe(true)
    expect(summary.genericCertificatesCreated).toBe(1)
    expect(summary.linksCreated).toBe(1)
    expect(prisma.document.create).not.toHaveBeenCalled()
    expect(prisma.documentLink.create).not.toHaveBeenCalled()
  })

  it("counts errors without aborting the whole backfill", async () => {
    const installation = createScrappedInstallation()
    const prisma = createFakePrisma({
      installations: [installation],
    })
    prisma.document.create.mockRejectedValueOnce(new Error("db failed"))

    const summary = await backfillScrapCertificates(prisma, { dryRun: false })

    expect(summary.errors).toBe(1)
    expect(summary.genericCertificatesCreated).toBe(0)
  })
})

function createScrappedInstallation() {
  return {
    id: "installation-1",
    companyId: "company-1",
    scrappedAt: new Date("2026-01-15"),
    scrapCertificateBlobPath:
      "companies/company-1/installations/installation-1/scrap/certificate.pdf",
    scrapCertificateFileName: "Skrotningsintyg.pdf",
    documents: [
      {
        id: "legacy-scrap-document-1",
        blobPath:
          "companies/company-1/installations/installation-1/scrap/certificate.pdf",
        uploadedById: "user-1",
        sizeBytes: 100,
        createdAt: new Date("2026-01-15"),
      },
    ],
  }
}

function createFakePrisma({
  documentCreateResult = { id: "document-new" },
  existingDocumentsByLegacyId = new Map<string, { id: string }>(),
  existingDocumentsByStorageKey = new Map<string, { id: string }>(),
  existingLinkedDocumentByInstallationId = new Map<string, { id: string }>(),
  existingLinkKeys = new Set<string>(),
  installations = [],
}: {
  documentCreateResult?: { id: string }
  existingDocumentsByLegacyId?: Map<string, { id: string }>
  existingDocumentsByStorageKey?: Map<string, { id: string }>
  existingLinkedDocumentByInstallationId?: Map<string, { id: string }>
  existingLinkKeys?: Set<string>
  installations?: ReturnType<typeof createScrappedInstallation>[]
}) {
  let installationFindManyCalls = 0

  return {
    document: {
      create: vi.fn().mockResolvedValue(documentCreateResult),
      findFirst: vi.fn((args) => {
        const where = args.where
        const installationId = where.links?.some?.entityId
        if (installationId) {
          return Promise.resolve(
            existingLinkedDocumentByInstallationId.get(installationId) ?? null
          )
        }
        if (where.legacyInstallationDocumentId) {
          return Promise.resolve(
            existingDocumentsByLegacyId.get(where.legacyInstallationDocumentId) ??
              null
          )
        }
        return Promise.resolve(
          existingDocumentsByStorageKey.get(`${where.companyId}|${where.storageKey}`) ??
            null
        )
      }),
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
      count: vi.fn().mockResolvedValue(installations.length),
      findMany: vi.fn(() => {
        installationFindManyCalls += 1
        return Promise.resolve(
          installationFindManyCalls === 1 ? installations : []
        )
      }),
    },
  }
}
