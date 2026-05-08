import { describe, expect, it } from "vitest"
import {
  getSuggestedImportField,
  getDuplicateMappedFields,
  isImportFieldSelectedByAnotherColumn,
  mapImportRowsWithMapping,
  normalizeImportRow,
  parseImportRows,
  type ColumnMapping,
} from "@/lib/installation-import"

describe("installation import parsing", () => {
  it("maps Köldmediemängd to Fyllnadsmängd", () => {
    expect(getSuggestedImportField("Köldmediemängd")).toBe("refrigerantAmount")
    expect(getSuggestedImportField("Köldmediemängd (kg)")).toBe(
      "refrigerantAmount"
    )
  })

  it("imports rows with missing optional placement and property as warnings", () => {
    const row = normalizeImportRow(
      {
        name: "Kylaggregat 1",
        refrigerantType: "R-404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.warnings).toEqual([
      "Saknar placering - kan kompletteras senare",
      "Saknar fastighet - kan kopplas senare",
    ])
    expect(row.refrigerantType).toBe("R404A")
  })

  it("blocks rows with missing required fields", () => {
    const row = normalizeImportRow(
      {
        location: "Maskinrum",
        refrigerantType: "R404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toContain("Saknar namn")
  })

  it("blocks invalid fill amount", () => {
    const row = normalizeImportRow(
      {
        name: "Kylaggregat 1",
        refrigerantType: "R404A",
        refrigerantAmount: "abc",
      },
      2
    )

    expect(row.errors).toContain("Ogiltig fyllnadsmängd")
  })

  it("warns for unknown refrigerants without crashing", () => {
    const row = normalizeImportRow(
      {
        name: "Kylaggregat 1",
        refrigerantType: "R999X",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.refrigerantType).toBe("R999X")
    expect(row.warnings).toContain(
      "Okänt GWP-värde - CO₂e och kontrollplikt kan kompletteras senare"
    )
  })

  it("parses rows through explicit column mapping", () => {
    const mapping: ColumnMapping = {
      Aggregat: "name",
      Gas: "refrigerantType",
      "Köldmediemängd": "refrigerantAmount",
      Extra: "",
    }
    const rows = mapImportRowsWithMapping(
      [
        {
          Aggregat: "Kylaggregat 1",
          Gas: "R 404 A",
          "Köldmediemängd": 10,
          Extra: "ignoreras",
        },
      ],
      mapping
    )

    const parsed = parseImportRows(rows)

    expect(parsed[0].name).toBe("Kylaggregat 1")
    expect(parsed[0].refrigerantType).toBe("R404A")
    expect(parsed[0].refrigerantAmount).toBe(10)
    expect(parsed[0].errors).toEqual([])
  })

  it("detects duplicate mapped target fields", () => {
    const mapping: ColumnMapping = {
      Namn: "name",
      Aggregat: "name",
      Gas: "refrigerantType",
      Extra: "",
    }

    expect(getDuplicateMappedFields(mapping)).toEqual(["name"])
    expect(isImportFieldSelectedByAnotherColumn(mapping, "name", "Namn")).toBe(
      true
    )
    expect(
      isImportFieldSelectedByAnotherColumn(mapping, "refrigerantType", "Gas")
    ).toBe(false)
  })

  it("does not expose GWP or CO2e as import target fields", () => {
    expect(getSuggestedImportField("GWP")).toBeNull()
    expect(getSuggestedImportField("CO2e")).toBeNull()
    expect(getSuggestedImportField("CO₂e")).toBeNull()
  })
})
