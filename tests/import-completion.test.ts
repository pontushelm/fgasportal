import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ImportCompletionSummary } from "@/components/dashboard/import-completion-summary"
import {
  buildImportCompletionRecommendations,
  buildImportCompletionWarnings,
} from "@/lib/import-completion"

describe("import completion summary", () => {
  it("renders imported counts, warnings and next actions", () => {
    const html = renderToStaticMarkup(
      createElement(ImportCompletionSummary, {
        actions: [
          { href: "/dashboard/installations", label: "Visa aggregat" },
          { href: "/dashboard/data-quality", label: "Öppna datakvalitet" },
        ],
        errors: [{ row: 12, message: "Saknar köldmedium" }],
        importedCount: 8,
        kind: "installations",
        skippedCount: 2,
        unmappedColumnCount: 3,
        validationIssueCount: 1,
      })
    )

    expect(html).toContain("Importen är klar")
    expect(html).toContain("Importerade")
    expect(html).toContain(">8<")
    expect(html).toContain("Hoppade över")
    expect(html).toContain("ignorerade kolumner")
    expect(html).toContain("Saknar köldmedium")
    expect(html).toContain("Öppna datakvalitet")
  })

  it("renders an empty warning state", () => {
    const html = renderToStaticMarkup(
      createElement(ImportCompletionSummary, {
        actions: [{ href: "/dashboard/properties", label: "Visa fastigheter" }],
        importedCount: 3,
        kind: "properties",
      })
    )

    expect(html).toContain("Inga varningar rapporterades")
    expect(html).toContain("Fortsätt med aggregatregistret")
  })

  it("selects contextual installation recommendations", () => {
    const recommendations = buildImportCompletionRecommendations("installations", {
      hasNoProperties: true,
      installationsMissingPropertyCount: 4,
      servicePartnersConfigured: false,
    })

    expect(recommendations.map((item) => item.title)).toEqual([
      "Lägg till fastigheter",
      "Koppla aggregat till fastigheter",
      "Fortsätt med kontrollhistorik",
      "Kontrollera datakvalitet",
      "Sätt upp servicepartner",
    ])
  })

  it("selects event and property recommendations", () => {
    expect(
      buildImportCompletionRecommendations("events").map((item) => item.href)
    ).toEqual([
      "/dashboard/data-quality",
      "/dashboard/reports",
      "/dashboard/actions",
    ])
    expect(
      buildImportCompletionRecommendations("properties").map((item) => item.href)
    ).toEqual(["/dashboard/installations/import"])
  })

  it("builds warnings from skipped rows, validation issues and unmapped columns", () => {
    expect(
      buildImportCompletionWarnings({
        skipped: 2,
        unmappedColumnCount: 5,
        validationIssueCount: 1,
      })
    ).toEqual([
      { label: "Hoppade över", value: 2 },
      { label: "Valideringsproblem", value: 1 },
      { label: "Ignorerade kolumner", value: 5 },
    ])
  })
})
