import { describe, expect, it } from "vitest"
import {
  getSuggestedPropertyImportField,
  mapPropertyRowsWithMapping,
  normalizePropertyDesignation,
  parsePropertyImportRows,
  type PropertyColumnMapping,
} from "@/lib/property-import"

describe("property import helpers", () => {
  it("requires property designation", () => {
    const [row] = parsePropertyImportRows([
      {
        name: "Förskolan Åsen",
        municipality: "Stockholm",
      },
    ])

    expect(row.errors).toContain("Saknar fastighetsbeteckning")
  })

  it("uses property designation as a valid minimal row", () => {
    const [row] = parsePropertyImportRows([
      {
        propertyDesignation: "Åsen 1:23",
      },
    ])

    expect(row.errors).toEqual([])
    expect(row.warnings).toContain(
      "Namn saknas - fastighetsbeteckning används som namn"
    )
    expect(row.propertyDesignation).toBe("Åsen 1:23")
  })

  it("maps common Swedish property columns", () => {
    expect(getSuggestedPropertyImportField("Fastighetsbeteckning")).toBe(
      "propertyDesignation"
    )
    expect(getSuggestedPropertyImportField("Objektsnamn")).toBe("name")
    expect(getSuggestedPropertyImportField("Ort")).toBe("city")
    expect(getSuggestedPropertyImportField("Kommun")).toBe("municipality")
    expect(getSuggestedPropertyImportField("Postnummer")).toBe("postalCode")
  })

  it("parses rows through explicit column mapping", () => {
    const mapping: PropertyColumnMapping = {
      Fastighet: "propertyDesignation",
      Objektsnamn: "name",
      Ort: "city",
      Kommun: "municipality",
    }
    const mappedRows = mapPropertyRowsWithMapping(
      [
        {
          Fastighet: "Skolan 2:4",
          Objektsnamn: "Skolan",
          Ort: "Malmö",
          Kommun: "Malmö",
        },
      ],
      mapping
    )
    const [row] = parsePropertyImportRows(mappedRows)

    expect(row.errors).toEqual([])
    expect(row).toMatchObject({
      propertyDesignation: "Skolan 2:4",
      name: "Skolan",
      city: "Malmö",
      municipality: "Malmö",
    })
  })

  it("normalizes property designations for duplicate checks", () => {
    expect(normalizePropertyDesignation(" Åsen 1 : 23 ")).toBe("asen 1:23")
    expect(normalizePropertyDesignation("ÅSEN 1:23")).toBe("asen 1:23")
  })
})
