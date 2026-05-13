import { describe, expect, it } from "vitest"
import {
  getReportTypeMetadata,
  isReportExportAvailable,
  REPORT_TYPE_OPTIONS,
} from "@/lib/reports/reportTypeMetadata"

describe("report type metadata", () => {
  it("marks annual F-gas report as the fully supported exportable report", () => {
    const annualReport = getReportTypeMetadata("annual")

    expect(annualReport.supportLabel).toBe("Fullt stöd")
    expect(annualReport.supportStatus).toBe("FULL")
    expect(isReportExportAvailable("annual")).toBe(true)
  })

  it("keeps future report types visible but not exportable", () => {
    const futureReports = REPORT_TYPE_OPTIONS.filter(
      (report) => report.value !== "annual"
    )

    expect(futureReports.length).toBeGreaterThan(0)
    expect(
      futureReports.every((report) => report.exportAvailable === false)
    ).toBe(true)
    expect(
      futureReports.every((report) => report.placeholderDescription)
    ).toBe(true)
  })

  it("classifies planned and preview report types without using runtime data", () => {
    expect(getReportTypeMetadata("risk").supportStatus).toBe("PLANNED")
    expect(getReportTypeMetadata("climate").supportStatus).toBe("PREVIEW")
    expect(getReportTypeMetadata("compliance").supportStatus).toBe("PREVIEW")
    expect(getReportTypeMetadata("refrigerants").supportStatus).toBe("PREVIEW")
  })
})
