import { describe, expect, it } from "vitest"
import {
  buildEventImportPreview,
  eventImportRequestSchema,
  filterEventImportPreviewRows,
  normalizeEventImportRow,
} from "@/lib/installation-event-import"

const properties = [
  { id: "property-a", name: "Stadshuset" },
  { id: "property-b", name: "Servicehuset" },
  { id: "property-c", name: "Biblioteket" },
]

const installations = [
  {
    id: "installation-a",
    name: "Kyl A",
    equipmentId: "VP1",
    propertyId: "property-a",
    propertyName: "Stadshuset",
    property: properties[0],
  },
  {
    id: "installation-b",
    name: "Kyl B",
    equipmentId: "VP1",
    propertyId: "property-b",
    propertyName: "Servicehuset",
    property: properties[1],
  },
  {
    id: "installation-c",
    name: "Frys C",
    equipmentId: "FRYS-01",
    propertyId: null,
    propertyName: null,
    property: null,
  },
]

describe("installation event import preview", () => {
  it("matches events by equipmentId when the id is unique", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Service",
          eventDate: "2026-01-10",
          notes: "Årlig service",
        },
      ],
      installations,
      properties,
    })

    expect(row.installationId).toBe("installation-c")
    expect(row.status).toBe("warning")
    expect(row.warnings).toContain("Saknar fastighet - händelsen matchas endast på Aggregat-ID")
  })

  it("uses property context to disambiguate duplicate equipment IDs", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "VP1",
          propertyName: "Servicehuset",
          eventType: "Kontroll",
          eventDate: "2026-02-12",
        },
      ],
      installations,
      properties,
    })

    expect(row.installationId).toBe("installation-b")
    expect(row.matchedPropertyName).toBe("Servicehuset")
    expect(row.status).toBe("valid")
  })

  it("blocks unknown aggregat", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "SAKNAS",
          eventType: "Service",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
    })

    expect(row.status).toBe("blocked")
    expect(row.errors).toContain("Inget aggregat hittades med angivet Aggregat-ID")
  })

  it("blocks duplicate matches when property is missing", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "VP1",
          eventType: "Service",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
    })

    expect(row.status).toBe("blocked")
    expect(row.errors).toContain("Flera aggregat har samma Aggregat-ID - ange fastighet för att särskilja")
  })

  it("allows unique Aggregat-ID without property with a warning", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Kontroll",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
    })

    expect(row.installationId).toBe("installation-c")
    expect(row.status).toBe("warning")
    expect(row.warnings).toContain("Saknar fastighet - händelsen matchas endast på Aggregat-ID")
  })

  it("blocks duplicate Aggregat-ID when provided property does not match candidates", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "VP1",
          propertyName: "Biblioteket",
          eventType: "Kontroll",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
    })

    expect(row.status).toBe("blocked")
    expect(row.errors).toContain("Inget aggregat med detta Aggregat-ID hittades på angiven fastighet")
  })

  it("filters preview rows by importability, warnings and blocked status", () => {
    const rows = buildEventImportPreview({
      rows: [
        {
          equipmentId: "VP1",
          propertyName: "Stadshuset",
          eventType: "Kontroll",
          eventDate: "2026-01-10",
        },
        {
          equipmentId: "FRYS-01",
          eventType: "Service",
          eventDate: "2026-01-10",
        },
        {
          equipmentId: "SAKNAS",
          eventType: "Service",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
    })

    expect(filterEventImportPreviewRows(rows, "all")).toHaveLength(3)
    expect(filterEventImportPreviewRows(rows, "importable")).toHaveLength(2)
    expect(filterEventImportPreviewRows(rows, "warnings")).toHaveLength(1)
    expect(filterEventImportPreviewRows(rows, "blocked")).toHaveLength(1)
  })

  it("blocks rows that duplicate an existing imported event", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Service",
          eventDate: "2026-01-10",
          notes: "Årlig service",
        },
      ],
      installations,
      properties,
      existingEvents: [
        {
          installationId: "installation-c",
          type: "SERVICE",
          date: "2026-01-10",
          refrigerantAddedKg: null,
          notes: "  årlig   service ",
        },
      ],
    })

    expect(row.status).toBe("blocked")
    expect(row.errors).toContain(
      "En liknande händelse finns redan för detta aggregat på samma datum."
    )
  })

  it("blocks later duplicate rows within the same uploaded file", () => {
    const rows = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Påfyllning",
          eventDate: "2026-03-02",
          amountKg: 1.5,
          notes: "Påfyllning efter service",
        },
        {
          equipmentId: "FRYS-01",
          eventType: "Påfyllning",
          eventDate: "2026-03-02",
          amountKg: "1,5",
          notes: " påfyllning   efter service ",
        },
      ],
      installations,
      properties,
    })

    expect(rows[0].status).toBe("warning")
    expect(rows[1].status).toBe("blocked")
    expect(rows[1].errors).toContain(
      "En liknande händelse finns redan i filen för samma aggregat och datum."
    )
  })

  it("blocks imported inspections that duplicate existing inspection records", () => {
    const [row] = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Kontroll",
          eventDate: "2026-01-10",
        },
      ],
      installations,
      properties,
      existingInspections: [
        {
          installationId: "installation-c",
          inspectionDate: "2026-01-10",
          notes: null,
        },
      ],
    })

    expect(row.status).toBe("blocked")
    expect(row.errors).toContain(
      "En liknande händelse finns redan för detta aggregat på samma datum."
    )
  })

  it("accepts valid leakage, refill and service rows", () => {
    const rows = buildEventImportPreview({
      rows: [
        {
          equipmentId: "FRYS-01",
          eventType: "Läckage",
          eventDate: "2026-03-01",
          amountKg: 1.5,
          notes: "Läckage vid ventil",
        },
        {
          equipmentId: "FRYS-01",
          eventType: "Påfyllning",
          eventDate: "2026-03-02",
          amountKg: 1.5,
        },
        {
          equipmentId: "FRYS-01",
          eventType: "Service",
          eventDate: "2026-03-03",
        },
      ],
      installations,
      properties,
    })

    expect(rows.map((row) => row.normalizedType)).toEqual(["LEAK", "REFILL", "SERVICE"])
    expect(rows.every((row) => row.status !== "blocked")).toBe(true)
  })

  it("accepts raw client payload values before row-level normalization", () => {
    const payload = eventImportRequestSchema.parse({
      mode: "preview",
      rows: [
        {
          row: 2,
          equipmentId: "FRYS-01",
          eventType: "Påfyllning",
          eventDate: 46084,
          amountKg: "1,5",
          notes: "",
        },
      ],
    })
    const [row] = buildEventImportPreview({
      rows: payload.rows,
      installations,
      properties,
    })

    expect(row.normalizedType).toBe("REFILL")
    expect(row.eventDate).toBe("2026-03-03")
    expect(row.amountKg).toBe(1.5)
    expect(row.status).not.toBe("blocked")
  })

  it("returns field-level details only when the request envelope is malformed", () => {
    const result = eventImportRequestSchema.safeParse({
      mode: "preview",
      rows: "not rows",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["rows"])
    }
  })

  it("blocks invalid event type and missing date during preview validation", () => {
    const row = normalizeEventImportRow({
      equipmentId: "FRYS-01",
      eventType: "Byte av köldmedium",
      eventDate: "",
    })

    expect(row.errors).toContain("Ogiltig händelsetyp")
    expect(row.errors).toContain("Saknar eller har ogiltigt händelsedatum")
  })
})
