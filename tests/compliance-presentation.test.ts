import { describe, expect, it } from "vitest"
import { createComplianceExplanation } from "@/lib/compliance/compliancePresentation"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"

describe("compliance presentation", () => {
  it("explains Annex I control obligation with threshold and interval", () => {
    const compliance = calculateInstallationCompliance("R410A", 2.4, false)
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 2.4,
    })

    expect(explanation.statusLabel).toBe("Kontrollpliktig")
    expect(explanation.reason).toContain("5,01 ton CO₂e")
    expect(explanation.intervalLabel).toBe("Kontrollintervall: 12 månader")
    expect(explanation.thresholdLabel).toBe("5 ton CO₂e")
  })

  it("explains hermetic exemption", () => {
    const compliance = calculateInstallationCompliance(
      "R410A",
      4.7,
      false,
      null,
      null,
      true
    )
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 4.7,
      isHermeticallySealed: true,
    })

    expect(explanation.statusLabel).toBe("Ej kontrollpliktig")
    expect(explanation.reason).toContain("hermetiskt slutet")
    expect(explanation.intervalLabel).toBe("Inget kontrollintervall")
    expect(explanation.thresholdLabel).toBe("10 ton CO₂e")
  })

  it("explains hermetic equipment that is still inspection-required", () => {
    const compliance = calculateInstallationCompliance(
      "R410A",
      4.8,
      false,
      null,
      null,
      true
    )
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 4.8,
      isHermeticallySealed: true,
    })

    expect(explanation.statusLabel).toBe("Kontrollpliktig")
    expect(explanation.reason).toContain("omfattas ändå")
    expect(explanation.thresholdLabel).toBe("10 ton CO₂e")
  })

  it("explains Annex II kilogram-based checks", () => {
    const compliance = calculateInstallationCompliance("R1234yf", 1, false)
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 1,
    })

    expect(explanation.reason).toContain("kilogram")
    expect(explanation.reason).toContain("1 kg")
    expect(explanation.thresholdLabel).toBe("1 kg")
  })

  it("explains unknown legal classification without exposing enums", () => {
    const compliance = calculateInstallationCompliance("R22", 10, false)
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 10,
    })
    const serialized = JSON.stringify(explanation)

    expect(explanation.statusLabel).toBe("Behöver granskas")
    expect(explanation.reason).toContain("regelklassificering saknas")
    expect(serialized).not.toContain("UNKNOWN_CLASSIFICATION")
    expect(serialized).not.toContain("ANNEX_")
  })

  it("explains missing refrigerant or charge data", () => {
    const explanation = createComplianceExplanation({
      inspectionObligation: {
        intervalMonths: null,
        isInspectionRequired: false,
        reasonCode: "ANNEX_I_BELOW_THRESHOLD",
        thresholdBasis: "CO2E_TONNES",
        thresholdValue: null,
      },
      co2eTon: null,
      refrigerantAmountKg: null,
    })

    expect(explanation.statusLabel).toBe("Kan inte bedömas")
    expect(explanation.reason).toContain("Fyll i köldmedium")
    expect(explanation.intervalLabel).toBe("Inget kontrollintervall")
    expect(explanation.thresholdLabel).toBeNull()
  })

  it("formats adjusted intervals without exposing raw rule identifiers", () => {
    const compliance = calculateInstallationCompliance("R404A", 13, true)
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 13,
    })

    expect(explanation.intervalLabel).toBe("Kontrollintervall: 12 månader")
    expect(explanation.details.join(" ")).toContain("läckagevarningssystem")
    expect(JSON.stringify(explanation)).not.toContain("CO2E_TONNES")
  })

  it("explains overdue inspections from the latest inspection date", () => {
    const compliance = calculateInstallationCompliance(
      "R410A",
      2.4,
      false,
      "2025-02-12",
      "2026-02-12"
    )
    const explanation = createComplianceExplanation({
      ...compliance,
      refrigerantAmountKg: 2.4,
      lastInspection: "2025-02-12",
    })

    expect(explanation.statusLabel).toBe("Försenad kontroll")
    expect(explanation.reason).toContain("12 februari 2025")
    expect(explanation.reason).toContain("12 månader")
  })
})
