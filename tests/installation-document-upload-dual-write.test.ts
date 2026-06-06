import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
const installationEventFindFirst = vi.fn()
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
    installationEvent: {
      findFirst: installationEventFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
  }),
}

const legacyDocument = {
  id: "legacy-document-1",
  installationId: "installation-1",
  eventId: null,
  companyId: "company-1",
  uploadedById: "owner-1",
  originalFileName: "Kontrollrapport.pdf",
  fileName: "kontrollrapport.pdf",
  fileUrl: "https://blob.example/kontrollrapport.pdf",
  blobPath:
    "companies/company-1/installations/installation-1/documents/legacy-document-1-kontrollrapport.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3,
  documentType: "INSPECTION_REPORT",
  description: "Kontroll",
  createdAt: new Date("2026-01-01"),
  uploadedBy: {
    name: "Owner",
    email: "owner@example.com",
  },
  event: null,
}

type LegacyUploadDocument = Record<string, unknown>

describe("installation document upload dual-write", () => {
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
      companyId: "company-1",
      assignedContractorId: null,
      assignedServicePartnerCompanyId: null,
    })
    installationEventFindFirst.mockResolvedValue(null)
    blobPut.mockResolvedValue({
      url: "https://blob.example/kontrollrapport.pdf",
      pathname: legacyDocument.blobPath,
    })
    blobDel.mockResolvedValue(undefined)
    logActivity.mockResolvedValue(undefined)
  })

  it("creates the legacy InstallationDocument, generic Document, and installation link", async () => {
    const tx = createTransactionMock({ legacyUploadDocument: legacyDocument })
    transaction.mockImplementation((callback) => callback(tx))
    const { POST } = await import("@/app/api/installations/[id]/documents/route")

    const response = await POST(createUploadRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      id: "legacy-document-1",
      downloadHref:
        "/api/installations/installation-1/documents/legacy-document-1/download",
    })
    expect(tx.installationDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: expect.any(String),
          installationId: "installation-1",
          eventId: null,
          companyId: "company-1",
          uploadedById: "owner-1",
          documentType: "INSPECTION_REPORT",
        }),
      })
    )
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        uploadedByUserId: "owner-1",
        storageKey: legacyDocument.blobPath,
        category: "INSPECTION_REPORT",
        source: "USER_UPLOAD",
        status: "ACTIVE",
        visibility: "COMPANY_INTERNAL",
        retentionPolicy: "STANDARD",
        legacyInstallationDocumentId: "legacy-document-1",
      }),
    })
    expect(tx.documentLink.create).toHaveBeenCalledTimes(1)
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "generic-document-1",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "ATTACHMENT",
        linkedByUserId: "owner-1",
      },
    })
    expect(blobDel).not.toHaveBeenCalled()
  })

  it("creates an installation event link when eventId is provided", async () => {
    const eventDocument = {
      ...legacyDocument,
      eventId: "event-1",
      event: {
        id: "event-1",
        type: "SERVICE",
        date: new Date("2026-01-02"),
      },
    }
    const tx = createTransactionMock({ legacyUploadDocument: eventDocument })
    transaction.mockImplementation((callback) => callback(tx))
    installationEventFindFirst.mockResolvedValueOnce({ id: "event-1" })
    const { POST } = await import("@/app/api/installations/[id]/documents/route")

    const response = await POST(createUploadRequest({ eventId: "event-1" }), routeContext)

    expect(response.status).toBe(201)
    expect(tx.documentLink.create).toHaveBeenCalledTimes(2)
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "generic-document-1",
        companyId: "company-1",
        entityType: "INSTALLATION_EVENT",
        entityId: "event-1",
        role: "ATTACHMENT",
        linkedByUserId: "owner-1",
      },
    })
  })

  it("rolls back the Blob upload when generic Document creation fails", async () => {
    const tx = createTransactionMock({ legacyUploadDocument: legacyDocument })
    tx.document.create.mockRejectedValueOnce(new Error("generic document failed"))
    transaction.mockImplementation((callback) => callback(tx))
    const { POST } = await import("@/app/api/installations/[id]/documents/route")

    const response = await POST(createUploadRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Ett oväntat fel uppstod" })
    expect(blobDel).toHaveBeenCalledWith(legacyDocument.blobPath, {
      token: "blob-token",
    })
    expect(tx.documentLink.create).not.toHaveBeenCalled()
  })
})

function createTransactionMock({
  legacyUploadDocument,
}: {
  legacyUploadDocument: LegacyUploadDocument
}) {
  return {
    installationDocument: {
      create: vi.fn().mockResolvedValue(legacyUploadDocument),
    },
    document: {
      create: vi.fn().mockResolvedValue({ id: "generic-document-1" }),
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({ id: "generic-link-1" }),
    },
  }
}

function createUploadRequest({ eventId }: { eventId?: string } = {}) {
  const formData = new FormData()
  formData.set("file", new File(["pdf"], "Kontrollrapport.pdf", { type: "application/pdf" }))
  formData.set("documentType", "INSPECTION_REPORT")
  formData.set("description", "Kontroll")
  if (eventId) formData.set("eventId", eventId)

  return new Request("http://localhost/api/installations/installation-1/documents", {
    method: "POST",
    body: formData,
  }) as never
}
