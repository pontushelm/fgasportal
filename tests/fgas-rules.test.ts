import { describe, expect, it } from "vitest"
import {
  UNKNOWN_LEGAL_CLASSIFICATION_MESSAGE,
  calculateFgasLeakCheckObligation,
} from "@/lib/fgas-rules"

describe("F-gas legal rules", () => {
  it("uses Annex I CO2e thresholds and tiers", () => {
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 4.99,
      }).reasonCode
    ).toBe("ANNEX_I_BELOW_THRESHOLD")
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 5,
      }).intervalMonths
    ).toBe(12)
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 50,
      }).intervalMonths
    ).toBe(6)
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 500,
      }).intervalMonths
    ).toBe(3)
  })

  it("uses Annex I hermetic threshold at 10 tonnes CO2e", () => {
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 9.99,
        isHermeticallySealed: true,
      }).reasonCode
    ).toBe("ANNEX_I_HERMETIC_BELOW_THRESHOLD")
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 10,
        isHermeticallySealed: true,
      }).intervalMonths
    ).toBe(12)
  })

  it("uses Annex II Section 1 kg thresholds and tiers", () => {
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 0.99,
      }).reasonCode
    ).toBe("ANNEX_II_BELOW_THRESHOLD")
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 1,
      }).intervalMonths
    ).toBe(12)
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 10,
      }).intervalMonths
    ).toBe(6)
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 100,
      }).intervalMonths
    ).toBe(3)
  })

  it("uses Annex II Section 1 hermetic threshold at 2 kg", () => {
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 1.99,
        isHermeticallySealed: true,
      }).reasonCode
    ).toBe("ANNEX_II_HERMETIC_BELOW_THRESHOLD")
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 2,
        isHermeticallySealed: true,
      }).intervalMonths
    ).toBe(12)
  })

  it("keeps leak detection interval extension", () => {
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_I",
        co2eTonnes: 50,
        hasLeakDetectionSystem: true,
      }).intervalMonths
    ).toBe(12)
    expect(
      calculateFgasLeakCheckObligation({
        legalClassification: "ANNEX_II_SECTION_1",
        refrigerantAmountKg: 10,
        hasLeakDetectionSystem: true,
      }).intervalMonths
    ).toBe(12)
  })

  it("does not infer legal classification from display category", () => {
    const outOfScope = calculateFgasLeakCheckObligation({
      legalClassification: "OUT_OF_SCOPE",
      refrigerantAmountKg: 20,
      co2eTonnes: 200,
    })

    expect(outOfScope.reasonCode).toBe("OUT_OF_SCOPE")
    expect(outOfScope.intervalMonths).toBeNull()
  })

  it("requires review for unknown classification", () => {
    const result = calculateFgasLeakCheckObligation({
      legalClassification: "UNKNOWN",
      refrigerantAmountKg: 20,
      co2eTonnes: 200,
    })

    expect(result.reasonCode).toBe("UNKNOWN_CLASSIFICATION")
    expect(result.isLeakCheckRequired).toBe(false)
    expect(result.intervalMonths).toBeNull()
    expect(result.message).toBe(UNKNOWN_LEGAL_CLASSIFICATION_MESSAGE)
  })
})
