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
  it("summarizes signed and remaining property reports for the current year", () => {
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
        { id: "property-a", name: "Skolan 1", municipality: "Uppsala" },
        { id: "property-b", name: "Vårdcentralen", municipality: "Uppsala" },
      ],
    })

    expect(summary.expectedReports).toBe(2)
    expect(summary.signedReports).toBe(1)
    expect(summary.remainingReports).toBe(1)
    expect(summary.reportsWithWarnings).toBe(1)
    expect(summary.properties.map((property) => property.status)).toEqual([
      "HAS_WARNINGS",
      "NOT_SIGNED",
    ])
  })

  it("treats an all-properties signed report as covering each relevant property", () => {
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
        { id: "property-a", name: "Skolan 1", municipality: null },
        { id: "property-b", name: "Vårdcentralen", municipality: null },
      ],
    })

    expect(summary.signedReports).toBe(2)
    expect(summary.remainingReports).toBe(0)
    expect(summary.properties.every((property) => property.status === "SIGNED")).toBe(true)
  })
})
