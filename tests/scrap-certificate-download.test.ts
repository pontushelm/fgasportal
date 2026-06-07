import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
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
    installation: {
      findFirst: installationFindFirst,
    },
    document: {
      findFirst: documentFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
  }),
}

const installationRecord = {
  id: "installation-1",
  companyId: "company-1",
  assignedContractorId: null,
  assignedServicePartnerCompanyId: null,
  scrapCertificateBlobPath:
    "companies/company-1/installations/installation-1/scrap/certificate.pdf",
  scrapCertificateFileName: "Skrotningsintyg 2026.pdf",
}

describe("scrap certificate download route", () => {
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
    installationFindFirst.mockResolvedValue(installationRecord)
    documentFindFirst.mockResolvedValue(null)
    blobGet.mockResolvedValue({
      statusCode: 200,
      stream: byteStream([4, 5, 6]),
    })
    logActivity.mockResolvedValue(undefined)
  })

  it("downloads tenant-scoped scrap certificates for customer roles", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
    )

    const response = await GET(createRequest(), routeContext)
    const body = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(Array.from(body)).toEqual([4, 5, 6])
    expect(installationFindFirst).toHaveBeenCalledWith({
      where: {
        id: "installation-1",
        companyId: "company-1",
      },
      select: {
        id: true,
        companyId: true,
        assignedContractorId: true,
        assignedServicePartnerCompanyId: true,
        scrapCertificateBlobPath: true,
        scrapCertificateFileName: true,
      },
    })
    expect(blobGet).toHaveBeenCalledWith(
      installationRecord.scrapCertificateBlobPath,
      {
        access: "public",
        token: "blob-token",
      }
    )
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain(
      "skrotningsintyg-2026.pdf"
    )
  })

  it("prefers generic scrap certificate documents when available", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
    )
    documentFindFirst.mockResolvedValueOnce({
      id: "document-scrap-1",
      originalFileName: "Generiskt intyg.pdf",
      fileName: "generiskt-intyg.pdf",
      contentType: "application/pdf",
      storageKey:
        "companies/company-1/installations/installation-1/scrap/generic.pdf",
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
    expect(blobGet).toHaveBeenCalledWith(
      "companies/company-1/installations/installation-1/scrap/generic.pdf",
      {
        access: "public",
        token: "blob-token",
      }
    )
    expect(response.headers.get("content-disposition")).toContain(
      "generiskt-intyg.pdf"
    )
  })

  it("allows contractors to download certificates for delegated aggregat", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
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
    installationFindFirst.mockResolvedValueOnce({
      ...installationRecord,
      assignedContractorId: "contractor-1",
      assignedServicePartnerCompanyId: "servicepartner-2",
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
  })

  it("denies contractors for unrelated scrap certificates", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
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
    installationFindFirst.mockResolvedValueOnce({
      ...installationRecord,
      assignedContractorId: "contractor-2",
      assignedServicePartnerCompanyId: "servicepartner-1",
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(403)
    expect(blobGet).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it("returns 404 when the certificate is missing", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
    )
    installationFindFirst.mockResolvedValueOnce({
      ...installationRecord,
      scrapCertificateBlobPath: null,
      scrapCertificateFileName: null,
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(404)
    expect(blobGet).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it("returns 404 when the installation is outside the tenant scope", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
    )
    installationFindFirst.mockResolvedValueOnce(null)

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(404)
    expect(blobGet).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it("logs successful scrap certificate downloads", async () => {
    const { GET } = await import(
      "@/app/api/installations/[id]/scrap/certificate/download/route"
    )

    await GET(createRequest(), routeContext)

    expect(logActivity).toHaveBeenCalledWith({
      companyId: "company-1",
      installationId: "installation-1",
      userId: "owner-1",
      action: "scrap_certificate_downloaded",
      entityType: "installation",
      entityId: "installation-1",
      metadata: {
        installationId: "installation-1",
        fileName: "Skrotningsintyg 2026.pdf",
        blobPath: installationRecord.scrapCertificateBlobPath,
        documentId: null,
        category: null,
      },
    })
  })
})

function createRequest() {
  return new Request(
    "http://localhost/api/installations/installation-1/scrap/certificate/download",
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
