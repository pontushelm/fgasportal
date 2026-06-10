import { describe, expect, it } from "vitest"
import { buildDataQualityReport } from "@/lib/dashboard/data-quality"

describe("data quality report", () => {
  it("returns a perfect score and empty state when no issues exist", () => {
    const report = buildDataQualityReport({
      installations: [
        {
          propertyId: "property-1",
          refrigerantAmount: 10,
          refrigerantType: "R410A",
        },
      ],
      properties: [
        {
          municipality: "Malmö",
          propertyDesignation: "Skolan 1:2",
        },
      ],
      servicePartnerCertifications: [
        {
          certificateNumber: "FCERT-1",
          validUntil: "2028-01-01",
        },
      ],
      technicianCertifications: [
        {
          certificateNumber: "PCERT-1",
          validUntil: "2028-01-01",
        },
      ],
    })

    expect(report.score).toBe(100)
    expect(report.totalIssueCount).toBe(0)
    expect(report.issues).toEqual([])
  })

  it("detects property and installation data quality issues", () => {
    const report = buildDataQualityReport({
      installations: [
        {
          propertyId: null,
          refrigerantAmount: 0,
          refrigerantType: "",
        },
        {
          propertyId: "property-1",
          refrigerantAmount: 5,
          refrigerantType: "EGET-MEDIUM",
        },
      ],
      properties: [
        {
          municipality: null,
          propertyDesignation: null,
        },
      ],
    })

    expect(issueCount(report, "PROPERTY_MISSING_DESIGNATION")).toBe(1)
    expect(issueCount(report, "PROPERTY_MISSING_MUNICIPALITY")).toBe(1)
    expect(issueCount(report, "INSTALLATION_MISSING_PROPERTY")).toBe(1)
    expect(issueCount(report, "INSTALLATION_MISSING_REFRIGERANT")).toBe(1)
    expect(issueCount(report, "INSTALLATION_MISSING_CHARGE")).toBe(1)
    expect(issueCount(report, "INSTALLATION_MISSING_GWP")).toBe(1)
  })

  it("detects missing and expired certification issues", () => {
    const report = buildDataQualityReport({
      installations: [],
      properties: [],
      servicePartnerCertifications: [
        { certificateNumber: null, validUntil: null },
        { certificateNumber: "FCERT-OLD", validUntil: "2020-01-01" },
      ],
      technicianCertifications: [
        { certificateNumber: null, validUntil: null },
        { certificateNumber: "PCERT-OLD", validUntil: "2020-01-01" },
      ],
    })

    expect(issueCount(report, "SERVICEPARTNER_CERTIFICATE_MISSING")).toBe(1)
    expect(issueCount(report, "SERVICEPARTNER_CERTIFICATE_EXPIRED")).toBe(1)
    expect(issueCount(report, "TECHNICIAN_CERTIFICATE_MISSING")).toBe(1)
    expect(issueCount(report, "TECHNICIAN_CERTIFICATE_EXPIRED")).toBe(1)
  })

  it("calculates score from issue categories and exposes top issues", () => {
    const report = buildDataQualityReport({
      installations: [
        {
          propertyId: null,
          refrigerantAmount: 0,
          refrigerantType: "",
        },
      ],
      properties: [
        {
          municipality: "Malmö",
          propertyDesignation: null,
        },
      ],
    })

    expect(report.issueCategoryCount).toBe(4)
    expect(report.totalIssueCount).toBe(4)
    expect(report.score).toBe(40)
    expect(report.topIssues).toHaveLength(3)
    expect(report.topIssues[0].severity).toBe("HIGH")
  })
})

function issueCount(
  report: ReturnType<typeof buildDataQualityReport>,
  id: string
) {
  return report.issues.find((issue) => issue.id === id)?.count ?? 0
}
