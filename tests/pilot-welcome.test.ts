import { describe, expect, it } from "vitest"
import {
  getFirstDashboardOnboardingOverlay,
  getPilotWelcomeStorageKey,
} from "@/lib/dashboard/pilot-welcome"

describe("pilot welcome", () => {
  it("shows on the first authenticated visit", () => {
    expect(
      getFirstDashboardOnboardingOverlay({
        demoIntroStoredValue: null,
        isDemoTenant: false,
        pilotWelcomeStoredValue: null,
      })
    ).toBe("pilotWelcome")
  })

  it("stays dismissed for the same user and company", () => {
    expect(getPilotWelcomeStorageKey("company-1", "user-1")).toBe(
      "helmpolar_pilot_welcome_seen:company-1:user-1"
    )
    expect(
      getFirstDashboardOnboardingOverlay({
        demoIntroStoredValue: null,
        isDemoTenant: false,
        pilotWelcomeStoredValue: "1",
      })
    ).toBeNull()
  })

  it("shows the demo introduction after the pilot welcome is dismissed", () => {
    expect(
      getFirstDashboardOnboardingOverlay({
        demoIntroStoredValue: null,
        isDemoTenant: true,
        pilotWelcomeStoredValue: null,
      })
    ).toBe("pilotWelcome")
    expect(
      getFirstDashboardOnboardingOverlay({
        demoIntroStoredValue: null,
        isDemoTenant: true,
        pilotWelcomeStoredValue: "1",
      })
    ).toBe("demoIntroduction")
    expect(
      getFirstDashboardOnboardingOverlay({
        demoIntroStoredValue: "1",
        isDemoTenant: true,
        pilotWelcomeStoredValue: "1",
      })
    ).toBeNull()
  })
})
