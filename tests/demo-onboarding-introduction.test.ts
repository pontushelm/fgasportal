import { describe, expect, it } from "vitest"
import {
  getDemoIntroStorageKey,
  shouldShowDemoIntroduction,
} from "@/lib/dashboard/demo-introduction"

describe("demo onboarding introduction", () => {
  it("shows for a demo tenant before dismissal", () => {
    expect(
      shouldShowDemoIntroduction({
        isDemoTenant: true,
        storedValue: null,
      })
    ).toBe(true)
  })

  it("stays hidden after dismissal for the same company", () => {
    expect(getDemoIntroStorageKey("company-1")).toBe(
      "helmpolar_demo_intro_seen:company-1"
    )
    expect(
      shouldShowDemoIntroduction({
        isDemoTenant: true,
        storedValue: "1",
      })
    ).toBe(false)
  })

  it("does not show for a non-demo tenant", () => {
    expect(
      shouldShowDemoIntroduction({
        isDemoTenant: false,
        storedValue: null,
      })
    ).toBe(false)
  })
})
