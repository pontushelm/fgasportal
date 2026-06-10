import { describe, expect, it } from "vitest"
import {
  DATA_QUALITY_ISSUE_ROUTES,
  buildDataQualityReport,
} from "@/lib/dashboard/data-quality"
import {
  getInstallationQualityFilter,
  getPropertyQualityFilter,
  getServicePartnerQualityFilter,
  getTechnicianQualityFilter,
  matchesInstallationQualityFilter,
  matchesPropertyQualityFilter,
  matchesServicePartnerQualityFilter,
  matchesTechnicianQualityFilter,
} from "@/lib/dashboard/data-quality-filters"

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

  it("generates filtered routes for issue categories", () => {
    expect(DATA_QUALITY_ISSUE_ROUTES.INSTALLATION_MISSING_REFRIGERANT).toBe(
      "/dashboard/installations?quality=missing-refrigerant"
    )
    expect(DATA_QUALITY_ISSUE_ROUTES.PROPERTY_MISSING_DESIGNATION).toBe(
      "/dashboard/properties?quality=missing-designation"
    )
    expect(DATA_QUALITY_ISSUE_ROUTES.SERVICEPARTNER_CERTIFICATE_EXPIRED).toBe(
      "/dashboard/contractors?quality=expired-company-certificate"
    )
    expect(DATA_QUALITY_ISSUE_ROUTES.TECHNICIAN_CERTIFICATE_MISSING).toBe(
      "/dashboard/contractors?quality=missing-technician-certificate"
    )
  })

  it("matches installation quality filters", () => {
    expect(getInstallationQualityFilter("missing-property")).toBe("missing-property")
    expect(getInstallationQualityFilter("unknown")).toBeNull()
    expect(
      matchesInstallationQualityFilter(
        {
          co2eTon: null,
          propertyId: "property-1",
          refrigerantAmount: 5,
          refrigerantType: "EGET-MEDIUM",
        },
        "missing-gwp"
      )
    ).toBe(true)
    expect(
      matchesInstallationQualityFilter(
        {
          co2eTon: 10.44,
          propertyId: "property-1",
          refrigerantAmount: 5,
          refrigerantType: "R410A",
        },
        "missing-gwp"
      )
    ).toBe(false)
  })

  it("matches property quality filters", () => {
    expect(getPropertyQualityFilter("missing-municipality")).toBe(
      "missing-municipality"
    )
    expect(getPropertyQualityFilter("unknown")).toBeNull()
    expect(
      matchesPropertyQualityFilter(
        { municipality: "", propertyDesignation: "Skolan 1:2" },
        "missing-municipality"
      )
    ).toBe(true)
    expect(
      matchesPropertyQualityFilter(
        { municipality: "Malmö", propertyDesignation: null },
        "missing-designation"
      )
    ).toBe(true)
  })

  it("matches servicepartner and technician quality filters", () => {
    expect(getServicePartnerQualityFilter("expired-company-certificate")).toBe(
      "expired-company-certificate"
    )
    expect(getTechnicianQualityFilter("missing-technician-certificate")).toBe(
      "missing-technician-certificate"
    )
    expect(matchesServicePartnerQualityFilter("EXPIRED", "expired-company-certificate")).toBe(true)
    expect(matchesServicePartnerQualityFilter("VALID", "expired-company-certificate")).toBe(false)
    expect(matchesTechnicianQualityFilter("MISSING", "missing-technician-certificate")).toBe(true)
    expect(matchesTechnicianQualityFilter("VALID", "missing-technician-certificate")).toBe(false)
  })
})

function issueCount(
  report: ReturnType<typeof buildDataQualityReport>,
  id: string
) {
  return report.issues.find((issue) => issue.id === id)?.count ?? 0
}
