import { describe, expect, it } from "vitest"
import {
  filterReportGroupCards,
  formatReportGroupReadinessSummary,
  formatReportGroupRecipientLabel,
  formatReportGroupScopeLabel,
  formatReportGroupStatusLabel,
  getReportGroupPresentationStatus,
  sortReportGroupCards,
  type ReportGroupPresentationInput,
} from "@/lib/reports/reportGroupPresentation"

function group(
  overrides: Partial<ReportGroupPresentationInput>
): ReportGroupPresentationInput {
  return {
    annualReportRequirement: "REQUIRED",
    blockingIssueCount: 0,
    installedCo2eTon: 18,
    name: "B-grupp",
    reportRecipient: "MUNICIPALITY",
    reportingScope: "PROPERTY",
    reviewWarningCount: 0,
    signedStatus: "NOT_SIGNED",
    ...overrides,
  }
}

describe("report group presentation", () => {
  it("uses friendly scope labels instead of enum values", () => {
    expect(formatReportGroupScopeLabel("PROPERTY")).toBe("Stationär anläggning")
    expect(formatReportGroupScopeLabel("INDIVIDUAL")).toBe("Mobilt aggregat")
    expect(formatReportGroupScopeLabel("VESSEL")).toBe("Fartyg")
  })

  it("uses friendly recipient labels instead of enum values", () => {
    expect(formatReportGroupRecipientLabel("MUNICIPALITY")).toBe("Kommun")
    expect(formatReportGroupRecipientLabel("TRANSPORT_AGENCY")).toBe(
      "Transportstyrelsen"
    )
    expect(formatReportGroupRecipientLabel("UNKNOWN")).toBe(
      "Mottagare behöver kontrolleras"
    )
  })

  it("maps existing report group/readiness data to user-facing statuses", () => {
    expect(formatReportGroupStatusLabel(getReportGroupPresentationStatus(group({})))).toBe(
      "Rapportpliktig"
    )
    expect(
      formatReportGroupStatusLabel(
        getReportGroupPresentationStatus(group({ blockingIssueCount: 2 }))
      )
    ).toBe("Underlag behöver kompletteras")
    expect(
      formatReportGroupStatusLabel(
        getReportGroupPresentationStatus(
          group({ annualReportRequirement: "NOT_REQUIRED" })
        )
      )
    ).toBe("Ej rapportpliktig")
    expect(
      formatReportGroupStatusLabel(
        getReportGroupPresentationStatus(group({ signedStatus: "SIGNED" }))
      )
    ).toBe("Signerad")
  })

  it("sorts reportable groups needing attention before ready, signed and non-reportable groups", () => {
    const sorted = sortReportGroupCards([
      group({ annualReportRequirement: "NOT_REQUIRED", name: "Ej krav" }),
      group({ name: "Redo" }),
      group({ blockingIssueCount: 1, name: "Komplettera" }),
      group({ name: "Signerad", signedStatus: "SIGNED" }),
      group({ annualReportRequirement: "UNCERTAIN", name: "Granska" }),
    ])

    expect(sorted.map((item) => item.name)).toEqual([
      "Komplettera",
      "Redo",
      "Signerad",
      "Ej krav",
      "Granska",
    ])
  })

  it("filters cards by report group scope", () => {
    const groups = [
      group({ name: "Fastighet", reportingScope: "PROPERTY" }),
      group({ name: "Lastbil", reportingScope: "INDIVIDUAL" }),
      group({ name: "Aurora", reportingScope: "VESSEL" }),
    ]

    expect(filterReportGroupCards(groups, "INDIVIDUAL").map((item) => item.name)).toEqual([
      "Lastbil",
    ])
    expect(filterReportGroupCards(groups, "ALL")).toHaveLength(3)
  })

  it("keeps readiness summaries concise for non-reportable and incomplete groups", () => {
    expect(
      formatReportGroupReadinessSummary(
        group({ annualReportRequirement: "NOT_REQUIRED" })
      )
    ).toContain("Ingen årsrapport krävs")
    expect(
      formatReportGroupReadinessSummary(group({ blockingIssueCount: 1 }))
    ).toBe("1 uppgift behöver kompletteras.")
  })
})
