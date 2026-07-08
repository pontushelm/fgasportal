import { describe, expect, it } from "vitest"
import {
  MUNICIPALITY_PRE_COMMISSIONING_WARNING,
  getManualInstallationCo2eWarning,
} from "@/lib/installations/manual-installation-warnings"

describe("manual installation warnings", () => {
  it("shows a municipality pre-commissioning warning above 14 tonnes CO2e", () => {
    const warning = getManualInstallationCo2eWarning("R410A", "7")

    expect(warning).toMatchObject({
      message: MUNICIPALITY_PRE_COMMISSIONING_WARNING,
    })
    expect(warning?.co2eTon).toBeGreaterThan(14)
  })

  it("does not warn at or below 14 tonnes CO2e", () => {
    expect(getManualInstallationCo2eWarning("R410A", "6")).toBeNull()
  })

  it("does not warn when CO2e cannot be calculated", () => {
    expect(getManualInstallationCo2eWarning("", "7")).toBeNull()
    expect(getManualInstallationCo2eWarning("UNKNOWN", "7")).toBeNull()
    expect(getManualInstallationCo2eWarning("R410A", "")).toBeNull()
  })
})
