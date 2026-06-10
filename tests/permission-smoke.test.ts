import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const loadDashboardActions = vi.fn()
const loadDataQualityReport = vi.fn()
const blobGet = vi.fn()
const logActivity = vi.fn()
const transaction = vi.fn()

const installationFindFirst = vi.fn()
const installationFindMany = vi.fn()
const propertyFindMany = vi.fn()
const propertyFindFirst = vi.fn()
const serviceOrganizationMembershipFindFirst = vi.fn()
const certificationRecordFindFirst = vi.fn()
const certificationRecordUpdate = vi.fn()
const documentFindFirst = vi.fn()
const signedReportArtifactFindFirst = vi.fn()

vi.mock("@vercel/blob", () => ({
  get: blobGet,
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behorighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/actions/load-dashboard-actions", () => ({
  loadDashboardActions,
}))

vi.mock("@/lib/dashboard/load-data-quality-report", () => ({
  loadDataQualityReport,
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

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    installation: {
      findFirst: installationFindFirst,
      findMany: installationFindMany,
    },
    property: {
      findMany: propertyFindMany,
      findFirst: propertyFindFirst,
    },
    serviceOrganizationMembership: {
      findFirst: serviceOrganizationMembershipFindFirst,
    },
    certificationRecord: {
      findFirst: certificationRecordFindFirst,
      update: certificationRecordUpdate,
    },
    document: {
      findFirst: documentFindFirst,
    },
    companyMembership: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    signedReportArtifact: {
      findFirst: signedReportArtifactFindFirst,
    },
    user: {
      update: vi.fn(),
    },
  },
}))

const owner = {
  userId: "owner-a",
  membershipId: "membership-owner-a",
  companyId: "company-a",
  role: "OWNER",
}

const admin = {
  userId: "admin-a",
  membershipId: "membership-admin-a",
  companyId: "company-a",
  role: "ADMIN",
}

const member = {
  userId: "member-a",
  membershipId: "membership-member-a",
  companyId: "company-a",
  role: "MEMBER",
}

const technician = {
  userId: "technician-a",
  membershipId: "membership-technician-a",
  companyId: "company-a",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-a",
  serviceOrganizationId: "service-org-a",
  isServicePartnerAdmin: false,
}

const serviceAdmin = {
  ...technician,
  userId: "service-admin-a",
  membershipId: "membership-service-admin-a",
  isServicePartnerAdmin: true,
}

const baseDocument = {
  id: "document-a",
  companyId: "company-a",
  originalFileName: "certifikat.pdf",
  fileName: "certifikat.pdf",
  contentType: "application/pdf",
  sizeBytes: 3,
  storageKey: "companies/company-a/certifications/document-a.pdf",
  category: "PERSONAL_FGAS_CERTIFICATE",
  status: "ACTIVE",
  links: [
    {
      entityType: "CERTIFICATION_RECORD",
      entityId: "certification-a",
      role: "CERTIFICATE",
    },
  ],
}

describe("pilot permission smoke suite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    authenticateApiRequest.mockResolvedValue({ user: owner })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-a",
      serviceOrganizationId: "service-org-a",
    })
    blobGet.mockResolvedValue({
      blob: { contentType: "application/pdf" },
      statusCode: 200,
      stream: byteStream([1, 2, 3]),
    })
    logActivity.mockResolvedValue(undefined)
    transaction.mockImplementation((callback) => callback(createSettingsTransactionClient()))
  })

  describe("multi-company isolation", () => {
    it("scopes installation detail lookup to the active company", async () => {
      const { GET } = await import("@/app/api/installations/[id]/route")
      installationFindFirst.mockResolvedValueOnce(null)

      const response = await GET(createRequest("/api/installations/installation-b"), {
        params: Promise.resolve({ id: "installation-b" }),
      })

      expect(response.status).toBe(404)
      expect(installationFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                companyId: "company-a",
              },
              {
                id: "installation-b",
              },
            ],
          },
        })
      )
    })

    it("returns only active-company properties for customer users", async () => {
      const { GET } = await import("@/app/api/properties/route")
      propertyFindMany.mockResolvedValueOnce([])

      const response = await GET(createRequest("/api/properties"))

      expect(response.status).toBe(200)
      expect(propertyFindMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-a",
        },
        orderBy: [{ name: "asc" }],
      })
    })
  })

  describe("servicepartner isolation", () => {
    it("prevents servicepartner admins from managing technicians outside their organization", async () => {
      const { PATCH } = await import(
        "@/app/api/dashboard/service/technicians/[userId]/certification/route"
      )
      authenticateApiRequest.mockResolvedValueOnce({ user: serviceAdmin })
      serviceOrganizationMembershipFindFirst.mockResolvedValueOnce(null)

      const response = await PATCH(
        jsonRequest("/api/dashboard/service/technicians/technician-b/certification", {
          certificateNumber: "PCERT-B",
        }),
        { params: Promise.resolve({ userId: "technician-b" }) }
      )

      expect(response.status).toBe(404)
      expect(certificationRecordUpdate).not.toHaveBeenCalled()
      expect(serviceOrganizationMembershipFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceOrganizationId: "service-org-a",
            userId: "technician-b",
          }),
        })
      )
    })

    it("prevents technicians from reading another technician certificate document", async () => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: technician })
      documentFindFirst.mockResolvedValueOnce({
        ...baseDocument,
        links: [
          {
            entityType: "CERTIFICATION_RECORD",
            entityId: "certification-b",
            role: "CERTIFICATE",
          },
        ],
      })
      certificationRecordFindFirst.mockResolvedValueOnce(null)

      const response = await GET(createRequest("/api/documents/document-a/download"), {
        params: Promise.resolve({ id: "document-a" }),
      })

      expect(response.status).toBe(403)
      expect(blobGet).not.toHaveBeenCalled()
    })
  })

  describe("certification documents", () => {
    it("allows technicians to download their own certificate document", async () => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: technician })
      documentFindFirst.mockResolvedValueOnce(baseDocument)
      certificationRecordFindFirst.mockResolvedValueOnce({
        certificateType: "PERSONAL_FGAS",
        serviceOrganizationId: "service-org-a",
        subjectType: "TECHNICIAN",
        userId: "technician-a",
      })

      const response = await GET(createRequest("/api/documents/document-a/download"), {
        params: Promise.resolve({ id: "document-a" }),
      })

      expect(response.status).toBe(200)
      expect(blobGet).toHaveBeenCalled()
    })

    it("allows servicepartner admins to download technician documents in the same organization", async () => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: serviceAdmin })
      documentFindFirst.mockResolvedValueOnce(baseDocument)
      certificationRecordFindFirst.mockResolvedValueOnce({
        certificateType: "PERSONAL_FGAS",
        serviceOrganizationId: "service-org-a",
        subjectType: "TECHNICIAN",
        userId: "technician-a",
      })
      serviceOrganizationMembershipFindFirst.mockResolvedValueOnce({ id: "som-admin" })

      const response = await GET(createRequest("/api/documents/document-a/download"), {
        params: Promise.resolve({ id: "document-a" }),
      })

      expect(response.status).toBe(200)
      expect(serviceOrganizationMembershipFindFirst).toHaveBeenCalledWith({
        where: {
          serviceOrganizationId: "service-org-a",
          userId: "service-admin-a",
          role: "ADMIN",
          isActive: true,
        },
        select: {
          id: true,
        },
      })
    })

    it("denies servicepartner admins for technician documents in another organization", async () => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: serviceAdmin })
      documentFindFirst.mockResolvedValueOnce(baseDocument)
      certificationRecordFindFirst.mockResolvedValueOnce({
        certificateType: "PERSONAL_FGAS",
        serviceOrganizationId: "service-org-b",
        subjectType: "TECHNICIAN",
        userId: "technician-b",
      })

      const response = await GET(createRequest("/api/documents/document-a/download"), {
        params: Promise.resolve({ id: "document-a" }),
      })

      expect(response.status).toBe(403)
      expect(blobGet).not.toHaveBeenCalled()
    })
  })

  describe("company certificates", () => {
    it("allows servicepartner admins to download their own company certificate document", async () => {
      const { GET } = await import("@/app/api/documents/[id]/download/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: serviceAdmin })
      documentFindFirst.mockResolvedValueOnce({
        ...baseDocument,
        category: "SERVICE_ORGANIZATION_CERTIFICATE",
      })
      certificationRecordFindFirst.mockResolvedValueOnce({
        certificateType: "COMPANY_FGAS",
        serviceOrganizationId: "service-org-a",
        subjectType: "SERVICE_ORGANIZATION",
        userId: null,
      })
      serviceOrganizationMembershipFindFirst.mockResolvedValueOnce({ id: "som-admin" })

      const response = await GET(createRequest("/api/documents/document-a/download"), {
        params: Promise.resolve({ id: "document-a" }),
      })

      expect(response.status).toBe(200)
    })

    it.each([owner, admin, member])(
      "denies customer role $role from modifying servicepartner company certificate documents",
      async (user) => {
        const { POST } = await import(
          "@/app/api/dashboard/service/company/certification/document/route"
        )
        authenticateApiRequest.mockResolvedValueOnce({ user })

        const response = await POST(createUploadRequest())

        expect(response.status).toBe(403)
        expect(documentFindFirst).not.toHaveBeenCalled()
      }
    )
  })

  describe("reports", () => {
    it("keeps signed report artifact downloads tenant scoped", async () => {
      const { GET } = await import("@/app/api/reports/artifacts/[id]/download/route")
      signedReportArtifactFindFirst.mockResolvedValueOnce(null)

      const response = await GET(createRequest("/api/reports/artifacts/artifact-b/download"), {
        params: Promise.resolve({ id: "artifact-b" }),
      })

      expect(response.status).toBe(404)
      expect(signedReportArtifactFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "artifact-b",
            companyId: "company-a",
          },
        })
      )
      expect(blobGet).not.toHaveBeenCalled()
    })

    it("prevents users from downloading another company report artifact even with a known id", async () => {
      const { GET } = await import("@/app/api/reports/artifacts/[id]/download/route")
      signedReportArtifactFindFirst.mockResolvedValueOnce(null)

      const response = await GET(
        createRequest("/api/reports/artifacts/company-b-artifact/download"),
        { params: Promise.resolve({ id: "company-b-artifact" }) }
      )

      expect(response.status).toBe(404)
      expect(signedReportArtifactFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: "company-a",
            id: "company-b-artifact",
          }),
        })
      )
    })
  })

  describe("actions and data quality", () => {
    it("loads actions only for the authenticated active company", async () => {
      const { GET } = await import("@/app/api/dashboard/actions/route")
      loadDashboardActions.mockResolvedValueOnce([
        {
          id: "action-a",
          companyId: "company-a",
          type: "OVERDUE_INSPECTION",
        },
      ])

      const response = await GET(createRequest("/api/dashboard/actions"))

      expect(response.status).toBe(200)
      expect(loadDashboardActions).toHaveBeenCalledWith(owner)
    })

    it("loads data quality only for the authenticated active company", async () => {
      const { GET } = await import("@/app/api/dashboard/data-quality/route")
      loadDataQualityReport.mockResolvedValueOnce({
        issues: [],
        score: 100,
        totalIssueCount: 0,
      })

      const response = await GET(createRequest("/api/dashboard/data-quality"))

      expect(response.status).toBe(200)
      expect(loadDataQualityReport).toHaveBeenCalledWith(owner)
    })
  })

  describe("settings", () => {
    it("updates only the authenticated technician's own CertificationRecord", async () => {
      const { PATCH } = await import("@/app/api/user/technician-certification/route")
      authenticateApiRequest.mockResolvedValueOnce({ user: technician })
      certificationRecordFindFirst.mockResolvedValueOnce({
        id: "certification-a",
      })
      certificationRecordUpdate.mockResolvedValueOnce({
        certificateNumber: "PCERT-A",
      })

      const response = await PATCH(
        jsonRequest("/api/user/technician-certification", {
          certificateNumber: "PCERT-A",
          issuer: "INCERT",
          category: "I",
          validUntil: "2027-01-01",
        })
      )

      expect(response.status).toBe(200)
      expect(certificationRecordFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: "company-a",
            serviceOrganizationId: "service-org-a",
            subjectType: "TECHNICIAN",
            certificateType: "PERSONAL_FGAS",
            userId: "technician-a",
          }),
        })
      )
      expect(certificationRecordUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "certification-a",
          },
        })
      )
    })
  })
})

function createRequest(path: string) {
  return new Request(`http://localhost${path}`) as never
}

function jsonRequest(path: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  }) as never
}

function createUploadRequest() {
  const formData = new FormData()
  formData.set("file", new File(["pdf"], "certifikat.pdf", { type: "application/pdf" }))

  return new Request(
    "http://localhost/api/dashboard/service/company/certification/document",
    {
      body: formData,
      method: "POST",
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

function createSettingsTransactionClient() {
  return {
    certificationRecord: {
      create: vi.fn().mockResolvedValue(createTechnicianCertificationRecord()),
      findFirst: certificationRecordFindFirst,
      update: certificationRecordUpdate,
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue({
        id: "membership-technician-a",
        certificationNumber: null,
        certificationOrganization: null,
        certificationValidUntil: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "membership-technician-a",
        certificationNumber: "PCERT-A",
        certificationOrganization: "INCERT",
        certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
      }),
    },
    user: {
      update: vi.fn().mockResolvedValue({
        id: "technician-a",
        certificationNumber: "PCERT-A",
        certificationIssuer: "INCERT",
        certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
        certificationCategory: "I",
      }),
    },
  }
}

function createTechnicianCertificationRecord() {
  return {
    id: "certification-a",
    companyId: "company-a",
    serviceOrganizationId: "service-org-a",
    userId: "technician-a",
    subjectType: "TECHNICIAN",
    certificateType: "PERSONAL_FGAS",
    certificateNumber: "PCERT-A",
    issuer: "INCERT",
    category: "I",
    validFrom: null,
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    status: "ACTIVE",
    verificationStatus: "SELF_DECLARED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  }
}
