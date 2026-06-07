import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
const companyMembershipFindFirst = vi.fn()
const transaction = vi.fn()
const blobPut = vi.fn()
const blobDel = vi.fn()
const logActivity = vi.fn()

vi.mock("@vercel/blob", () => ({
  del: blobDel,
  put: blobPut,
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    installation: {
      findFirst: installationFindFirst,
    },
    companyMembership: {
      findFirst: companyMembershipFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
  }),
}

const legacyScrapDocument = {
  id: "scrap-document-1",
  installationId: "installation-1",
  companyId: "company-1",
  uploadedById: "owner-1",
  fileName: "skrotningsintyg.pdf",
  originalFileName: "Skrotningsintyg.pdf",
  fileUrl: "https://blob.example/scrap.pdf",
  blobPath:
    "companies/company-1/installations/installation-1/scrap/scrap-document-1-skrotningsintyg.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3,
  documentType: "OTHER",
  description: "Skrotningsintyg",
}

describe("scrap certificate dual-write", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        membershipId: "membership-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    installationFindFirst.mockResolvedValue({
      id: "installation-1",
      name: "Aggregat A",
      scrappedAt: null,
    })
    companyMembershipFindFirst.mockResolvedValue({
      userId: "contractor-1",
      isCertifiedCompany: true,
      certificationValidUntil: null,
      user: {
        name: "Service AB",
        email: "service@example.com",
      },
    })
    blobPut.mockResolvedValue({
      url: legacyScrapDocument.fileUrl,
      pathname: legacyScrapDocument.blobPath,
    })
    blobDel.mockResolvedValue(undefined)
    logActivity.mockResolvedValue(undefined)
  })

  it("creates a generic retained scrap certificate document and installation link", async () => {
    const tx = createTransactionMock()
    transaction.mockImplementationOnce((callback) => callback(tx))
    const { POST } = await import("@/app/api/installations/[id]/scrap/route")

    const response = await POST(createScrapRequest(), routeContext)

    expect(response.status).toBe(200)
    expect(tx.installationDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: expect.any(String),
          installationId: "installation-1",
          companyId: "company-1",
          uploadedById: "owner-1",
          documentType: "OTHER",
          description: "Skrotningsintyg",
        }),
      })
    )
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        uploadedByUserId: "owner-1",
        originalFileName: "Skrotningsintyg.pdf",
        fileName: "skrotningsintyg.pdf",
        contentType: "application/pdf",
        sizeBytes: 3,
        storageKey: legacyScrapDocument.blobPath,
        category: "SCRAP_CERTIFICATE",
        source: "USER_UPLOAD",
        status: "ACTIVE",
        retentionPolicy: "RETAINED",
        description: "Skrotningsintyg",
        legacyInstallationDocumentId: "scrap-document-1",
      }),
    })
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "generic-scrap-document-1",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "SCRAP_CERTIFICATE",
        linkedByUserId: "owner-1",
      },
    })
    expect(blobDel).not.toHaveBeenCalled()
  })
})

function createTransactionMock() {
  return {
    installationDocument: {
      create: vi.fn().mockResolvedValue(legacyScrapDocument),
    },
    document: {
      create: vi.fn().mockResolvedValue({ id: "generic-scrap-document-1" }),
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({ id: "link-1" }),
    },
    installation: {
      update: vi.fn().mockResolvedValue({
        id: "installation-1",
        scrapCertificateBlobPath: legacyScrapDocument.blobPath,
        scrapCertificateFileName: "Skrotningsintyg.pdf",
      }),
    },
  }
}

function createScrapRequest() {
  const formData = new FormData()
  formData.set("scrappedAt", "2026-02-01")
  formData.set("servicePartnerId", "contractor-1")
  formData.set("scrapComment", "Skrotat")
  formData.set("recoveredRefrigerantKg", "10")
  formData.set(
    "certificate",
    new File(["pdf"], "Skrotningsintyg.pdf", { type: "application/pdf" })
  )

  return new Request("http://localhost/api/installations/installation-1/scrap", {
    method: "POST",
    body: formData,
  }) as never
}
