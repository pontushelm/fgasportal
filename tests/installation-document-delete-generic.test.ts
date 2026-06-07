import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
const documentFindFirst = vi.fn()
const installationDocumentFindFirst = vi.fn()
const transaction = vi.fn()
const logActivity = vi.fn()

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
    document: {
      findFirst: documentFindFirst,
    },
    installationDocument: {
      findFirst: installationDocumentFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
    documentId: "generic-document-1",
  }),
}

const installation = {
  id: "installation-1",
  companyId: "company-1",
  assignedContractorId: null,
  assignedServicePartnerCompanyId: null,
}

const genericDocument = {
  id: "generic-document-1",
  uploadedByUserId: "owner-1",
  originalFileName: "Kontrollrapport.pdf",
  fileName: "kontrollrapport.pdf",
  category: "INSPECTION_REPORT",
  status: "ACTIVE",
  legacyInstallationDocumentId: "legacy-document-1",
  links: [
    {
      entityType: "INSTALLATION",
      entityId: "installation-1",
      role: "ATTACHMENT",
    },
  ],
}

const legacyDocument = {
  id: "legacy-document-1",
  installationId: "installation-1",
  eventId: null,
  companyId: "company-1",
  uploadedById: "owner-1",
  originalFileName: "Kontrollrapport.pdf",
  fileName: "kontrollrapport.pdf",
  fileUrl: "https://blob.example/document.pdf",
  blobPath:
    "companies/company-1/installations/installation-1/documents/document.pdf",
  mimeType: "application/pdf",
  sizeBytes: 123,
  documentType: "INSPECTION_REPORT",
  description: "Kontroll",
  createdAt: new Date("2026-01-01"),
  installation: {
    companyId: "company-1",
    assignedContractorId: null,
    assignedServicePartnerCompanyId: null,
  },
}

describe("installation document generic delete migration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    installationFindFirst.mockResolvedValue(installation)
    documentFindFirst.mockResolvedValue(genericDocument)
    installationDocumentFindFirst.mockResolvedValue(legacyDocument)
    transaction.mockImplementation((callback) =>
      callback(createTransactionMock({ updatedDocument: genericDocument }))
    )
    logActivity.mockResolvedValue(undefined)
  })

  it("marks a dual-written generic document as deleted without deleting legacy rows", async () => {
    const { DELETE } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/route"
    )
    const tx = createTransactionMock({ updatedDocument: genericDocument })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await DELETE(createDeleteRequest("generic-document-1"), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(tx.document.update).toHaveBeenCalledWith({
      where: {
        id: "generic-document-1",
      },
      data: {
        status: "DELETED",
        deletedAt: expect.any(Date),
        deletedByUserId: "owner-1",
      },
      select: expect.any(Object),
    })
    expect(tx.document.create).not.toHaveBeenCalled()
  })

  it("creates a deleted generic tombstone for legacy-only documents", async () => {
    const { DELETE } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/route"
    )
    documentFindFirst.mockResolvedValueOnce(null)
    const tx = createTransactionMock({
      createdDocument: {
        ...genericDocument,
        id: "generic-tombstone-1",
      },
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await DELETE(createDeleteRequest("legacy-document-1"), {
      params: Promise.resolve({
        id: "installation-1",
        documentId: "legacy-document-1",
      }),
    })

    expect(response.status).toBe(200)
    expect(tx.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          uploadedByUserId: "owner-1",
          storageKey: legacyDocument.blobPath,
          category: "INSPECTION_REPORT",
          status: "DELETED",
          deletedAt: expect.any(Date),
          deletedByUserId: "owner-1",
          legacyInstallationDocumentId: "legacy-document-1",
        }),
      })
    )
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        documentId: "generic-tombstone-1",
        companyId: "company-1",
        entityType: "INSTALLATION",
        entityId: "installation-1",
        role: "ATTACHMENT",
        linkedByUserId: "owner-1",
      },
    })
  })

  it("logs document_deleted with generic document metadata", async () => {
    const { DELETE } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/route"
    )

    await DELETE(createDeleteRequest("generic-document-1"), routeContext)

    expect(logActivity).toHaveBeenCalledWith({
      companyId: "company-1",
      installationId: "installation-1",
      userId: "owner-1",
      action: "document_deleted",
      entityType: "document",
      entityId: "generic-document-1",
      metadata: {
        documentId: "generic-document-1",
        category: "INSPECTION_REPORT",
        fileName: "Kontrollrapport.pdf",
        entityType: "INSTALLATION",
        entityId: "installation-1",
      },
    })
  })

  it("keeps delete permissions aligned with legacy document permissions", async () => {
    const { DELETE } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "member-2",
        companyId: "company-1",
        role: "MEMBER",
      },
    })

    const response = await DELETE(createDeleteRequest("generic-document-1"), routeContext)

    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })
})

function createTransactionMock({
  createdDocument = genericDocument,
  updatedDocument = genericDocument,
}: {
  createdDocument?: typeof genericDocument
  updatedDocument?: typeof genericDocument
} = {}) {
  return {
    document: {
      create: vi.fn().mockResolvedValue({
        ...createdDocument,
        links: [],
      }),
      update: vi.fn().mockResolvedValue(updatedDocument),
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({ id: "link-1" }),
    },
  }
}

function createDeleteRequest(documentId: string) {
  return new Request(
    `http://localhost/api/installations/installation-1/documents/${documentId}`,
    {
      method: "DELETE",
    }
  ) as never
}
