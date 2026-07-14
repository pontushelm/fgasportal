import { describe, expect, it } from "vitest"
import {
  createReportingExplanation,
  formatReportingRecipientLabel,
  formatReportingScopeLabel,
  getRecipientExplanation,
  type ReportingPresentation,
} from "@/lib/reporting/reportingPresentation"

const rawEnumValues = [
  "MUNICIPALITY",
  "TRANSPORT_AGENCY",
  "PROPERTY",
  "INDIVIDUAL",
  "VESSEL",
]

function expectNoRawEnums(explanation: ReportingPresentation) {
  const text = [
    explanation.statusLabel,
    explanation.title,
    explanation.reason,
    explanation.recipientLabel,
    explanation.recipientExplanation,
    explanation.scopeLabel,
    explanation.thresholdLabel,
    explanation.evaluatedValueLabel,
    ...explanation.details,
  ].join(" ")

  for (const value of rawEnumValues) {
    expect(text).not.toContain(value)
  }
}

describe("reporting presentation", () => {
  it.each([
    ["PROPERTY", true, "Årsrapport krävs för fastigheten"],
    ["PROPERTY", false, "Fastigheten ligger under rapportgränsen"],
    ["INDIVIDUAL", true, "Årsrapport krävs för aggregatet"],
    ["INDIVIDUAL", false, "Aggregatet ligger under rapportgränsen"],
    ["VESSEL", true, "Årsrapport krävs för fartygsgruppen"],
    ["VESSEL", false, "Fartygsgruppen ligger under rapportgränsen"],
  ] as const)(
    "explains %s reporting decisions without exposing raw enums",
    (reportingScope, reportable, expectedTitle) => {
      const explanation = createReportingExplanation({
        evaluatedCo2eTon: reportable ? 20 : 3,
        recipient:
          reportingScope === "VESSEL" ? "TRANSPORT_AGENCY" : "MUNICIPALITY",
        reportable,
        reportingScope,
      })

      expect(explanation.title).toBe(expectedTitle)
      expect(explanation.statusLabel).toBe(
        reportable ? "Rapportpliktig" : "Ej rapportpliktig"
      )
      expect(explanation.thresholdLabel).toBe("14 ton CO₂e")
      expect(explanation.evaluatedValueLabel).toContain("ton CO₂e")
      expectNoRawEnums(explanation)
    }
  )

  it("explains unknown reporting decisions", () => {
    const explanation = createReportingExplanation({
      annualReportRequirement: "UNCERTAIN",
      evaluatedCo2eTon: null,
      reportRecipient: "UNKNOWN",
      reportReason: "REPORTING_CLASSIFICATION_UNCERTAIN",
      reportingScope: "PROPERTY",
    })

    expect(explanation.statusLabel).toBe("Bedömning behöver granskas")
    expect(explanation.title).toBe("Rapporteringskrav behöver granskas")
    expect(explanation.evaluatedValueLabel).toBe("Kan inte beräknas")
    expect(explanation.recipientLabel).toBe("Mottagare behöver kontrolleras")
    expectNoRawEnums(explanation)
  })

  it("formats recipients and scopes for user-facing display", () => {
    expect(formatReportingRecipientLabel("MUNICIPALITY")).toBe("Kommun")
    expect(formatReportingRecipientLabel("TRANSPORT_AGENCY")).toBe(
      "Transportstyrelsen"
    )
    expect(formatReportingRecipientLabel("UNKNOWN")).toBe(
      "Mottagare behöver kontrolleras"
    )
    expect(getRecipientExplanation("MUNICIPALITY")).toContain(
      "kommunens miljökontor"
    )
    expect(formatReportingScopeLabel("PROPERTY")).toBe("Stationär anläggning")
    expect(formatReportingScopeLabel("INDIVIDUAL")).toBe("Mobilt aggregat")
    expect(formatReportingScopeLabel("VESSEL")).toBe("Fartyg")
  })
})
