import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const documentFindFirst = vi.fn()
const installationFindFirst = vi.fn()
const installationEventFindFirst = vi.fn()
const propertyFindFirst = vi.fn()
const serviceOrganizationMembershipFindFirst = vi.fn()
const blobGet = vi.fn()
const logActivity = vi.fn()

vi.mock("@vercel/blob", () => ({
  get: blobGet,
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
    document: {
      findFirst: documentFindFirst,
    },
    installation: {
      findFirst: installationFindFirst,
    },
    installationEvent: {
      findFirst: installationEventFindFirst,
    },
    property: {
      findFirst: propertyFindFirst,
    },
    serviceOrganizationMembership: {
      findFirst: serviceOrganizationMembershipFindFirst,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "document-1",
  }),
}

const baseDocument = {
  id: "document-1",
  companyId: "company-1",
  originalFileName: "Kontrollrapport 2026.pdf",
  fileName: "kontrollrapport-2026.pdf",
  contentType: "application/pdf",
  sizeBytes: 3,
  storageKey:
    "companies/company-1/installations/installation-1/documents/document-1.pdf",
  category: "INSPECTION_REPORT",
  status: "ACTIVE",
  links: [
    {
      entityType: "INSTALLATION",
      entityId: "installation-1",
      role: "ATTACHMENT",
    },
  ],
}

describe("generic document download route", () => {
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
    documentFindFirst.mockResolvedValue(baseDocument)
    installationFindFirst.mockResolvedValue({
      companyId: "company-1",
      assignedContractorId: null,
      assignedServicePartnerCompanyId: null,
    })
    installationEventFindFirst.mockResolvedValue(null)
    propertyFindFirst.mockResolvedValue(null)
    serviceOrganizationMembershipFindFirst.mockResolvedValue(null)
    blobGet.mockResolvedValue({
      statusCode: 200,
      stream: byteStream([1, 2, 3]),
    })
    logActivity.mockResolvedValue(undefined)
  })

  it("downloads installation-linked generic documents for tenant users", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")

    const response = await GET(createRequest(), routeContext)
    const body = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(Array.from(body)).toEqual([1, 2, 3])
    expect(documentFindFirst).toHaveBeenCalledWith({
      where: {
        id: "document-1",
        companyId: "company-1",
      },
      select: {
        id: true,
        companyId: true,
        originalFileName: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        storageKey: true,
        category: true,
        status: true,
        links: {
          select: {
            entityType: true,
            entityId: true,
            role: true,
          },
        },
      },
    })
    expect(blobGet).toHaveBeenCalledWith(baseDocument.storageKey, {
      access: "public",
      token: "blob-token",
    })
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toContain(
      "kontrollrapport-2026.pdf"
    )
  })

  it("allows contractors through delegated installation access", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        servicePartnerCompanyId: "servicepartner-1",
        isServicePartnerAdmin: false,
      },
    })
    installationFindFirst.mockResolvedValueOnce({
      companyId: "company-1",
      assignedContractorId: "contractor-1",
      assignedServicePartnerCompanyId: "servicepartner-2",
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
  })

  it("denies contractors without delegated installation access", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        servicePartnerCompanyId: "servicepartner-1",
        isServicePartnerAdmin: false,
      },
    })
    installationFindFirst.mockResolvedValueOnce({
      companyId: "company-1",
      assignedContractorId: "contractor-2",
      assignedServicePartnerCompanyId: "servicepartner-1",
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(403)
    expect(blobGet).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it.each(["DELETED", "REPLACED", "QUARANTINED"] as const)(
    "rejects %s generic documents",
    async (status) => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      documentFindFirst.mockResolvedValueOnce({
        ...baseDocument,
        status,
      })

      const response = await GET(createRequest(), routeContext)

      expect(response.status).toBe(410)
      expect(blobGet).not.toHaveBeenCalled()
      expect(logActivity).not.toHaveBeenCalled()
    }
  )

  it("returns 404 for missing documents", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    documentFindFirst.mockResolvedValueOnce(null)

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(404)
    expect(blobGet).not.toHaveBeenCalled()
  })

  it("allows company-linked documents for tenant users", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    documentFindFirst.mockResolvedValueOnce({
      ...baseDocument,
      category: "AUTHORITY_DOCUMENT",
      links: [
        {
          entityType: "COMPANY",
          entityId: "company-1",
          role: "ATTACHMENT",
        },
      ],
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
  })

  it("allows property-linked documents for contractors with delegated aggregat on the property", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        servicePartnerCompanyId: "servicepartner-1",
        isServicePartnerAdmin: true,
      },
    })
    documentFindFirst.mockResolvedValueOnce({
      ...baseDocument,
      links: [
        {
          entityType: "PROPERTY",
          entityId: "property-1",
          role: "ATTACHMENT",
        },
      ],
    })
    propertyFindFirst.mockResolvedValueOnce({ id: "property-1" })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
    expect(propertyFindFirst).toHaveBeenCalledWith({
      where: {
        id: "property-1",
        companyId: "company-1",
        installations: {
          some: {
            AND: [
              {
                companyId: "company-1",
              },
              {
                OR: [
                  {
                    assignedContractorId: "contractor-1",
                  },
                  {
                    assignedServicePartnerCompanyId: "servicepartner-1",
                  },
                ],
              },
            ],
          },
        },
      },
      select: {
        id: true,
      },
    })
  })

  it("allows service organization linked documents for organization members", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        serviceOrganizationId: "service-org-1",
      },
    })
    documentFindFirst.mockResolvedValueOnce({
      ...baseDocument,
      links: [
        {
          entityType: "SERVICE_ORGANIZATION",
          entityId: "service-org-1",
          role: "CERTIFICATE",
        },
      ],
    })

    const response = await GET(createRequest(), routeContext)

    expect(response.status).toBe(200)
  })

  it("logs successful generic document downloads with granted entity metadata", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route")

    await GET(createRequest(), routeContext)

    expect(logActivity).toHaveBeenCalledWith({
      companyId: "company-1",
      userId: "owner-1",
      action: "document_downloaded_generic",
      entityType: "document",
      entityId: "document-1",
      metadata: {
        documentId: "document-1",
        category: "INSPECTION_REPORT",
        entityType: "INSTALLATION",
        entityId: "installation-1",
      },
    })
  })
})

function createRequest() {
  return new Request("http://localhost/api/documents/document-1/download", {
    method: "GET",
  }) as never
}

function byteStream(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}
