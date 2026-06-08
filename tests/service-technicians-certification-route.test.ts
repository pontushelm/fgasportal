import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const serviceOrganizationMembershipFindMany = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behorighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceOrganizationMembership: {
      findMany: serviceOrganizationMembershipFindMany,
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

const authUser = {
  userId: "service-admin-1",
  membershipId: "membership-admin-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  isServicePartnerAdmin: true,
}

describe("servicepartner technicians API certification summary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: authUser })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    serviceOrganizationMembershipFindMany.mockResolvedValue([])
  })

  it("returns CertificationRecord status before legacy fields", async () => {
    const { GET } = await import("@/app/api/dashboard/service/technicians/route")
    serviceOrganizationMembershipFindMany.mockResolvedValueOnce([
      createMembership({
        user: createUser({
          certificationNumber: "USER-1",
          certificationRecords: [
            createCertificationRecord({
              certificateNumber: "REC-1",
              issuer: "INCERT",
              category: "Kategori I",
              validUntil: new Date("2027-01-01T00:00:00.000Z"),
            }),
          ],
          memberships: [
            createCompanyMembership({
              certificationNumber: "MEMBER-1",
            }),
          ],
        }),
      }),
    ])

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].certification).toMatchObject({
      certificateNumber: "REC-1",
      issuer: "INCERT",
      category: "Kategori I",
      source: "CertificationRecord",
      status: {
        status: "VALID",
        label: "Giltigt",
      },
    })
  })

  it("falls back to user legacy certification fields", async () => {
    const { GET } = await import("@/app/api/dashboard/service/technicians/route")
    serviceOrganizationMembershipFindMany.mockResolvedValueOnce([
      createMembership({
        user: createUser({
          certificationNumber: "USER-1",
          certificationIssuer: "User issuer",
          certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
          memberships: [
            createCompanyMembership({
              certificationNumber: "MEMBER-1",
            }),
          ],
        }),
      }),
    ])

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].certification).toMatchObject({
      certificateNumber: "USER-1",
      issuer: "User issuer",
      source: "User legacy",
    })
  })

  it("falls back to company membership legacy certification fields", async () => {
    const { GET } = await import("@/app/api/dashboard/service/technicians/route")
    serviceOrganizationMembershipFindMany.mockResolvedValueOnce([
      createMembership({
        user: createUser({
          certificationNumber: null,
          memberships: [
            createCompanyMembership({
              certificationNumber: "MEMBER-1",
              certificationOrganization: "Kiwa",
              certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
            }),
          ],
        }),
      }),
    ])

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].certification).toMatchObject({
      certificateNumber: "MEMBER-1",
      issuer: "Kiwa",
      source: "CompanyMembership legacy",
    })
  })

  it("returns missing status when no certification source exists", async () => {
    const { GET } = await import("@/app/api/dashboard/service/technicians/route")
    serviceOrganizationMembershipFindMany.mockResolvedValueOnce([
      createMembership(),
    ])

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].certification).toMatchObject({
      certificateNumber: null,
      source: "none",
      status: {
        status: "MISSING",
        label: "Saknas",
      },
    })
  })
})

function createRequest() {
  return new Request("http://localhost/api/dashboard/service/technicians", {
    method: "GET",
  }) as never
}

function createMembership(overrides = {}) {
  return {
    id: "service-org-membership-1",
    role: "TECHNICIAN",
    user: createUser(),
    ...overrides,
  }
}

function createUser(overrides = {}) {
  return {
    id: "technician-1",
    name: "Tekniker Ett",
    email: "tekniker@example.com",
    certificationNumber: null,
    certificationIssuer: null,
    certificationValidUntil: null,
    certificationCategory: null,
    certificationRecords: [],
    memberships: [],
    ...overrides,
  }
}

function createCompanyMembership(overrides = {}) {
  return {
    id: "company-membership-1",
    certificationNumber: null,
    certificationOrganization: null,
    certificationValidUntil: null,
    ...overrides,
  }
}

function createCertificationRecord(overrides = {}) {
  return {
    id: "cert-record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    userId: "technician-1",
    subjectType: "TECHNICIAN",
    certificateType: "PERSONAL_FGAS",
    certificateNumber: "REC-1",
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: null,
    status: "ACTIVE",
    verificationStatus: "SELF_DECLARED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}
