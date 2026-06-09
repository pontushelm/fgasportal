import { beforeEach, describe, expect, it, vi } from "vitest"

const installationFindMany = vi.fn()
const servicePartnerCompanyFindMany = vi.fn()
const certificationRecordFindMany = vi.fn()
const serviceOrganizationMembershipFindMany = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    installation: {
      findMany: installationFindMany,
    },
    servicePartnerCompany: {
      findMany: servicePartnerCompanyFindMany,
    },
    certificationRecord: {
      findMany: certificationRecordFindMany,
    },
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

describe("dashboard action loader technician certificate scope", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installationFindMany.mockResolvedValue([])
    servicePartnerCompanyFindMany.mockResolvedValue([])
    certificationRecordFindMany.mockResolvedValue([])
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "service-company-1",
      serviceOrganizationId: "service-org-1",
    })
    serviceOrganizationMembershipFindMany.mockResolvedValue([
      createTechnicianMembership({
        user: {
          id: "technician-1",
          name: "Anna Tekniker",
          email: "anna@example.com",
          certificationNumber: null,
          certificationIssuer: null,
          certificationValidUntil: null,
          certificationCategory: null,
          certificationRecords: [],
          memberships: [
            {
              id: "membership-1",
              certificationNumber: null,
              certificationOrganization: null,
              certificationValidUntil: null,
            },
          ],
        },
      }),
    ])
  })

  it("loads technician certificate actions for the active service organization", async () => {
    const { loadDashboardActions } = await import(
      "@/lib/actions/load-dashboard-actions"
    )

    const actions = await loadDashboardActions({
      userId: "service-admin-1",
      membershipId: "membership-admin-1",
      companyId: "company-1",
      role: "CONTRACTOR",
      servicePartnerCompanyId: "service-company-1",
      isServicePartnerAdmin: true,
    })

    expect(serviceOrganizationMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceOrganizationId: "service-org-1",
          user: expect.objectContaining({
            memberships: expect.objectContaining({
              some: expect.objectContaining({
                companyId: "company-1",
                role: "CONTRACTOR",
                isActive: true,
                servicePartnerCompanyId: "service-company-1",
              }),
            }),
          }),
        }),
      })
    )
    expect(actions).toEqual([
      expect.objectContaining({
        type: "TECHNICIAN_CERTIFICATE_MISSING",
        installationName: "Anna Tekniker",
        servicePartnerCompanyId: "service-company-1",
      }),
    ])
  })

  it("limits normal technicians to their own technician certificate action", async () => {
    const { loadDashboardActions } = await import(
      "@/lib/actions/load-dashboard-actions"
    )

    await loadDashboardActions({
      userId: "technician-1",
      membershipId: "membership-1",
      companyId: "company-1",
      role: "CONTRACTOR",
      servicePartnerCompanyId: "service-company-1",
      isServicePartnerAdmin: false,
    })

    expect(serviceOrganizationMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceOrganizationId: "service-org-1",
          userId: "technician-1",
        }),
      })
    )
  })
})

function createTechnicianMembership(overrides = {}) {
  return {
    role: "TECHNICIAN",
    serviceOrganization: {
      name: "Kylservice AB",
    },
    user: {
      id: "technician-1",
      name: "Anna Tekniker",
      email: "anna@example.com",
      certificationNumber: null,
      certificationIssuer: null,
      certificationValidUntil: null,
      certificationCategory: null,
      certificationRecords: [],
      memberships: [
        {
          id: "membership-1",
          certificationNumber: null,
          certificationOrganization: null,
          certificationValidUntil: null,
        },
      ],
    },
    ...overrides,
  }
}
