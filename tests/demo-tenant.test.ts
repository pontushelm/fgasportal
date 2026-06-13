import { describe, expect, it } from "vitest"
import {
  assertDemoTenantCanBeGenerated,
  createDemoTenantPlan,
  getDemoTenantTargets,
} from "@/lib/demo/demo-tenant"

describe("demo tenant generator", () => {
  it("builds a representative demo tenant plan", () => {
    const plan = createDemoTenantPlan({
      companyId: "company-demo",
      demoPasswordHash: "hashed-password",
      ownerUserId: "owner-1",
      today: new Date("2026-06-13T10:00:00.000Z"),
    })

    expect(plan.properties).toHaveLength(24)
    expect(plan.installations).toHaveLength(240)
    expect(plan.servicePartnerCompanies).toHaveLength(4)
    expect(plan.users.length).toBeGreaterThanOrEqual(6)
    expect(plan.events.length).toBeGreaterThan(250)
    expect(plan.summary.intentionalIssues).toMatchObject({
      expiringCertificates: 2,
      missingMunicipalityProperties: 2,
    })
    expect(plan.summary.intentionalIssues.missingPropertyAssignments).toBeGreaterThan(0)
    expect(plan.summary.intentionalIssues.missingRefrigerantType).toBeGreaterThan(0)
    expect(plan.summary.intentionalIssues.missingRefrigerantCharge).toBeGreaterThan(0)
    expect(plan.summary.intentionalIssues.unknownRefrigerants).toBeGreaterThan(0)
  })

  it("keeps generated targets aligned with the plan", () => {
    const targets = getDemoTenantTargets()

    expect(targets).toEqual({
      installations: 240,
      properties: 24,
      servicePartners: 4,
    })
  })

  it("requires explicit confirmation", () => {
    expect(
      assertDemoTenantCanBeGenerated({
        confirmed: false,
        counts: {
          installations: 0,
          properties: 0,
          servicePartners: 0,
        },
      })
    ).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("Bekräfta"),
    })
  })

  it("blocks generation in non-empty tenants", () => {
    expect(
      assertDemoTenantCanBeGenerated({
        confirmed: true,
        counts: {
          installations: 1,
          properties: 0,
          servicePartners: 0,
        },
      })
    ).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("tom tenant"),
    })
  })
})
