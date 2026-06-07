import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const installationFindFirst = vi.fn()
const documentFindMany = vi.fn()
const installationEventFindMany = vi.fn()
const installationDocumentFindMany = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/db", () => ({
  prisma: {
    installation: {
      findFirst: installationFindFirst,
    },
    document: {
      findMany: documentFindMany,
    },
    installationEvent: {
      findMany: installationEventFindMany,
    },
    installationDocument: {
      findMany: installationDocumentFindMany,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({
    id: "installation-1",
  }),
}

const authUser = {
  userId: "owner-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "OWNER",
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
  contentType: "application/pdf",
  sizeBytes: 123,
  category: "INSPECTION_REPORT",
  description: "Kontroll",
  createdAt: new Date("2026-01-02"),
  status: "ACTIVE",
  legacyInstallationDocumentId: "legacy-document-1",
  uploadedBy: {
    name: "Owner",
    email: "owner@example.com",
  },
  links: [
    {
      entityType: "INSTALLATION",
      entityId: "installation-1",
    },
  ],
}

const legacyDocument = {
  id: "legacy-document-1",
  uploadedById: "owner-1",
  originalFileName: "Legacy rapport.pdf",
  mimeType: "application/pdf",
  sizeBytes: 456,
  documentType: "SERVICE_REPORT",
  description: null,
  createdAt: new Date("2026-01-01"),
  uploadedBy: {
    name: "Owner",
    email: "owner@example.com",
  },
  event: null,
}

describe("installation document list generic reads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: authUser,
    })
    installationFindFirst.mockResolvedValue(installation)
    documentFindMany.mockResolvedValue([])
    installationEventFindMany.mockResolvedValue([])
    installationDocumentFindMany.mockResolvedValue([])
  })

  it("prefers generic Document records and uses generic download hrefs", async () => {
    documentFindMany.mockResolvedValueOnce([genericDocument])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: "generic-document-1",
      uploadedById: "owner-1",
      originalFileName: "Kontrollrapport.pdf",
      downloadHref: "/api/documents/generic-document-1/download",
      mimeType: "application/pdf",
      sizeBytes: 123,
      documentType: "INSPECTION_REPORT",
      description: "Kontroll",
      uploadedBy: {
        name: "Owner",
        email: "owner@example.com",
      },
      event: null,
    })
    expect(body[0]).not.toHaveProperty("fileUrl")
  })

  it("falls back to legacy InstallationDocument records when no generic record exists", async () => {
    installationDocumentFindMany.mockResolvedValueOnce([legacyDocument])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: "legacy-document-1",
      downloadHref:
        "/api/installations/installation-1/documents/legacy-document-1/download",
      mimeType: "application/pdf",
      documentType: "SERVICE_REPORT",
    })
  })

  it("does not duplicate dual-written legacy rows", async () => {
    documentFindMany.mockResolvedValueOnce([genericDocument])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(body).toHaveLength(1)
    expect(installationDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            notIn: ["legacy-document-1"],
          },
        }),
      })
    )
  })

  it("returns event info for generic documents linked to installation events", async () => {
    documentFindMany.mockResolvedValueOnce([
      {
        ...genericDocument,
        links: [
          ...genericDocument.links,
          {
            entityType: "INSTALLATION_EVENT",
            entityId: "event-1",
          },
        ],
      },
    ])
    installationEventFindMany.mockResolvedValueOnce([
      {
        id: "event-1",
        type: "SERVICE",
        date: new Date("2026-01-03"),
      },
    ])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(installationEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ["event-1"],
          },
          installationId: "installation-1",
        }),
      })
    )
    expect(body[0].event).toMatchObject({
      id: "event-1",
      type: "SERVICE",
    })
  })

  it("keeps generic and unmigrated legacy records in created order", async () => {
    documentFindMany.mockResolvedValueOnce([
      {
        ...genericDocument,
        createdAt: new Date("2026-01-01"),
      },
    ])
    installationDocumentFindMany.mockResolvedValueOnce([
      {
        ...legacyDocument,
        id: "legacy-document-2",
        createdAt: new Date("2026-01-03"),
      },
    ])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(body.map((document: { id: string }) => document.id)).toEqual([
      "legacy-document-2",
      "generic-document-1",
    ])
  })

  it("hides deleted generic documents and does not fall back to their legacy rows", async () => {
    documentFindMany.mockResolvedValueOnce([
      {
        ...genericDocument,
        status: "DELETED",
      },
    ])
    const { GET } = await import("@/app/api/installations/[id]/documents/route")

    const response = await GET(createRequest(), routeContext)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([])
    expect(installationDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            notIn: ["legacy-document-1"],
          },
        }),
      })
    )
  })
})

function createRequest() {
  return new Request(
    "http://localhost/api/installations/installation-1/documents",
    {
      method: "GET",
    }
  ) as never
}
