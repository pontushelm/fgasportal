import { describe, expect, it } from "vitest"
import type { DataQualityIssue } from "@/lib/dashboard/data-quality"
import {
  buildRegisterStatusPresentation,
  filterRegisterStatusSections,
  presentRegisterStatusIssue,
} from "@/lib/dashboard/data-quality-presentation"

function issue(overrides: Partial<DataQualityIssue>): DataQualityIssue {
  return {
    count: 1,
    ctaLabel: "Visa",
    description: "Beskrivning",
    group: "installations",
    id: "INSTALLATION_MISSING_REFRIGERANT",
    route: "/dashboard/installations?quality=missing-refrigerant",
    severity: "HIGH",
    title: "Aggregat saknar köldmedium",
    ...overrides,
  }
}

describe("register status presentation", () => {
  it("categorizes existing issue types into user-facing priority sections", () => {
    const presentation = buildRegisterStatusPresentation({
      issues: [
        issue({
          count: 2,
          id: "INSTALLATION_MISSING_REFRIGERANT",
          title: "Aggregat saknar köldmedium",
        }),
        issue({
          count: 1,
          id: "INSTALLATION_UNKNOWN_LEGAL_CLASSIFICATION",
          title: "Aggregat behöver regelklassificering",
        }),
        issue({
          count: 3,
          id: "INSTALLATION_MOBILE_MISSING_IDENTIFIER",
          severity: "LOW",
          title: "Mobila aggregat saknar identifiering",
        }),
      ],
    })

    expect(section(presentation, "report_requirements").count).toBe(2)
    expect(section(presentation, "needs_review").count).toBe(1)
    expect(section(presentation, "recommended").count).toBe(3)
    expect(presentation.summary.map((item) => item.label)).toEqual([
      "Krav inför rapport",
      "Behöver granskas",
      "Rekommenderas",
    ])
  })

  it("sorts by severity, impact and title within each section", () => {
    const presentation = buildRegisterStatusPresentation({
      issues: [
        issue({
          id: "PROPERTY_MISSING_DESIGNATION",
          severity: "HIGH",
          title: "Fastigheter saknar fastighetsbeteckning",
        }),
        issue({
          id: "INSTALLATION_MISSING_PROPERTY",
          severity: "HIGH",
          title: "Aggregat saknar fastighet",
        }),
        issue({
          id: "PROPERTY_MISSING_MUNICIPALITY",
          severity: "MEDIUM",
          title: "Fastigheter saknar kommun",
        }),
      ],
    })

    expect(
      section(presentation, "report_requirements").issues.map(
        (candidate) => candidate.issue.id
      )
    ).toEqual([
      "INSTALLATION_MISSING_PROPERTY",
      "PROPERTY_MISSING_DESIGNATION",
      "PROPERTY_MISSING_MUNICIPALITY",
    ])
  })

  it("explains score factors without exposing implementation details", () => {
    const presentation = buildRegisterStatusPresentation({ issues: [] })

    expect(presentation.scoreExplanation.summary).toContain(
      "komplett underlaget"
    )
    expect(presentation.scoreExplanation.factors).toEqual([
      "obligatoriska uppgifter i fastigheter och aggregat",
      "om underlaget går att använda för rapportering",
      "övergripande registerkvalitet och spårbarhet",
    ])
  })

  it("adds short issue explanations and recommended actions", () => {
    const missingRefrigerant = presentRegisterStatusIssue(
      issue({ id: "INSTALLATION_MISSING_REFRIGERANT" })
    )
    const unknownClassification = presentRegisterStatusIssue(
      issue({ id: "INSTALLATION_UNKNOWN_LEGAL_CLASSIFICATION" })
    )

    expect(missingRefrigerant.whyItMatters).toContain("kontroll- eller rapportkrav")
    expect(missingRefrigerant.recommendedAction).toBe(
      "Komplettera aggregatet med köldmedium."
    )
    expect(unknownClassification.sectionId).toBe("needs_review")
    expect(unknownClassification.recommendedAction).toBe(
      "Kontrollera köldmediets regelklassificering."
    )
  })

  it("filters priority sections", () => {
    const presentation = buildRegisterStatusPresentation({
      issues: [
        issue({ id: "INSTALLATION_MISSING_CHARGE" }),
        issue({ id: "TECHNICIAN_CERTIFICATE_MISSING", severity: "MEDIUM" }),
      ],
    })

    expect(filterRegisterStatusSections(presentation.sections, "all")).toHaveLength(3)
    expect(
      filterRegisterStatusSections(presentation.sections, "needs_review").map(
        (candidate) => candidate.id
      )
    ).toEqual(["needs_review"])
  })

  it("does not expose backend issue ids in user-facing presentation text", () => {
    const presentation = buildRegisterStatusPresentation({
      issues: [
        issue({ id: "INSTALLATION_VESSEL_MISSING_IDENTIFIER" }),
        issue({ id: "SERVICEPARTNER_CERTIFICATE_EXPIRED", severity: "HIGH" }),
      ],
    })
    const text = presentation.sections
      .flatMap((candidate) => [
        candidate.title,
        candidate.purpose,
        ...candidate.issues.flatMap((item) => [
          item.whyItMatters,
          item.recommendedAction,
        ]),
      ])
      .join(" ")

    expect(text).not.toContain("INSTALLATION_")
    expect(text).not.toContain("SERVICEPARTNER_")
    expect(text).not.toContain("TECHNICIAN_")
  })
})

function section(
  presentation: ReturnType<typeof buildRegisterStatusPresentation>,
  id: "report_requirements" | "needs_review" | "recommended"
) {
  const result = presentation.sections.find((candidate) => candidate.id === id)
  expect(result).toBeDefined()
  return result!
}
