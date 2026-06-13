import { describe, expect, it } from "vitest"
import { shouldShowDemoTenantGenerator } from "@/components/dashboard/company-page-client"

describe("demo tenant generator visibility", () => {
  it("is hidden unless explicitly enabled", () => {
    expect(
      shouldShowDemoTenantGenerator({
        enabled: false,
        role: "OWNER",
      })
    ).toBe(false)
  })

  it("is owner-only when enabled", () => {
    expect(
      shouldShowDemoTenantGenerator({
        enabled: true,
        role: "OWNER",
      })
    ).toBe(true)
    expect(
      shouldShowDemoTenantGenerator({
        enabled: true,
        role: "ADMIN",
      })
    ).toBe(false)
  })
})
