import { describe, expect, it } from "vitest"
import {
  buildServicepartnerLifecycle,
  type ServicepartnerLifecycleInput,
} from "@/lib/servicepartner-lifecycle"

describe("servicepartner lifecycle", () => {
  it("marks a servicepartner as added when it has no invite or account", () => {
    expect(buildLifecycle().status).toBe("ADDED")
  })

  it("marks a servicepartner as invited with an active invite", () => {
    expect(
      buildLifecycle({
        pendingInvitesCount: 1,
      }).status
    ).toBe("INVITED")
  })

  it("marks a servicepartner invite as expired", () => {
    expect(
      buildLifecycle({
        expiredInvitesCount: 1,
      }).status
    ).toBe("INVITE_EXPIRED")
  })

  it("marks connected accounts without a service admin as account connected", () => {
    expect(
      buildLifecycle({
        activeContractorMembershipsCount: 1,
        activeServiceOrganizationMembershipsCount: 1,
      }).status
    ).toBe("ACCOUNT_CONNECTED")
  })

  it("marks connected servicepartners with missing certificate as needing completion", () => {
    const lifecycle = buildLifecycle({
      activeContractorMembershipsCount: 1,
      activeServiceOrganizationAdminMembershipsCount: 1,
      activeServiceOrganizationMembershipsCount: 1,
    })

    expect(lifecycle.status).toBe("NEEDS_COMPLETION")
    expect(
      lifecycle.checklist.find((item) => item.key === "company-certificate")
    ).toMatchObject({
      completed: false,
      severity: "danger",
    })
  })

  it("marks a valid certificate and admin account as ready", () => {
    expect(
      buildLifecycle({
        activeContractorMembershipsCount: 1,
        activeServiceOrganizationAdminMembershipsCount: 1,
        activeServiceOrganizationMembershipsCount: 1,
        certification: validCertification(),
      }).status
    ).toBe("READY")
  })

  it("marks ready servicepartners with assigned aggregat as active", () => {
    expect(
      buildLifecycle({
        activeContractorMembershipsCount: 1,
        activeServiceOrganizationAdminMembershipsCount: 1,
        activeServiceOrganizationMembershipsCount: 1,
        assignedInstallationsCount: 4,
        certification: validCertification(),
      }).status
    ).toBe("ACTIVE")
  })

  it("marks assigned aggregat without connected account as needing action", () => {
    expect(
      buildLifecycle({
        assignedInstallationsCount: 2,
        pendingInvitesCount: 1,
      }).status
    ).toBe("NEEDS_ACTION")
  })

  it("adds latest activity to the checklist when activity exists", () => {
    const lifecycle = buildLifecycle({
      activeContractorMembershipsCount: 1,
      activeServiceOrganizationAdminMembershipsCount: 1,
      activeServiceOrganizationMembershipsCount: 1,
      certification: validCertification(),
      latestActivityDate: new Date("2026-04-15T10:00:00.000Z"),
    })

    expect(lifecycle.checklist).toContainEqual(
      expect.objectContaining({
        completed: true,
        key: "latest-activity",
        label: "Senaste aktivitet",
      })
    )
  })
})

function buildLifecycle(overrides: Partial<ServicepartnerLifecycleInput> = {}) {
  return buildServicepartnerLifecycle({
    servicepartner: {
      contactEmail: "service@example.com",
      name: "Service AB",
      organizationNumber: "556677-8899",
    },
    ...overrides,
  })
}

function validCertification(): ServicepartnerLifecycleInput["certification"] {
  return {
    certificateNumber: "CERT-123",
    issuer: "Incert",
    source: "CERTIFICATION_RECORD",
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    status: {
      label: "Giltigt",
      status: "VALID",
      variant: "success",
    },
  }
}
