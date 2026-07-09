import { describe, expect, it } from "vitest"
import {
  calculateCO2e,
  calculateInstallationCompliance,
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

  it("uses the ordinary Annex I threshold from 5 tonnes CO2e", () => {
    const compliance = calculateInstallationCompliance("R410A", 2.4, false)

    expect(compliance.co2eTon).toBeCloseTo(5.0112)
    expect(compliance.inspectionIntervalMonths).toBe(12)
    expect(compliance.status).toBe("NOT_INSPECTED")
  })

  it("exempts hermetically sealed Annex I equipment below 10 tonnes CO2e", () => {
    const compliance = calculateInstallationCompliance(
      "R410A",
      4.7,
      false,
      null,
      null,
      true
    )

    expect(compliance.co2eTon).toBeCloseTo(9.8136)
    expect(compliance.inspectionIntervalMonths).toBeNull()
    expect(compliance.status).toBe("NOT_REQUIRED")
    expect(compliance.isHermeticInspectionExempt).toBe(true)
  })

  it("requires leak checks for hermetically sealed Annex I equipment from 10 tonnes CO2e", () => {
    const compliance = calculateInstallationCompliance(
      "R410A",
      4.8,
      false,
      null,
      null,
      true
    )

    expect(compliance.co2eTon).toBeCloseTo(10.0224)
    expect(compliance.inspectionIntervalMonths).toBe(12)
  })

  it("uses Annex II Section 1 kg thresholds for HFO refrigerants", () => {
    expect(
      calculateInstallationCompliance("R1234yf", 1, false).inspectionIntervalMonths
    ).toBe(12)
    expect(
      calculateInstallationCompliance("R1234yf", 1.9, false, null, null, true)
        .inspectionIntervalMonths
    ).toBeNull()
    expect(
      calculateInstallationCompliance("R1234yf", 2, false, null, null, true)
        .inspectionIntervalMonths
    ).toBe(12)
  })
})
