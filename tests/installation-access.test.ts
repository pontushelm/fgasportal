import { describe, expect, it } from "vitest"
import type { AuthenticatedUser } from "@/lib/auth"
import {
  canAccessInstallation,
  canManageServicepartnerTechnicianAssignments,
  getInstallationAccessWhereClause,
} from "@/lib/access/installation-access"
import { canAccessInstallationDocuments } from "@/lib/document-access"

const technician: AuthenticatedUser = {
  userId: "tech-1",
  membershipId: "membership-tech-1",
  companyId: "customer-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: false,
}

const servicePartnerAdmin: AuthenticatedUser = {
  userId: "admin-1",
  membershipId: "membership-admin-1",
  companyId: "customer-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "servicepartner-1",
  isServicePartnerAdmin: true,
}

describe("installation access", () => {
  it("allows a normal contractor to access directly assigned aggregat", () => {
    expect(
      canAccessInstallation(technician, {
        companyId: "customer-1",
        assignedContractorId: "tech-1",
        assignedServicePartnerCompanyId: "servicepartner-2",
      })
    ).toBe(true)
  })

  it("does not allow a normal contractor to access company-assigned aggregat unless directly assigned", () => {
    expect(
      canAccessInstallation(technician, {
        companyId: "customer-1",
        assignedContractorId: null,
        assignedServicePartnerCompanyId: "servicepartner-1",
      })
    ).toBe(false)
  })

  it("allows a servicepartner admin to access aggregat assigned to their servicepartner company", () => {
    expect(
      canAccessInstallation(servicePartnerAdmin, {
        companyId: "customer-1",
        assignedContractorId: null,
        assignedServicePartnerCompanyId: "servicepartner-1",
      })
    ).toBe(true)
  })

  it("does not allow a servicepartner admin to access another servicepartner company", () => {
    expect(
      canAccessInstallation(servicePartnerAdmin, {
        companyId: "customer-1",
        assignedContractorId: null,
        assignedServicePartnerCompanyId: "servicepartner-2",
      })
    ).toBe(false)
  })

  it("does not allow a servicepartner admin to access another customer tenant", () => {
    expect(
      canAccessInstallation(servicePartnerAdmin, {
        companyId: "customer-2",
        assignedContractorId: "admin-1",
        assignedServicePartnerCompanyId: "servicepartner-1",
      })
    ).toBe(false)
  })

  it("builds a tenant-scoped servicepartner admin where clause for route queries", () => {
    expect(getInstallationAccessWhereClause(servicePartnerAdmin)).toEqual({
      AND: [
        {
          companyId: "customer-1",
        },
        {
          OR: [
            {
              assignedContractorId: "admin-1",
            },
            {
              assignedServicePartnerCompanyId: "servicepartner-1",
            },
          ],
        },
      ],
    })
  })

  it("uses the same delegated access rule for document access", () => {
    expect(
      canAccessInstallationDocuments(servicePartnerAdmin, {
        companyId: "customer-1",
        assignedContractorId: null,
        assignedServicePartnerCompanyId: "servicepartner-1",
      })
    ).toBe(true)
  })

  it("limits technician assignment management to admins for their own servicepartner company", () => {
    expect(
      canManageServicepartnerTechnicianAssignments(
        servicePartnerAdmin,
        "servicepartner-1"
      )
    ).toBe(true)
    expect(
      canManageServicepartnerTechnicianAssignments(technician, "servicepartner-1")
    ).toBe(false)
    expect(
      canManageServicepartnerTechnicianAssignments(
        servicePartnerAdmin,
        "servicepartner-2"
      )
    ).toBe(false)
  })
})
