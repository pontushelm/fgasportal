import { describe, expect, it } from "vitest"
import {
  canEditServicePartnerCompanySettings,
  canViewServicePartnerCompanySettings,
} from "@/lib/servicepartner-company-settings-access"

describe("servicepartner company settings access", () => {
  it("allows servicepartner technicians to view their company settings read-only", () => {
    const user = {
      role: "CONTRACTOR",
      servicePartnerCompanyId: "spc_1",
      isServicePartnerAdmin: false,
    }

    expect(canViewServicePartnerCompanySettings(user)).toBe(true)
    expect(canEditServicePartnerCompanySettings(user)).toBe(false)
  })

  it("allows servicepartner admins to view and edit their company settings", () => {
    const user = {
      role: "CONTRACTOR",
      servicePartnerCompanyId: "spc_1",
      isServicePartnerAdmin: true,
    }

    expect(canViewServicePartnerCompanySettings(user)).toBe(true)
    expect(canEditServicePartnerCompanySettings(user)).toBe(true)
  })

  it("does not expose servicepartner settings to users without a servicepartner company", () => {
    expect(
      canViewServicePartnerCompanySettings({
        role: "CONTRACTOR",
        servicePartnerCompanyId: null,
        isServicePartnerAdmin: true,
      })
    ).toBe(false)
  })
})
