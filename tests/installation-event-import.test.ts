import { describe, expect, it } from "vitest"
import {
  buildEventImportPreview,
  normalizeEventImportRow,
} from "@/lib/installation-event-import"

const properties = [
  { id: "property-a", name: "Stadshuset" },
  { id: "property-b", name: "Servicehuset" },
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
    expect(row.warnings).toContain("Saknar fastighet - matchar endast på Aggregat-ID")
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
