import { describe, expect, it } from "vitest"
import {
  buildCompanyServiceOrganizationCreateData,
  buildServiceOrganizationBackfillPlan,
  buildServiceOrganizationCreateData,
  mapServiceOrganizationRole,
  resolveServiceOrganizationIdFromLegacyCompany,
  toServiceOrganizationBackedCompany,
} from "@/lib/service-organizations"
import { buildServiceOrganizationMembershipCreateData } from "@/lib/service-organization-memberships"

describe("service organization transition helpers", () => {
  it("builds a global service organization from a legacy customer-scoped servicepartner company", () => {
    expect(
      buildServiceOrganizationCreateData({
        id: "spc_1",
        companyId: "customer_1",
        name: "Elins kylföretag",
        organizationNumber: "559000-0000",
        contactEmail: "info@example.com",
        phone: "010-123 45 67",
        certificateNumber: "CERT-1",
      })
    ).toEqual({
      name: "Elins kylföretag",
      organizationNumber: "559000-0000",
      contactEmail: "info@example.com",
      phone: "010-123 45 67",
      certificateNumber: "CERT-1",
    })
  })

  it("creates customer relationship data separately from the global organization", () => {
    expect(
      buildCompanyServiceOrganizationCreateData({
        companyId: "customer_1",
        serviceOrganizationId: "so_1",
        displayName: "Elins kylföretag",
      })
    ).toEqual({
      companyId: "customer_1",
      serviceOrganizationId: "so_1",
      displayName: "Elins kylföretag",
    })
  })

  it("maps servicepartner admin memberships to global organization admin role", () => {
    expect(mapServiceOrganizationRole(true)).toBe("ADMIN")
    expect(mapServiceOrganizationRole(false)).toBe("TECHNICIAN")
  })

  it("builds membership data with the same uniqueness keys used by Prisma", () => {
    expect(
      buildServiceOrganizationMembershipCreateData({
        serviceOrganizationId: "so_1",
        userId: "user_1",
        isServicePartnerAdmin: true,
      })
    ).toEqual({
      serviceOrganizationId: "so_1",
      userId: "user_1",
      role: "ADMIN",
      isActive: true,
    })
  })

  it("resolves an existing bridge without changing legacy behavior", () => {
    expect(
      resolveServiceOrganizationIdFromLegacyCompany({
        serviceOrganizationId: "so_1",
      })
    ).toBe("so_1")
    expect(resolveServiceOrganizationIdFromLegacyCompany({})).toBeNull()
  })

  it("uses global service organization fields as primary identity when bridged", () => {
    expect(
      toServiceOrganizationBackedCompany({
        id: "spc_1",
        companyId: "customer_1",
        serviceOrganizationId: "so_1",
        name: "Kundspecifikt namn",
        organizationNumber: null,
        contactEmail: null,
        phone: null,
        certificateNumber: null,
        notes: "Kundanteckning",
        serviceOrganization: {
          id: "so_1",
          name: "Global Service AB",
          organizationNumber: "559000-0000",
          contactEmail: "info@service.example",
          phone: "010-123 45 67",
          certificateNumber: "FCERT-1",
        },
      })
    ).toEqual({
      id: "spc_1",
      serviceOrganizationId: "so_1",
      name: "Global Service AB",
      organizationNumber: "559000-0000",
      contactEmail: "info@service.example",
      phone: "010-123 45 67",
      certificateNumber: "FCERT-1",
      notes: "Kundanteckning",
    })
  })

  it("plans one global organization per legacy company without fuzzy deduplication", () => {
    const plan = buildServiceOrganizationBackfillPlan({
      servicePartnerCompanies: [
        {
          id: "spc_1",
          companyId: "customer_1",
          name: "Service AB",
          organizationNumber: null,
        },
        {
          id: "spc_2",
          companyId: "customer_2",
          name: "Service AB",
          organizationNumber: null,
        },
      ],
      memberships: [
        {
          id: "membership_1",
          userId: "user_1",
          servicePartnerCompanyId: "spc_1",
          isServicePartnerAdmin: true,
        },
      ],
    })

    expect(plan.serviceOrganizations).toHaveLength(2)
    expect(plan.companyLinks).toEqual([
      {
        legacyServicePartnerCompanyId: "spc_1",
        companyId: "customer_1",
        displayName: "Service AB",
      },
      {
        legacyServicePartnerCompanyId: "spc_2",
        companyId: "customer_2",
        displayName: "Service AB",
      },
    ])
    expect(plan.membershipLinks).toEqual([
      {
        legacyMembershipId: "membership_1",
        legacyServicePartnerCompanyId: "spc_1",
        userId: "user_1",
        role: "ADMIN",
        isActive: true,
      },
    ])
  })
})
