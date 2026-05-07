import { describe, expect, it } from "vitest"
import {
  calculateCO2e,
  calculateInspectionObligation,
} from "@/lib/fgas-calculations"

describe("F-gas calculations", () => {
  it("calculates CO2e for known refrigerants", () => {
    const result = calculateCO2e("R404A", 10)

    expect(result.gwp).toBe(3922)
    expect(result.co2eKg).toBe(39220)
    expect(result.co2eTon).toBe(39.22)
    expect(result.warning).toBeNull()
  })

  it("does not return misleading zero CO2e for unknown refrigerants", () => {
    const result = calculateCO2e("R999X", 10)

    expect(result.gwp).toBeNull()
    expect(result.co2eKg).toBeNull()
    expect(result.co2eTon).toBeNull()
    expect(result.warning).toBe("Okänt GWP-värde")
  })

  it("does not require periodic control below 5 tonnes CO2e", () => {
    const obligation = calculateInspectionObligation(4.99, false)

    expect(obligation.isInspectionRequired).toBe(false)
    expect(obligation.intervalMonths).toBeNull()
  })

  it("requires annual control from 5 tonnes CO2e", () => {
    const obligation = calculateInspectionObligation(5, false)

    expect(obligation.isInspectionRequired).toBe(true)
    expect(obligation.intervalMonths).toBe(12)
  })

  it("uses shorter intervals at higher CO2e thresholds", () => {
    expect(calculateInspectionObligation(50, false).intervalMonths).toBe(6)
    expect(calculateInspectionObligation(500, false).intervalMonths).toBe(3)
  })

  it("extends inspection intervals when leak detection is present", () => {
    expect(calculateInspectionObligation(50, true).intervalMonths).toBe(12)
    expect(calculateInspectionObligation(500, true).intervalMonths).toBe(6)
  })
})
