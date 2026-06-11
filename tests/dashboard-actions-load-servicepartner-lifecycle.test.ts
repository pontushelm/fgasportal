import { beforeEach, describe, expect, it, vi } from "vitest"

const certificationRecordFindMany = vi.fn()
const companyMembershipFindMany = vi.fn()
const installationFindMany = vi.fn()
const invitationFindMany = vi.fn()
const serviceOrganizationMembershipFindMany = vi.fn()
const servicePartnerCompanyFindMany = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    certificationRecord: {
      findMany: certificationRecordFindMany,
    },
    companyMembership: {
      findMany: companyMembershipFindMany,
    },
    installation: {
      findMany: installationFindMany,
    },
    invitation: {
      findMany: invitationFindMany,
    },
    serviceOrganizationMembership: {
      findMany: serviceOrganizationMembershipFindMany,
    },
    servicePartnerCompany: {
      findMany: servicePartnerCompanyFindMany,
    },
  },
}))

vi.mock("@/lib/service-organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-organizations")>(
    "@/lib/service-organizations"
  )

  return {
    ...actual,
    ensureServiceOrganizationForLegacyCompany: vi.fn(),
  }
})

describe("dashboard action loader servicepartner lifecycle scope", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installationFindMany.mockResolvedValue([])
    servicePartnerCompanyFindMany.mockResolvedValue([
      {
        id: "service-company-1",
        companyId: "company-1",
        contactEmail: "kontakt@service.example",
        serviceOrganizationId: "service-org-1",
        name: "Kylservice AB",
        organizationNumber: "556000-0000",
        certificateNumber: null,
        serviceOrganization: {
          certificateNumber: null,
          contactEmail: "kontakt@service.example",
          name: "Kylservice AB",
          organizationNumber: "556000-0000",
        },
      },
    ])
    certificationRecordFindMany.mockResolvedValue([])
    invitationFindMany.mockResolvedValue([])
    companyMembershipFindMany.mockResolvedValue([])
    serviceOrganizationMembershipFindMany.mockResolvedValue([])
  })

  it("loads lifecycle actions from tenant-scoped servicepartner data", async () => {
    const { loadDashboardActions } = await import(
      "@/lib/actions/load-dashboard-actions"
    )
    invitationFindMany.mockResolvedValueOnce([
      {
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        serviceOrganizationId: "service-org-1",
        servicePartnerCompanyId: null,
      },
    ])

    const actions = await loadDashboardActions({
      userId: "owner-1",
      membershipId: "membership-1",
      companyId: "company-1",
      role: "OWNER",
    })

    expect(servicePartnerCompanyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
        },
      })
    )
    expect(invitationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          role: "CONTRACTOR",
        }),
      })
    )
    expect(companyMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          role: "CONTRACTOR",
        }),
      })
    )
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SERVICEPARTNER_INVITE_EXPIRED",
          servicePartnerCompanyId: "service-company-1",
        }),
      ])
    )
    expect(
      actions.some((action) => action.servicePartnerCompanyId === "other-company")
    ).toBe(false)
  })
})
