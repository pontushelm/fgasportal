import { describe, expect, it } from "vitest"
import {
  buildAnnualFgasReportQualitySummary,
  buildAnnualFgasReportWarnings,
  buildRefrigerantHandlingRow,
} from "@/lib/reports/annualFgasReportValidation"
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

describe("annual F-gas refrigerant handling", () => {
  it("treats recovery event amount as recovered refrigerant", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R404A",
      event: {
        id: "event-recovery",
        date: new Date("2026-02-01"),
        type: "RECOVERY",
        refrigerantAddedKg: 4.5,
        notes: null,
      },
    })

    expect(row.addedKg).toBeNull()
    expect(row.recoveredKg).toBe(4.5)
  })

  it("shows refrigerant change amounts and refrigerant transition when notes contain existing structured text", () => {
    const row = buildRefrigerantHandlingRow({
      equipmentId: "VP1",
      equipmentName: "Kyl A",
      fallbackRefrigerantType: "R449A",
      event: {
        id: "event-change",
        date: new Date("2026-02-01"),
        type: "REFRIGERANT_CHANGE",
        refrigerantAddedKg: 10,
        notes:
          "Byte av köldmedium från R404A till R449A. Omhändertagen mängd: 9,5 kg.",
      },
    })

    expect(row.addedKg).toBe(10)
    expect(row.recoveredKg).toBe(9.5)
    expect(row.previousRefrigerantType).toBe("R404A")
    expect(row.newRefrigerantType).toBe("R449A")
  })
})

describe("annual F-gas report warnings", () => {
  it("warns for incomplete report data without changing unknown CO2e totals", () => {
    const warnings = buildAnnualFgasReportWarnings({
      certificateRegister: [],
      co2eSummary: { unknownCo2eEquipmentCount: 1 },
      equipment: [
        {
          id: "installation-a",
          equipmentId: "VP1",
          name: "Kyl A",
          location: null,
          propertyName: null,
          equipmentType: null,
          refrigerantType: "Okänt",
          refrigerantAmountKg: 10,
          co2eKg: null,
          controlRequired: false,
          inspectionIntervalMonths: null,
          leakDetectionSystem: false,
          installedAt: null,
          lastInspectionAt: null,
          nextInspectionAt: null,
          status: "active",
        },
      ],
      refrigerantHandlingLog: [],
      reportInstallations: [
        {
          id: "installation-a",
          name: "Kyl A",
          equipmentId: "VP1",
          assignedContractorId: null,
          assignedContractor: null,
          events: [
            {
              id: "event-leak",
              type: "LEAK",
              refrigerantAddedKg: null,
              notes: "Läckage",
            },
            {
              id: "event-recovery",
              type: "RECOVERY",
              refrigerantAddedKg: null,
              notes: null,
            },
          ],
        },
      ],
      scrappedEquipment: [
        {
          id: "scrap-a",
          scrappedAt: new Date("2026-03-01"),
          equipmentName: "Kyl A",
          equipmentId: "VP1",
          refrigerantType: "R404A",
          refrigerantAmountKg: 10,
          recoveredKg: null,
          servicePartnerName: null,
          certificateFileName: null,
          notes: null,
        },
      ],
    })

    expect(warnings.map((warning) => warning.id)).toContain("unknown-co2e")
    expect(warnings.map((warning) => warning.id)).toContain("leak-missing-amount-event-leak")
    expect(warnings.map((warning) => warning.id)).toContain("recovery-missing-amount-event-recovery")
    expect(warnings.map((warning) => warning.id)).toContain("scrap-missing-certificate-scrap-a")
    expect(warnings.find((warning) => warning.id === "unknown-co2e")?.severity).toBe("blocking")
    expect(warnings.find((warning) => warning.id === "leak-missing-amount-event-leak")?.severity).toBe("review")
  })

  it("calculates readiness status from blocking and review warnings", () => {
    expect(buildAnnualFgasReportQualitySummary([])).toEqual({
      status: "READY",
      blockingIssueCount: 0,
      warningCount: 0,
      totalIssueCount: 0,
    })

    expect(
      buildAnnualFgasReportQualitySummary([
        {
          id: "missing-certificate",
          severity: "review",
          message: "Tilldelad servicekontakt saknar registrerat certifikatnummer.",
        },
      ])
    ).toMatchObject({
      status: "HAS_WARNINGS",
      blockingIssueCount: 0,
      warningCount: 1,
    })

    expect(
      buildAnnualFgasReportQualitySummary([
        {
          id: "unknown-co2e",
          severity: "blocking",
          message: "Aggregat saknar känt GWP/CO₂e-värde.",
        },
      ])
    ).toMatchObject({
      status: "MISSING_REQUIRED_DATA",
      blockingIssueCount: 1,
      warningCount: 0,
    })
  })

  it("flags missing property designation as a review warning", () => {
    const warnings = buildAnnualFgasReportWarnings({
      certificateRegister: [
        {
          name: "Tekniker",
          role: "Ansvarig tekniker/servicepartner",
          company: "Kyl AB",
          certificateNumber: "CERT-1",
          certificateOrganization: null,
          validUntil: null,
        },
      ],
      co2eSummary: { unknownCo2eEquipmentCount: 0 },
      equipment: [
        {
          id: "installation-a",
          equipmentId: "VP1",
          name: "Kyl A",
          location: null,
          propertyName: "Skolan 1",
          equipmentType: null,
          refrigerantType: "R404A",
          refrigerantAmountKg: 10,
          co2eKg: 39220,
          controlRequired: false,
          inspectionIntervalMonths: null,
          leakDetectionSystem: false,
          installedAt: null,
          lastInspectionAt: null,
          nextInspectionAt: null,
          status: "active",
        },
      ],
      refrigerantHandlingLog: [],
      reportInstallations: [
        {
          id: "installation-a",
          name: "Kyl A",
          equipmentId: "VP1",
          assignedContractorId: "contractor-a",
          assignedContractor: {
            memberships: [{ certificationNumber: "CERT-1" }],
          },
          property: {
            municipality: "Malmö",
            propertyDesignation: null,
          },
          events: [],
        },
      ],
      scrappedEquipment: [],
    })

    expect(warnings).toEqual([
      expect.objectContaining({
        id: "missing-property-designation-installation-a",
        severity: "review",
      }),
    ])
  })
})
