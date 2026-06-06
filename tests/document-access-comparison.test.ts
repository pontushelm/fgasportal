import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthenticatedUser } from "@/lib/auth"

const authenticateApiRequest = vi.fn()
const legacyDocumentFindFirst = vi.fn()
const genericDocumentFindFirst = vi.fn()
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
      findFirst: genericDocumentFindFirst,
    },
    installationDocument: {
      findFirst: legacyDocumentFindFirst,
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

const ownerUser: AuthenticatedUser = {
  userId: "owner-1",
  companyId: "company-1",
  role: "OWNER",
}

const adminUser: AuthenticatedUser = {
  userId: "admin-1",
  companyId: "company-1",
  role: "ADMIN",
}

const memberUser: AuthenticatedUser = {
  userId: "member-1",
  companyId: "company-1",
  role: "MEMBER",
}

const contractorUser: AuthenticatedUser = {
  userId: "contractor-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: false,
}

const servicepartnerAdminUser: AuthenticatedUser = {
  userId: "service-admin-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: true,
}

const accessibleInstallation = {
  companyId: "company-1",
  assignedContractorId: null,
  assignedServicePartnerCompanyId: null,
}

const legacyDocument = {
  id: "legacy-document-1",
  installationId: "installation-1",
  companyId: "company-1",
  uploadedById: "uploader-1",
  fileName: "kontrollrapport-2026.pdf",
  originalFileName: "Kontrollrapport 2026.pdf",
  fileUrl: "https://blob.example/kontrollrapport-2026.pdf",
  blobPath:
    "companies/company-1/installations/installation-1/documents/document.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3,
  documentType: "INSPECTION_REPORT",
  description: null,
  createdAt: new Date("2026-01-01"),
  installation: accessibleInstallation,
}

const genericDocument = {
  id: "generic-document-1",
  companyId: "company-1",
  originalFileName: "Kontrollrapport 2026.pdf",
  fileName: "kontrollrapport-2026.pdf",
  contentType: "application/pdf",
  sizeBytes: 3,
  storageKey:
    "companies/company-1/installations/installation-1/documents/document.pdf",
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

describe("legacy and generic document access comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({ user: ownerUser })
    legacyDocumentFindFirst.mockResolvedValue(legacyDocument)
    genericDocumentFindFirst.mockResolvedValue(genericDocument)
    installationFindFirst.mockResolvedValue(accessibleInstallation)
    installationEventFindFirst.mockResolvedValue(null)
    propertyFindFirst.mockResolvedValue(null)
    serviceOrganizationMembershipFindFirst.mockResolvedValue(null)
    blobGet.mockImplementation(() =>
      Promise.resolve({
        statusCode: 200,
        stream: byteStream([1, 2, 3]),
      })
    )
    logActivity.mockResolvedValue(undefined)
  })

  it.each([
    ["OWNER", ownerUser],
    ["ADMIN", adminUser],
    ["MEMBER", memberUser],
  ] as const)("allows %s in both legacy and generic routes", async (_role, user) => {
    const result = await downloadBothAs(user, accessibleInstallation)

    expect(result.legacy.status).toBe(200)
    expect(result.generic.status).toBe(200)
    await expectSameSuccessfulDownloadMetadata(result)
  })

  it("allows delegated contractors in both routes", async () => {
    const delegatedInstallation = {
      companyId: "company-1",
      assignedContractorId: "contractor-1",
      assignedServicePartnerCompanyId: "servicepartner-2",
    }

    const result = await downloadBothAs(contractorUser, delegatedInstallation)

    expect(result.legacy.status).toBe(200)
    expect(result.generic.status).toBe(200)
    await expectSameSuccessfulDownloadMetadata(result)
  })

  it("denies unrelated contractors in both routes", async () => {
    const unrelatedInstallation = {
      companyId: "company-1",
      assignedContractorId: "contractor-2",
      assignedServicePartnerCompanyId: "servicepartner-1",
    }

    const result = await downloadBothAs(contractorUser, unrelatedInstallation)

    expect(result.legacy.status).toBe(403)
    expect(result.generic.status).toBe(403)
    expect(blobGet).not.toHaveBeenCalled()
  })

  it("allows servicepartner admins through delegated servicepartner-company scope in both routes", async () => {
    const delegatedCompanyInstallation = {
      companyId: "company-1",
      assignedContractorId: null,
      assignedServicePartnerCompanyId: "servicepartner-1",
    }

    const result = await downloadBothAs(
      servicepartnerAdminUser,
      delegatedCompanyInstallation
    )

    expect(result.legacy.status).toBe(200)
    expect(result.generic.status).toBe(200)
    await expectSameSuccessfulDownloadMetadata(result)
  })

  it("allows event-linked generic documents when the parent installation access matches legacy access", async () => {
    const eventLinkedDocument = {
      ...genericDocument,
      links: [
        {
          entityType: "INSTALLATION_EVENT",
          entityId: "event-1",
          role: "ATTACHMENT",
        },
      ],
    }
    genericDocumentFindFirst.mockResolvedValueOnce(eventLinkedDocument)
    installationEventFindFirst.mockResolvedValueOnce({
      installation: accessibleInstallation,
    })

    const result = await downloadBothAs(ownerUser, accessibleInstallation)

    expect(result.legacy.status).toBe(200)
    expect(result.generic.status).toBe(200)
    await expectSameSuccessfulDownloadMetadata(result)
  })

  it.each(["DELETED", "REPLACED", "QUARANTINED"] as const)(
    "rejects %s generic documents before Blob access",
    async (status) => {
      genericDocumentFindFirst.mockResolvedValueOnce({
        ...genericDocument,
        status,
      })

      const { generic } = await downloadBothAs(ownerUser, accessibleInstallation)

      expect(generic.status).toBe(410)
      expect(blobGet).toHaveBeenCalledTimes(1)
    }
  )
})

async function downloadBothAs(
  user: AuthenticatedUser,
  installation: {
    companyId: string
    assignedContractorId: string | null
    assignedServicePartnerCompanyId: string | null
  }
) {
  const { GET: legacyDownload } = await import(
    "@/app/api/installations/[id]/documents/[documentId]/download/route"
  )
  const { GET: genericDownload } = await import(
    "@/app/api/documents/[id]/download/route"
  )

  authenticateApiRequest.mockResolvedValue({ user })
  legacyDocumentFindFirst.mockResolvedValue({
    ...legacyDocument,
    installation,
  })
  installationFindFirst.mockResolvedValue(installation)

  const legacy = await legacyDownload(
    new Request(
      "http://localhost/api/installations/installation-1/documents/legacy-document-1/download"
    ) as never,
    {
      params: Promise.resolve({
        id: "installation-1",
        documentId: "legacy-document-1",
      }),
    }
  )
  const generic = await genericDownload(
    new Request("http://localhost/api/documents/generic-document-1/download") as never,
    {
      params: Promise.resolve({
        id: "generic-document-1",
      }),
    }
  )

  return { legacy, generic }
}

async function expectSameSuccessfulDownloadMetadata({
  generic,
  legacy,
}: {
  generic: Response
  legacy: Response
}) {
  expect(legacy.headers.get("content-type")).toBe("application/pdf")
  expect(generic.headers.get("content-type")).toBe("application/pdf")
  expect(legacy.headers.get("content-disposition")).toContain(
    "kontrollrapport-2026.pdf"
  )
  expect(generic.headers.get("content-disposition")).toContain(
    "kontrollrapport-2026.pdf"
  )

  expect(Array.from(new Uint8Array(await legacy.arrayBuffer()))).toEqual([
    1, 2, 3,
  ])
  expect(Array.from(new Uint8Array(await generic.arrayBuffer()))).toEqual([
    1, 2, 3,
  ])
}

function byteStream(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })
}
