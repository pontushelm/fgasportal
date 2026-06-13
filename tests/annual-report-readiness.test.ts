import { describe, expect, it } from "vitest"
import {
  buildAnnualReportReadinessSummary,
  type AnnualReportReadinessItem,
} from "@/lib/reports/annualReportReadiness"

describe("annual report readiness panel data", () => {
  it("shows empty tenant copy and import CTAs", () => {
    const summary = buildAnnualReportReadinessSummary({
      dataQualityIssues: [],
      overview: { properties: [] },
      properties: [],
    })

    expect(summary.status).toBe("empty")
    expect(item(summary, "properties")).toMatchObject({
      ctaHref: "/dashboard/properties/import",
      ctaLabel: "Importera fastigheter",
      status: "needs_action",
    })
    expect(item(summary, "linkedInstallations")).toMatchObject({
      ctaHref: "/dashboard/installations/import",
      ctaLabel: "Importera aggregat",
      status: "needs_action",
    })
  })

  it("links missing property designation to the filtered Data Quality view", () => {
    const summary = buildAnnualReportReadinessSummary({
      dataQualityIssues: [
        {
          count: 2,
          ctaLabel: "Visa fastigheter",
          description: "Saknas",
          group: "properties",
          id: "PROPERTY_MISSING_DESIGNATION",
          route: "/dashboard/properties?quality=missing-designation",
          severity: "HIGH",
          title: "Fastigheter saknar fastighetsbeteckning",
        },
      ],
      overview: { properties: [{ id: "property-1" }] },
      properties: [
        { id: "property-1", propertyDesignation: "" },
        { id: "property-2", propertyDesignation: null },
      ],
    })

    expect(summary.status).toBe("needs_data")
    expect(item(summary, "propertyDesignation")).toMatchObject({
      ctaHref: "/dashboard/properties?quality=missing-designation",
      issueCount: 2,
      status: "needs_action",
    })
  })

  it("links missing installation data to filtered Data Quality views", () => {
    const summary = buildAnnualReportReadinessSummary({
      dataQualityIssues: [
        issue("INSTALLATION_MISSING_REFRIGERANT", 3),
        issue("INSTALLATION_MISSING_CHARGE", 4),
        issue("INSTALLATION_MISSING_GWP", 1),
        issue("INSTALLATION_MISSING_PROPERTY", 2),
      ],
      overview: { properties: [{ id: "property-1" }] },
      properties: [{ id: "property-1", propertyDesignation: "Skolan 1:2" }],
    })

    expect(item(summary, "linkedInstallations")).toMatchObject({
      ctaHref: "/dashboard/installations?quality=missing-property",
      issueCount: 2,
      status: "needs_action",
    })
    expect(item(summary, "refrigerant")).toMatchObject({
      ctaHref: "/dashboard/installations?quality=missing-refrigerant",
      issueCount: 3,
      status: "needs_action",
    })
    expect(item(summary, "charge")).toMatchObject({
      ctaHref: "/dashboard/installations?quality=missing-charge",
      issueCount: 4,
      status: "needs_action",
    })
    expect(item(summary, "gwp")).toMatchObject({
      ctaHref: "/dashboard/installations?quality=missing-gwp",
      issueCount: 1,
      status: "needs_action",
    })
  })

  it("marks required prerequisites ready when the report base data is complete", () => {
    const summary = buildAnnualReportReadinessSummary({
      dataQualityIssues: [],
      overview: { properties: [{ id: "property-1" }] },
      properties: [{ id: "property-1", propertyDesignation: "Skolan 1:2" }],
    })

    expect(summary.status).toBe("ready")
    expect(summary.completedRequiredCount).toBe(summary.requiredCount)
    expect(summary.issueCount).toBe(0)
    summary.items
      .filter((readinessItem) => readinessItem.requirement === "required")
      .forEach((readinessItem) => {
        expect(readinessItem.status).toBe("complete")
      })
  })
})

function item(
  summary: ReturnType<typeof buildAnnualReportReadinessSummary>,
  key: AnnualReportReadinessItem["key"]
) {
  const readinessItem = summary.items.find((candidate) => candidate.key === key)
  expect(readinessItem).toBeDefined()
  return readinessItem
}

function issue(
  id:
    | "INSTALLATION_MISSING_REFRIGERANT"
    | "INSTALLATION_MISSING_CHARGE"
    | "INSTALLATION_MISSING_GWP"
    | "INSTALLATION_MISSING_PROPERTY",
  count: number
) {
  return {
    count,
    ctaLabel: "Visa aggregat",
    description: "Saknas",
    group: "installations" as const,
    id,
    route: "/dashboard/installations",
    severity: "HIGH" as const,
    title: "Aggregat behöver kompletteras",
  }
}
