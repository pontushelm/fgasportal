import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const certificationRecordFindFirst = vi.fn()
const documentFindFirst = vi.fn()
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
    certificationRecord: {
      findFirst: certificationRecordFindFirst,
    },
    document: {
      findFirst: documentFindFirst,
    },
  },
}))

vi.mock("@/lib/service-organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-organizations")>(
    "@/lib/service-organizations"
  )

  return {
    ...actual,
    ensureServiceOrganizationForLegacyCompany,
  }
})

const contractorUser = {
  userId: "contractor-user-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  serviceOrganizationId: "service-org-1",
  isServicePartnerAdmin: false,
}

const certificationRecord = {
  id: "cert-record-1",
  documentId: null,
}

const certificationDocument = {
  id: "document-1",
  fileName: "certifikat.pdf",
  contentType: "application/pdf",
  sizeBytes: 3,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  category: "PERSONAL_FGAS_CERTIFICATE",
  originalFileName: "Certifikat.pdf",
}

describe("own technician certification document API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({ user: contractorUser })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    certificationRecordFindFirst.mockResolvedValue(certificationRecord)
    documentFindFirst.mockResolvedValue(null)
    blobPut.mockResolvedValue({
      url: "https://blob.example/certifikat.pdf",
      pathname:
        "companies/company-1/certifications/technicians/cert-record-1/document-1-certifikat.pdf",
    })
    blobDel.mockResolvedValue(undefined)
    logActivity.mockResolvedValue(undefined)
    transaction.mockImplementation((callback) =>
      callback(createTransactionClient())
    )
  })

  it("requires authentication", async () => {
    const { GET } = await import(
      "@/app/api/user/technician-certification/document/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: "Saknar autentisering" },
        { status: 401 }
      ),
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
  })

  it.each(["OWNER", "ADMIN", "MEMBER"] as const)(
    "denies %s users",
    async (role) => {
      const { GET } = await import(
        "@/app/api/user/technician-certification/document/route"
      )
      authenticateApiRequest.mockResolvedValueOnce({
        user: {
          ...contractorUser,
          role,
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(403)
      expect(ensureServiceOrganizationForLegacyCompany).not.toHaveBeenCalled()
    }
  )

  it("returns own document metadata without exposing Blob URL", async () => {
    const { GET } = await import(
      "@/app/api/user/technician-certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce({
      ...certificationRecord,
      documentId: "document-1",
    })
    documentFindFirst.mockResolvedValueOnce(certificationDocument)

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.document).toMatchObject({
      id: "document-1",
      fileName: "certifikat.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
      downloadHref: "/api/documents/document-1/download",
    })
    expect(JSON.stringify(body)).not.toContain("blob.example")
  })

  it("uploads a document to the own technician certification record", async () => {
    const { POST } = await import(
      "@/app/api/user/technician-certification/document/route"
    )
    const tx = createTransactionClient({
      documentCreate: vi.fn().mockResolvedValue(certificationDocument),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(createUploadRequest())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(blobPut).toHaveBeenCalledWith(
      expect.stringContaining(
        "companies/company-1/certifications/technicians/cert-record-1/"
      ),
      expect.any(Uint8Array),
      expect.objectContaining({
        access: "public",
        contentType: "application/pdf",
        token: "blob-token",
      })
    )
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        uploadedByUserId: "contractor-user-1",
        originalFileName: "Certifikat.pdf",
        contentType: "application/pdf",
        category: "PERSONAL_FGAS_CERTIFICATE",
        source: "USER_UPLOAD",
        status: "ACTIVE",
        visibility: "SERVICE_PARTNER_VISIBLE",
        retentionPolicy: "RETAINED",
        storageKey:
          "companies/company-1/certifications/technicians/cert-record-1/document-1-certifikat.pdf",
        sha256: expect.any(String),
      }),
    })
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        documentId: "document-1",
        entityType: "CERTIFICATION_RECORD",
        entityId: "cert-record-1",
        role: "CERTIFICATE",
        linkedByUserId: "contractor-user-1",
      },
    })
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: {
        documentId: "document-1",
        updatedByUserId: "contractor-user-1",
      },
    })
    expect(body.document.downloadHref).toBe("/api/documents/document-1/download")
    expect(JSON.stringify(body)).not.toContain("blob.example")
  })

  it("requires an existing own certification record before upload", async () => {
    const { POST } = await import(
      "@/app/api/user/technician-certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce(null)

    const response = await POST(createUploadRequest())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("Spara personcertifikatet")
    expect(blobPut).not.toHaveBeenCalled()
  })

  it("rejects invalid file types", async () => {
    const { POST } = await import(
      "@/app/api/user/technician-certification/document/route"
    )

    const response = await POST(
      createUploadRequest(
        new File(["txt"], "certifikat.txt", { type: "text/plain" })
      )
    )

    expect(response.status).toBe(400)
    expect(blobPut).not.toHaveBeenCalled()
  })

  it("rejects files larger than 10 MB", async () => {
    const { POST } = await import(
      "@/app/api/user/technician-certification/document/route"
    )

    const response = await POST(
      createUploadRequest(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "certifikat.pdf", {
          type: "application/pdf",
        })
      )
    )

    expect(response.status).toBe(400)
    expect(blobPut).not.toHaveBeenCalled()
  })

  it("soft deletes the current own document", async () => {
    const { DELETE } = await import(
      "@/app/api/user/technician-certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce({
      ...certificationRecord,
      documentId: "document-1",
    })
    documentFindFirst.mockResolvedValueOnce(certificationDocument)
    const tx = createTransactionClient()
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await DELETE(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ document: null })
    expect(tx.document.update).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      data: expect.objectContaining({
        status: "DELETED",
        deletedByUserId: "contractor-user-1",
      }),
    })
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: {
        documentId: null,
        updatedByUserId: "contractor-user-1",
      },
    })
  })
})

function createRequest() {
  return new Request(
    "http://localhost/api/user/technician-certification/document",
    { method: "GET" }
  ) as never
}

function createUploadRequest(
  file = new File(["pdf"], "Certifikat.pdf", { type: "application/pdf" })
) {
  const formData = new FormData()
  formData.set("file", file)

  return new Request(
    "http://localhost/api/user/technician-certification/document",
    {
      method: "POST",
      body: formData,
    }
  ) as never
}

function createTransactionClient({
  documentCreate = vi.fn().mockResolvedValue(certificationDocument),
  documentFindFirst = vi.fn().mockResolvedValue(null),
  documentUpdate = vi.fn().mockResolvedValue(certificationDocument),
} = {}) {
  return {
    certificationRecord: {
      update: vi.fn().mockResolvedValue(certificationRecord),
    },
    document: {
      create: documentCreate,
      findFirst: documentFindFirst,
      update: documentUpdate,
    },
    documentLink: {
      create: vi.fn().mockResolvedValue({ id: "document-link-1" }),
    },
  }
}
