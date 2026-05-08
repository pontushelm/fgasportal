import { describe, expect, it } from "vitest"
import { summarizeAnnualFgasCo2e } from "@/lib/reports/annualFgasReportSummary"

describe("annual F-gas report summary", () => {
  it("returns a full CO2e total when all rows have known GWP values", () => {
    const summary = summarizeAnnualFgasCo2e([
      { co2eKg: 39220 },
      { co2eKg: 20880 },
    ])

    expect(summary.totalCo2eKg).toBe(60100)
    expect(summary.knownCo2eKg).toBe(60100)
    expect(summary.hasUnknownCo2e).toBe(false)
    expect(summary.unknownCo2eEquipmentCount).toBe(0)
  })

  it("does not present unknown CO2e rows as zero in the total", () => {
    const summary = summarizeAnnualFgasCo2e([
      { co2eKg: 39220 },
      { co2eKg: null },
    ])

    expect(summary.totalCo2eKg).toBeNull()
    expect(summary.knownCo2eKg).toBe(39220)
    expect(summary.hasUnknownCo2e).toBe(true)
    expect(summary.unknownCo2eEquipmentCount).toBe(1)
  })
})
