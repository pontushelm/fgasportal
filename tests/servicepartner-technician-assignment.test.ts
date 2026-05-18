import { describe, expect, it } from "vitest"
import type { AuthenticatedUser } from "@/lib/auth"
import { canAssignServicepartnerTechnician } from "@/lib/servicepartner-technician-assignment"

const admin: AuthenticatedUser = {
  userId: "admin-1",
  companyId: "customer-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: true,
}

const technician: AuthenticatedUser = {
  userId: "tech-1",
  companyId: "customer-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: false,
}

const installation = {
  companyId: "customer-1",
  assignedContractorId: null,
  assignedServicePartnerCompanyId: "servicepartner-1",
}

describe("servicepartner technician assignment", () => {
  it("allows a servicepartner admin to assign a technician in the same servicepartner company", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: admin,
        installation,
        technicianMembership: {
          companyId: "customer-1",
          role: "CONTRACTOR",
          isActive: true,
          servicePartnerCompanyId: "servicepartner-1",
          user: {
            isActive: true,
          },
        },
      })
    ).toBe(true)
  })

  it("does not allow assigning aggregat from another servicepartner company", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: admin,
        installation: {
          ...installation,
          assignedServicePartnerCompanyId: "servicepartner-2",
        },
        technicianMembership: {
          companyId: "customer-1",
          role: "CONTRACTOR",
          isActive: true,
          servicePartnerCompanyId: "servicepartner-1",
          user: {
            isActive: true,
          },
        },
      })
    ).toBe(false)
  })

  it("does not allow assigning a technician from another servicepartner company", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: admin,
        installation,
        technicianMembership: {
          companyId: "customer-1",
          role: "CONTRACTOR",
          isActive: true,
          servicePartnerCompanyId: "servicepartner-2",
          user: {
            isActive: true,
          },
        },
      })
    ).toBe(false)
  })

  it("does not allow normal contractors to assign technicians", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: technician,
        installation,
        technicianMembership: {
          companyId: "customer-1",
          role: "CONTRACTOR",
          isActive: true,
          servicePartnerCompanyId: "servicepartner-1",
          user: {
            isActive: true,
          },
        },
      })
    ).toBe(false)
  })

  it("allows servicepartner admins to clear technician assignment for their own company", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: admin,
        installation,
        technicianMembership: null,
      })
    ).toBe(true)
  })

  it("does not allow cross-tenant assignment", () => {
    expect(
      canAssignServicepartnerTechnician({
        user: admin,
        installation: {
          ...installation,
          companyId: "customer-2",
        },
        technicianMembership: {
          companyId: "customer-1",
          role: "CONTRACTOR",
          isActive: true,
          servicePartnerCompanyId: "servicepartner-1",
          user: {
            isActive: true,
          },
        },
      })
    ).toBe(false)
  })
})
