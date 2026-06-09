import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const serviceOrganizationMembershipFindFirst = vi.fn()
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
    serviceOrganizationMembership: {
      findFirst: serviceOrganizationMembershipFindFirst,
    },
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

const serviceAdmin = {
  userId: "service-admin-1",
  membershipId: "membership-admin-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  serviceOrganizationId: "service-org-1",
  isServicePartnerAdmin: true,
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

describe("servicepartner technician certification document API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({ user: serviceAdmin })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    serviceOrganizationMembershipFindFirst.mockResolvedValue({ id: "som-tech-1" })
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
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: "Saknar autentisering" },
        { status: 401 }
      ),
    })

    const response = await GET(createRequest(), createContext())

    expect(response.status).toBe(401)
  })

  it("denies non-servicepartner admins", async () => {
    const { GET } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...serviceAdmin,
        isServicePartnerAdmin: false,
      },
    })

    const response = await GET(createRequest(), createContext())

    expect(response.status).toBe(403)
    expect(serviceOrganizationMembershipFindFirst).not.toHaveBeenCalled()
  })

  it.each(["OWNER", "ADMIN", "MEMBER"] as const)(
    "denies customer role %s",
    async (role) => {
      const { GET } = await import(
        "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
      )
      authenticateApiRequest.mockResolvedValueOnce({
        user: {
          ...serviceAdmin,
          role,
          servicePartnerCompanyId: null,
          isServicePartnerAdmin: false,
        },
      })

      const response = await GET(createRequest(), createContext())

      expect(response.status).toBe(403)
      expect(serviceOrganizationMembershipFindFirst).not.toHaveBeenCalled()
    }
  )

  it("returns technician document metadata without exposing Blob URL", async () => {
    const { GET } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce({
      ...certificationRecord,
      documentId: "document-1",
    })
    documentFindFirst.mockResolvedValueOnce(certificationDocument)

    const response = await GET(createRequest(), createContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.document).toMatchObject({
      id: "document-1",
      fileName: "certifikat.pdf",
      downloadHref: "/api/documents/document-1/download",
    })
    expect(JSON.stringify(body)).not.toContain("blob.example")
  })

  it("uploads a document for a technician in the same service organization", async () => {
    const { POST } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    const tx = createTransactionClient({
      documentCreate: vi.fn().mockResolvedValue(certificationDocument),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(createUploadRequest(), createContext())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        uploadedByUserId: "service-admin-1",
        originalFileName: "Certifikat.pdf",
        category: "PERSONAL_FGAS_CERTIFICATE",
        storageKey:
          "companies/company-1/certifications/technicians/cert-record-1/document-1-certifikat.pdf",
      }),
    })
    expect(tx.documentLink.create).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        documentId: "document-1",
        entityType: "CERTIFICATION_RECORD",
        entityId: "cert-record-1",
        role: "CERTIFICATE",
        linkedByUserId: "service-admin-1",
      },
    })
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: {
        documentId: "document-1",
        updatedByUserId: "service-admin-1",
      },
    })
    expect(body.document.downloadHref).toBe("/api/documents/document-1/download")
    expect(JSON.stringify(body)).not.toContain("blob.example")
  })

  it("replaces an existing technician certificate document", async () => {
    const { POST } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce({
      ...certificationRecord,
      documentId: "old-document-1",
    })
    const tx = createTransactionClient({
      documentCreate: vi.fn().mockResolvedValue(certificationDocument),
      documentFindFirst: vi.fn().mockResolvedValue({
        ...certificationDocument,
        id: "old-document-1",
      }),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(createUploadRequest(), createContext())

    expect(response.status).toBe(201)
    expect(tx.document.update).toHaveBeenCalledWith({
      where: {
        id: "old-document-1",
      },
      data: expect.objectContaining({
        status: "REPLACED",
        replacedByDocumentId: "document-1",
      }),
    })
  })

  it("deletes the current technician certificate document", async () => {
    const { DELETE } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    certificationRecordFindFirst.mockResolvedValueOnce({
      ...certificationRecord,
      documentId: "document-1",
    })
    documentFindFirst.mockResolvedValueOnce(certificationDocument)
    const tx = createTransactionClient()
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await DELETE(createRequest(), createContext())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ document: null })
    expect(tx.document.update).toHaveBeenCalledWith({
      where: {
        id: "document-1",
      },
      data: expect.objectContaining({
        status: "DELETED",
        deletedByUserId: "service-admin-1",
      }),
    })
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: {
        documentId: null,
        updatedByUserId: "service-admin-1",
      },
    })
  })

  it("cannot access technicians outside the service organization", async () => {
    const { GET } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )
    serviceOrganizationMembershipFindFirst.mockResolvedValueOnce(null)

    const response = await GET(createRequest(), createContext())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toContain("Teknikern hittades inte")
    expect(documentFindFirst).not.toHaveBeenCalled()
  })

  it("rejects invalid file types", async () => {
    const { POST } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/document/route"
    )

    const response = await POST(
      createUploadRequest(
        new File(["txt"], "certifikat.txt", { type: "text/plain" })
      ),
      createContext()
    )

    expect(response.status).toBe(400)
    expect(blobPut).not.toHaveBeenCalled()
  })
})

function createRequest() {
  return new Request(
    "http://localhost/api/dashboard/service/technicians/technician-1/certification/document",
    { method: "GET" }
  ) as never
}

function createUploadRequest(
  file = new File(["pdf"], "Certifikat.pdf", { type: "application/pdf" })
) {
  const formData = new FormData()
  formData.set("file", file)

  return new Request(
    "http://localhost/api/dashboard/service/technicians/technician-1/certification/document",
    {
      method: "POST",
      body: formData,
    }
  ) as never
}

function createContext() {
  return {
    params: Promise.resolve({
      userId: "technician-1",
    }),
  }
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
