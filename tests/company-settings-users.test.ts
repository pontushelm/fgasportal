import { describe, expect, it } from "vitest"
import {
  COMPANY_SETTINGS_ASSIGNABLE_ROLES,
  COMPANY_SETTINGS_USER_ROLES,
  isCompanySettingsUserRole,
} from "@/lib/company-settings-users"

describe("company settings user roles", () => {
  it("keeps service contacts out of the regular company settings users list", () => {
    expect(COMPANY_SETTINGS_USER_ROLES).toEqual(["OWNER", "ADMIN", "MEMBER"])
    expect(isCompanySettingsUserRole("OWNER")).toBe(true)
    expect(isCompanySettingsUserRole("ADMIN")).toBe(true)
    expect(isCompanySettingsUserRole("MEMBER")).toBe(true)
    expect(isCompanySettingsUserRole("CONTRACTOR")).toBe(false)
  })

  it("does not allow assigning service contact role from company settings", () => {
    expect(COMPANY_SETTINGS_ASSIGNABLE_ROLES).toEqual(["ADMIN", "MEMBER"])
    expect(COMPANY_SETTINGS_ASSIGNABLE_ROLES).not.toContain("CONTRACTOR")
  })
})
