import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const documentFindFirst = vi.fn()
const blobGet = vi.fn()
const logActivity = vi.fn()

vi.mock("@vercel/blob", () => ({
  get: blobGet,
}))

vi.mock("@/lib/auth", () => ({
  authenticateApiRequest,
  forbiddenResponse: () =>
    NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
}))

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    installationDocument: {
      findFirst: documentFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
    documentId: "document-1",
  }),
}

const documentRecord = {
  id: "document-1",
  installationId: "installation-1",
  companyId: "company-1",
  uploadedById: "uploader-1",
  fileName: "rapport.pdf",
  originalFileName: "Kontrollrapport 2026.pdf",
  fileUrl: "https://blob.example/document.pdf",
  blobPath: "companies/company-1/installations/installation-1/documents/document-1.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3,
  documentType: "INSPECTION_REPORT",
  description: null,
  createdAt: new Date("2026-01-01"),
  installation: {
    companyId: "company-1",
    assignedContractorId: null,
    assignedServicePartnerCompanyId: null,
  },
}

describe("installation document download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    documentFindFirst.mockResolvedValue(documentRecord)
    blobGet.mockResolvedValue({
      statusCode: 200,
      stream: byteStream([1, 2, 3]),
    })
    logActivity.mockResolvedValue(undefined)
  })

  it("downloads tenant-scoped documents for customer roles", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/download/route"
    )

    const response = await GET(createRequest(), routeContext)
    const body = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(Array.from(body)).toEqual([1, 2, 3])
    expect(documentFindFirst).toHaveBeenCalledWith({
      where: {
        id: "document-1",
        installationId: "installation-1",
        companyId: "company-1",
      },
      include: {
        installation: {
          select: {
            companyId: true,
            assignedContractorId: true,
            assignedServicePartnerCompanyId: true,
          },
        },
      },
    })
    expect(blobGet).toHaveBeenCalledWith(documentRecord.blobPath, {
      access: "public",
      token: "blob-token",
    })
  })

  it("allows contractors to download documents for delegated aggregat", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/download/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        isServicePartnerAdmin: false,
        servicePartnerCompanyId: "servicepartner-1",
      },
    })
    documentFindFirst.mockResolvedValueOnce({
      ...documentRecord,
      installation: {
        companyId: "company-1",
        assignedContractorId: "contractor-1",
        assignedServicePartnerCompanyId: "servicepartner-2",
      },
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
  })

  it("denies contractors for unrelated aggregat documents", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/download/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        isServicePartnerAdmin: false,
        servicePartnerCompanyId: "servicepartner-1",
      },
    })
    documentFindFirst.mockResolvedValueOnce({
      ...documentRecord,
      installation: {
        companyId: "company-1",
        assignedContractorId: "contractor-2",
        assignedServicePartnerCompanyId: "servicepartner-1",
      },
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(403)
    expect(blobGet).not.toHaveBeenCalled()
  })

  it("logs successful document downloads", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/documents/[documentId]/download/route"
    )

    await GET(createRequest(), routeContext)

    expect(logActivity).toHaveBeenCalledWith({
      companyId: "company-1",
      installationId: "installation-1",
      userId: "owner-1",
      action: "document_downloaded",
      entityType: "document",
      entityId: "document-1",
      metadata: {
        documentId: "document-1",
        installationId: "installation-1",
        fileName: "Kontrollrapport 2026.pdf",
        documentType: "INSPECTION_REPORT",
      },
    })
  })
})

function createRequest() {
  return new Request(
    "http://localhost/api/installations/installation-1/documents/document-1/download",
    {
      method: "GET",
    }
  ) as never
}

function byteStream(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}
