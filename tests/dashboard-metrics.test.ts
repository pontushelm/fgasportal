import { describe, expect, it } from "vitest"
import {
  buildDashboardAnnualReportStatus,
  type DashboardSignedReportRecord,
} from "@/lib/dashboard/annual-report-status"
import { summarizeLeakageClimateImpact } from "@/lib/dashboard/compliance-metrics"

describe("dashboard leakage climate impact", () => {
  it("calculates current-year leakage CO2e without treating unknown GWP as zero", () => {
    const summary = summarizeLeakageClimateImpact([
      { refrigerantType: "R404A", leakageKg: 10 },
      { refrigerantType: "UNKNOWN", leakageKg: 2 },
      { refrigerantType: "R134a", leakageKg: null },
    ])

    expect(summary.totalCo2eTon).toBeCloseTo(39.22)
    expect(summary.isComplete).toBe(false)
    expect(summary.unknownEvents).toBe(2)
  })
})

describe("dashboard annual report status", () => {
  it("requires annual report at exactly 14 tonnes CO2e", () => {
    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records: [],
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: "Uppsala",
          installedCo2eTon: 14,
          co2eIsComplete: true,
        },
      ],
    })

    expect(summary.requiredReports).toBe(1)
    expect(summary.remainingRequiredReports).toBe(1)
    expect(summary.properties[0].requirementStatus).toBe("REQUIRED")
    expect(summary.properties[0].signedStatus).toBe("NOT_SIGNED")
  })

  it("does not require annual report below 14 tonnes CO2e", () => {
    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records: [],
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: "Uppsala",
          installedCo2eTon: 13.99,
          co2eIsComplete: true,
        },
      ],
    })

    expect(summary.requiredReports).toBe(0)
    expect(summary.remainingRequiredReports).toBe(0)
    expect(summary.properties[0].requirementStatus).toBe("NOT_REQUIRED")
    expect(summary.properties[0].signedStatus).toBeNull()
  })

  it("marks properties with incomplete CO2e data as uncertain", () => {
    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records: [],
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: "Uppsala",
          installedCo2eTon: 4,
          co2eIsComplete: false,
        },
      ],
    })

    expect(summary.uncertainProperties).toBe(1)
    expect(summary.properties[0].requirementStatus).toBe("UNCERTAIN")
    expect(summary.properties[0].signedStatus).toBe("NOT_SIGNED")
  })

  it("summarizes signed and remaining required property reports for the current year", () => {
    const records: DashboardSignedReportRecord[] = [
      {
        propertyId: "property-a",
        readinessStatus: "HAS_WARNINGS",
        blockingIssueCount: 0,
        reviewWarningCount: 2,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]

    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records,
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: "Uppsala",
          installedCo2eTon: 16,
          co2eIsComplete: true,
        },
        {
          id: "property-b",
          name: "Vardcentralen",
          municipality: "Uppsala",
          installedCo2eTon: 20,
          co2eIsComplete: true,
        },
      ],
    })

    expect(summary.requiredReports).toBe(2)
    expect(summary.signedRequiredReports).toBe(1)
    expect(summary.remainingRequiredReports).toBe(1)
    expect(summary.requiredReportsWithWarnings).toBe(1)
    expect(summary.properties.map((property) => property.signedStatus)).toEqual([
      "HAS_WARNINGS",
      "NOT_SIGNED",
    ])
  })

  it("does not make a non-required property appear required because it has signed history", () => {
    const records: DashboardSignedReportRecord[] = [
      {
        propertyId: "property-a",
        readinessStatus: "READY",
        blockingIssueCount: 0,
        reviewWarningCount: 0,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]

    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records,
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: null,
          installedCo2eTon: 8,
          co2eIsComplete: true,
        },
      ],
    })

    expect(summary.requiredReports).toBe(0)
    expect(summary.properties[0].requirementStatus).toBe("NOT_REQUIRED")
    expect(summary.properties[0].signedStatus).toBeNull()
  })

  it("treats an all-properties signed report as covering each required property", () => {
    const records: DashboardSignedReportRecord[] = [
      {
        propertyId: null,
        readinessStatus: "READY",
        blockingIssueCount: 0,
        reviewWarningCount: 0,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]

    const summary = buildDashboardAnnualReportStatus({
      year: 2026,
      records,
      properties: [
        {
          id: "property-a",
          name: "Skolan 1",
          municipality: null,
          installedCo2eTon: 14,
          co2eIsComplete: true,
        },
        {
          id: "property-b",
          name: "Vardcentralen",
          municipality: null,
          installedCo2eTon: 30,
          co2eIsComplete: true,
        },
      ],
    })

    expect(summary.signedRequiredReports).toBe(2)
    expect(summary.remainingRequiredReports).toBe(0)
    expect(summary.properties.every((property) => property.signedStatus === "SIGNED")).toBe(true)
  })
})
