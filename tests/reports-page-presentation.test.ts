import { describe, expect, it } from "vitest"
import {
  getSelectableAnnualReportObjectCount,
  shouldShowAnnualReportStartState,
} from "@/components/dashboard/reports-page-client"

describe("reports page presentation", () => {
  it("shows the simplified annual report start state until a report object is selected", () => {
    expect(
      shouldShowAnnualReportStartState({
        isAnnualReport: true,
        selectedReportObjectId: "",
      })
    ).toBe(true)
    expect(
      shouldShowAnnualReportStartState({
        isAnnualReport: true,
        selectedReportObjectId: "property:property-1",
      })
    ).toBe(false)
  })

  it("does not use the annual start state for other report modules", () => {
    expect(
      shouldShowAnnualReportStartState({
        isAnnualReport: false,
        selectedReportObjectId: "",
      })
    ).toBe(false)
  })

  it("counts selectable annual report objects from existing overview and property data", () => {
    expect(
      getSelectableAnnualReportObjectCount({
        overview: {
          mobileGroup: null,
          properties: [],
          reportingGroups: [
            { id: "property:1" },
            { id: "installation:1" },
          ],
          year: 2026,
        } as unknown as Parameters<typeof getSelectableAnnualReportObjectCount>[0]["overview"],
        properties: [
          { id: "property-1", municipality: "Malmö", name: "Fastighet 1" },
          { id: "property-2", municipality: "Lund", name: "Fastighet 2" },
        ],
        selectedMunicipality: "Malmö",
      })
    ).toBe(3)
  })

  it("supports the empty report-object state", () => {
    expect(
      getSelectableAnnualReportObjectCount({
        overview: null,
        properties: [],
        selectedMunicipality: "",
      })
    ).toBe(0)
  })
})
