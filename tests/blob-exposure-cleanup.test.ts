import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
const installationUpdate = vi.fn()
const documentFindMany = vi.fn()
const documentFindFirst = vi.fn()
const documentCreate = vi.fn()
const documentLinkCreate = vi.fn()
const installationDocumentCreate = vi.fn()
const installationDocumentFindMany = vi.fn()
const installationEventFindMany = vi.fn()
const companyMembershipFindFirst = vi.fn()
const transaction = vi.fn()
const logActivity = vi.fn()
const blobPut = vi.fn()
const blobDel = vi.fn()

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
    companyMembership: {
      findFirst: companyMembershipFindFirst,
    },
    installation: {
      findFirst: installationFindFirst,
      update: installationUpdate,
    },
    document: {
      findMany: documentFindMany,
      findFirst: documentFindFirst,
    },
    installationEvent: {
      findMany: installationEventFindMany,
    },
    installationDocument: {
      create: installationDocumentCreate,
      findMany: installationDocumentFindMany,
    },
  },
}))

const authUser = {
  userId: "owner-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "OWNER",
}

const installationDetailRecord = {
  id: "installation-1",
  name: "Aggregat A",
  location: "Tak",
  equipmentId: "AGG-1",
  serialNumber: null,
  propertyName: null,
  equipmentType: null,
  operatorName: null,
  refrigerantType: "R410A",
  refrigerantAmount: 12,
  hasLeakDetectionSystem: false,
  installationDate: null,
  lastInspection: null,
  inspectionIntervalMonths: null,
  nextInspection: null,
  notes: null,
  isActive: true,
  archivedAt: null,
  scrappedAt: new Date("2026-02-01"),
  scrappedByCompanyMembershipId: "membership-1",
  scrapComment: "Skrotat",
  scrapCertificateUrl: "https://blob.example/scrap.pdf",
  scrapCertificateFileName: "Skrotningsintyg.pdf",
  scrapCertificateBlobPath:
    "companies/company-1/installations/installation-1/scrap/scrap.pdf",
  scrapServicePartnerId: null,
  recoveredRefrigerantKg: 10,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  companyId: "company-1",
  propertyId: null,
  createdById: "owner-1",
  updatedById: "owner-1",
  assignedContractorId: null,
  assignedServicePartnerCompanyId: null,
  property: null,
  inspections: [],
  assignedContractor: null,
  assignedServicePartnerCompany: null,
}

describe("Blob URL exposure cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({
      user: authUser,
    })
    documentFindMany.mockResolvedValue([])
    documentFindFirst.mockResolvedValue(null)
    installationEventFindMany.mockResolvedValue([])
    logActivity.mockResolvedValue(undefined)
  })

  it("does not return fileUrl in installation document list responses", async () => {
    const { GET } = await import("@/app/api/installations/[id]/documents/route")
    installationFindFirst.mockResolvedValueOnce({
      id: "installation-1",
      companyId: "company-1",
      assignedContractorId: null,
      assignedServicePartnerCompanyId: null,
    })
    installationDocumentFindMany.mockResolvedValueOnce([
      {
        id: "document-1",
        uploadedById: "owner-1",
        originalFileName: "Rapport.pdf",
        fileUrl: "https://blob.example/document.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        documentType: "INSPECTION_REPORT",
        description: null,
        createdAt: new Date("2026-01-01"),
        uploadedBy: { name: "Owner", email: "owner@example.com" },
        event: null,
      },
    ])

    const response = await GET(createRequest("/api/installations/installation-1/documents"), {
      params: Promise.resolve({ id: "installation-1" }),
    })
    const body = await response.json()

    expect(body[0]).toMatchObject({
      id: "document-1",
      downloadHref:
        "/api/installations/installation-1/documents/document-1/download",
    })
    expect(body[0]).not.toHaveProperty("fileUrl")
    expect(JSON.stringify(body)).not.toContain("https://blob.example")
  })

  it("does not return scrap certificate URL or Blob path in installation detail responses", async () => {
    const { GET } = await import("@/app/api/installations/[id]/route")
    installationFindFirst.mockResolvedValueOnce(installationDetailRecord)

    const response = await GET(createRequest("/api/installations/installation-1"), {
      params: Promise.resolve({ id: "installation-1" }),
    })
    const body = await response.json()

    expect(body.scrapCertificateDownloadHref).toBe(
      "/api/installations/installation-1/scrap/certificate/download"
    )
    expect(body).not.toHaveProperty("scrapCertificateUrl")
    expect(body).not.toHaveProperty("scrapCertificateBlobPath")
    expect(JSON.stringify(body)).not.toContain("https://blob.example")
    expect(JSON.stringify(body)).not.toContain(
      "companies/company-1/installations/installation-1/scrap/scrap.pdf"
    )
  })

  it("uses generic scrap certificate metadata in installation detail responses", async () => {
    const { GET } = await import("@/app/api/installations/[id]/route")
    installationFindFirst.mockResolvedValueOnce({
      ...installationDetailRecord,
      scrapCertificateUrl: null,
      scrapCertificateBlobPath: null,
      scrapCertificateFileName: null,
    })
    documentFindFirst.mockResolvedValueOnce({
      id: "generic-scrap-document-1",
      originalFileName: "Generiskt skrotningsintyg.pdf",
    })

    const response = await GET(createRequest("/api/installations/installation-1"), {
      params: Promise.resolve({ id: "installation-1" }),
    })
    const body = await response.json()

    expect(body.scrapCertificateFileName).toBe("Generiskt skrotningsintyg.pdf")
    expect(body.scrapCertificateDownloadHref).toBe(
      "/api/installations/installation-1/scrap/certificate/download"
    )
    expect(body).not.toHaveProperty("scrapCertificateUrl")
    expect(body).not.toHaveProperty("scrapCertificateBlobPath")
  })

  it("does not return direct Blob fields in scrap upload responses", async () => {
    const { POST } = await import("@/app/api/installations/[id]/scrap/route")
    installationFindFirst.mockResolvedValueOnce({
      id: "installation-1",
      name: "Aggregat A",
      scrappedAt: null,
    })
    companyMembershipFindFirst.mockResolvedValueOnce({
      userId: "contractor-1",
      isCertifiedCompany: true,
      certificationValidUntil: null,
      user: {
        name: "Service AB",
        email: "service@example.com",
      },
    })
    blobPut.mockResolvedValueOnce({
      url: "https://blob.example/scrap.pdf",
      pathname:
        "companies/company-1/installations/installation-1/scrap/scrap.pdf",
    })
    transaction.mockImplementationOnce(async (callback) =>
      callback({
        installationDocument: {
          create: installationDocumentCreate.mockResolvedValueOnce({
            id: "document-1",
          }),
        },
        installation: {
          update: installationUpdate.mockResolvedValueOnce({
            ...installationDetailRecord,
            assignedContractor: undefined,
            assignedServicePartnerCompany: undefined,
            property: undefined,
            inspections: undefined,
          }),
        },
        document: {
          create: documentCreate.mockResolvedValueOnce({
            id: "generic-document-1",
          }),
        },
        documentLink: {
          create: documentLinkCreate.mockResolvedValueOnce({
            id: "generic-link-1",
          }),
        },
      })
    )

    const formData = new FormData()
    formData.set("scrappedAt", "2026-02-01")
    formData.set("servicePartnerId", "contractor-1")
    formData.set("scrapComment", "Skrotat")
    formData.set("recoveredRefrigerantKg", "10")
    formData.set(
      "certificate",
      new File(["pdf"], "Skrotningsintyg.pdf", { type: "application/pdf" })
    )

    const response = await POST(
      new Request("http://localhost/api/installations/installation-1/scrap", {
        method: "POST",
        body: formData,
      }) as never,
      { params: Promise.resolve({ id: "installation-1" }) }
    )
    const body = await response.json()

    expect(body.scrapCertificateDownloadHref).toBe(
      "/api/installations/installation-1/scrap/certificate/download"
    )
    expect(body).not.toHaveProperty("scrapCertificateUrl")
    expect(body).not.toHaveProperty("scrapCertificateBlobPath")
    expect(JSON.stringify(body)).not.toContain("https://blob.example")
    expect(JSON.stringify(body)).not.toContain(
      "companies/company-1/installations/installation-1/scrap/scrap.pdf"
    )
  })
})

function createRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "GET",
  }) as never
}
