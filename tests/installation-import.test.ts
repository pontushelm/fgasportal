import { describe, expect, it } from "vitest"
import {
  DUPLICATE_AGGREGAT_HISTORY_MESSAGE,
  EVENT_HISTORY_IMPORT_MESSAGE,
  getDuplicateMappedFields,
  getDetectedEventHistoryColumns,
  findImportPropertyMatch,
  getSuggestedImportField,
  getImportPropertyMatchWarning,
  isDuplicateEquipmentIdentity,
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

  it("imports Aggregat-ID only rows and uses it as display name", () => {
    const row = normalizeImportRow(
      {
        equipmentId: "AGG-001",
        refrigerantType: "R-404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.warnings).toEqual([
      "Saknar fastighet - kan kopplas senare",
    ])
    expect(row.name).toBe("AGG-001")
    expect(row.equipmentId).toBe("AGG-001")
    expect(row.refrigerantType).toBe("R404A")
    expect(row.installationDate).toBeNull()
  })

  it("imports name-only rows with a warning for backward compatibility", () => {
    const row = normalizeImportRow(
      {
        name: "Kylaggregat 1",
        refrigerantType: "R404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.warnings).toContain(
      "Saknar Aggregat-ID / märkning - rekommenderas för register och framtida händelsematchning"
    )
    expect(row.name).toBe("Kylaggregat 1")
    expect(row.equipmentId).toBeNull()
  })

  it("does not warn per row when placement is missing", () => {
    const row = normalizeImportRow(
      {
        equipmentId: "AGG-001",
        propertyName: "Stadshuset",
        refrigerantType: "R404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.warnings).not.toContain("Saknar placering - kan kompletteras senare")
  })

  it("blocks rows missing both Aggregat-ID and name", () => {
    const row = normalizeImportRow(
      {
        location: "Maskinrum",
        refrigerantType: "R404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toContain("Saknar Aggregat-ID / märkning eller aggregatnamn")
  })

  it("blocks invalid fill amount", () => {
    const row = normalizeImportRow(
      {
        equipmentId: "AGG-001",
        refrigerantType: "R404A",
        refrigerantAmount: "abc",
      },
      2
    )

    expect(row.errors).toContain("Ogiltig fyllnadsmängd")
  })

  it("warns for unknown refrigerants without changing CO2e behavior", () => {
    const row = normalizeImportRow(
      {
        equipmentId: "AGG-001",
        refrigerantType: "R999X",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(row.refrigerantType).toBe("R999X")
    expect(row.inspectionIntervalMonths).toBeNull()
    expect(row.nextInspection).toBeNull()
    expect(row.warnings).toContain(
      "Okänt GWP-värde - CO₂e och kontrollplikt kan kompletteras senare"
    )
  })

  it("parses rows through explicit column mapping", () => {
    const mapping: ColumnMapping = {
      "Aggregat-ID": "equipmentId",
      Aggregat: "name",
      Gas: "refrigerantType",
      "Köldmediemängd": "refrigerantAmount",
      Extra: "",
    }
    const rows = mapImportRowsWithMapping(
      [
        {
          "Aggregat-ID": "AGG-001",
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
    expect(parsed[0].equipmentId).toBe("AGG-001")
    expect(parsed[0].refrigerantType).toBe("R404A")
    expect(parsed[0].refrigerantAmount).toBe(10)
    expect(parsed[0].errors).toEqual([])
  })

  it("maps common Swedish Aggregat-ID aliases to equipmentId", () => {
    expect(getSuggestedImportField("Aggregat-ID")).toBe("equipmentId")
    expect(getSuggestedImportField("Aggregat ID")).toBe("equipmentId")
    expect(getSuggestedImportField("Aggregatnummer")).toBe("equipmentId")
    expect(getSuggestedImportField("Aggregatnr")).toBe("equipmentId")
    expect(getSuggestedImportField("Aggregat nr")).toBe("equipmentId")
    expect(getSuggestedImportField("Märkning")).toBe("equipmentId")
    expect(getSuggestedImportField("Märk-ID")).toBe("equipmentId")
    expect(getSuggestedImportField("Objekt-ID")).toBe("equipmentId")
    expect(getSuggestedImportField("Utrustnings-ID")).toBe("equipmentId")
    expect(getSuggestedImportField("Inventarienummer")).toBe("equipmentId")
    expect(getSuggestedImportField("Anläggnings-ID")).toBe("equipmentId")
  })

  it("detects likely event-history columns", () => {
    const detectedColumns = getDetectedEventHistoryColumns([
      "Aggregat-ID",
      "Händelsedatum",
      "Händelsetyp",
      "Läckage",
      "Fastighet",
    ])

    expect(detectedColumns).toEqual(["Händelsedatum", "Händelsetyp", "Läckage"])
    expect(EVENT_HISTORY_IMPORT_MESSAGE).toContain(
      "Den här importen skapar endast aggregat"
    )
  })

  it("matches imported property names case-insensitively", () => {
    const property = findImportPropertyMatch("  stadshuset  ", [
      { id: "property-1", name: "Stadshuset" },
    ])

    expect(property?.id).toBe("property-1")
  })

  it("returns no property match for unknown property names", () => {
    const property = findImportPropertyMatch("Okänd fastighet", [
      { id: "property-1", name: "Stadshuset" },
    ])

    expect(property).toBeNull()
  })

  it("warns for unmatched property names without blocking the row", () => {
    const row = normalizeImportRow(
      {
        equipmentId: "AGG-001",
        propertyName: "Okänd fastighet",
        refrigerantType: "R404A",
        refrigerantAmount: "10",
      },
      2
    )

    expect(row.errors).toEqual([])
    expect(
      getImportPropertyMatchWarning(row.propertyName, [
        { id: "property-1", name: "Stadshuset" },
      ])
    ).toBe("Fastigheten hittades inte och aggregatet importeras utan kopplad fastighet.")
  })

  it("blocks duplicate equipmentId on the same matched property", () => {
    expect(
      isDuplicateEquipmentIdentity({
        equipmentId: "VP1",
        propertyId: "property-1",
        propertyName: "Stadshuset",
        existingInstallations: [
          {
            equipmentId: "VP1",
            propertyId: "property-1",
            propertyName: "Stadshuset",
          },
        ],
      })
    ).toBe(true)
  })

  it("allows duplicate equipmentId on different matched properties", () => {
    expect(
      isDuplicateEquipmentIdentity({
        equipmentId: "VP1",
        propertyId: "property-2",
        propertyName: "Servicehuset",
        existingInstallations: [
          {
            equipmentId: "VP1",
            propertyId: "property-1",
            propertyName: "Stadshuset",
          },
        ],
      })
    ).toBe(false)
  })

  it("handles duplicate equipmentId safely without matched property context", () => {
    expect(
      isDuplicateEquipmentIdentity({
        equipmentId: "VP1",
        propertyId: null,
        propertyName: "Okänd fastighet",
        existingInstallations: [
          {
            equipmentId: "VP1",
            propertyId: null,
            propertyName: "Okänd fastighet",
          },
        ],
      })
    ).toBe(true)
  })

  it("uses a clear duplicate message for likely historical rows", () => {
    expect(DUPLICATE_AGGREGAT_HISTORY_MESSAGE).toBe(
      "Raden verkar vara ytterligare historik för samma aggregat och importerades inte som nytt aggregat. Händelseimport byggs separat."
    )
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
