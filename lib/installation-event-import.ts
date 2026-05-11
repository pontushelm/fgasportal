import type { InstallationEventType } from "@/lib/installation-events"
import { normalizeHeader, normalizeImportMatchValue } from "@/lib/installation-import"
import { z } from "zod"

export type SupportedEventImportType = Extract<
  InstallationEventType,
  "INSPECTION" | "LEAK" | "REFILL" | "SERVICE"
>

export type EventImportFieldKey =
  | "equipmentId"
  | "propertyName"
  | "eventType"
  | "eventDate"
  | "amountKg"
  | "notes"

export type EventImportFieldDefinition = {
  key: EventImportFieldKey
  label: string
  required?: boolean
  aliases: string[]
}

export type EventImportColumnMapping = Record<string, EventImportFieldKey | "">

export type EventImportInputRow = {
  row: number
  equipmentId: string
  propertyName: string | null
  eventType: string
  eventDate: string | null
  amountKg: number | null
  notes: string | null
}

export type ParsedEventImportRow = EventImportInputRow & {
  normalizedType: SupportedEventImportType | null
  errors: string[]
  warnings: string[]
}

export type EventImportPropertyReference = {
  id: string
  name: string
}

export type EventImportInstallationReference = {
  id: string
  name: string
  equipmentId: string | null
  propertyId: string | null
  propertyName: string | null
  property?: {
    id: string
    name: string
  } | null
}

export type EventImportPreviewRow = ParsedEventImportRow & {
  status: "valid" | "warning" | "blocked"
  installationId: string | null
  installationName: string | null
  matchedPropertyName: string | null
}

export type EventImportPreviewFilter = "all" | "importable" | "warnings" | "blocked"

const MAX_EVENT_IMPORT_ROWS = 500

export const eventImportRequestSchema = z.object({
  mode: z.enum(["preview", "import"]),
  rows: z.array(z.record(z.string(), z.unknown())).max(MAX_EVENT_IMPORT_ROWS),
})

export const EVENT_IMPORT_FIELD_DEFINITIONS: EventImportFieldDefinition[] = [
  {
    key: "equipmentId",
    label: "Aggregat-ID / märkning",
    required: true,
    aliases: [
      "aggregat-id",
      "aggregat id",
      "aggregatid",
      "aggregatnummer",
      "aggregatnr",
      "aggregat nr",
      "märkning",
      "markning",
      "märk-id",
      "mark-id",
      "objekt-id",
      "objekt id",
      "utrustnings-id",
      "utrustnings id",
      "inventarienummer",
      "anläggnings-id",
      "anlaggnings-id",
      "equipment id",
      "asset id",
    ],
  },
  {
    key: "propertyName",
    label: "Fastighet",
    aliases: ["fastighet", "fastighetsnamn", "byggnad", "site", "property"],
  },
  {
    key: "eventType",
    label: "Händelsetyp",
    required: true,
    aliases: ["händelsetyp", "handelsetyp", "händelse typ", "event type", "typ"],
  },
  {
    key: "eventDate",
    label: "Händelsedatum",
    required: true,
    aliases: ["händelsedatum", "handelsedatum", "datum", "event date", "date"],
  },
  {
    key: "amountKg",
    label: "Mängd",
    aliases: [
      "mängd",
      "mangd",
      "kg",
      "mängd kg",
      "mangd kg",
      "läckagemängd",
      "lackage mangd",
      "påfylld mängd",
      "pafylld mangd",
      "amount",
      "amount kg",
    ],
  },
  {
    key: "notes",
    label: "Kommentar / anteckning",
    aliases: ["kommentar", "anteckning", "anteckningar", "notes", "notering"],
  },
]

export function getMaxEventImportRows() {
  return MAX_EVENT_IMPORT_ROWS
}

export function getSuggestedEventImportField(header: string) {
  const normalizedHeader = normalizeHeader(header)

  return (
    EVENT_IMPORT_FIELD_DEFINITIONS.find((field) =>
      field.aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)
    )?.key ?? null
  )
}

export function getEventImportFieldLabel(key: EventImportFieldKey) {
  return EVENT_IMPORT_FIELD_DEFINITIONS.find((field) => field.key === key)?.label ?? key
}

export function getMissingRequiredEventImportFields(
  mappedFields: EventImportFieldKey[]
) {
  return EVENT_IMPORT_FIELD_DEFINITIONS
    .filter((field) => field.required && !mappedFields.includes(field.key))
    .map((field) => field.key)
}

export function getDuplicateEventImportMappedFields(
  mapping: EventImportColumnMapping
) {
  const mappedFields = Object.values(mapping).filter(Boolean) as EventImportFieldKey[]

  return Array.from(
    new Set(
      mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index)
    )
  )
}

export function isEventImportFieldSelectedByAnotherColumn(
  mapping: EventImportColumnMapping,
  field: EventImportFieldKey,
  currentColumn: string
) {
  return Object.entries(mapping).some(
    ([column, mappedField]) => column !== currentColumn && mappedField === field
  )
}

export function mapEventImportRowsWithMapping(
  rows: Record<string, unknown>[],
  mapping: EventImportColumnMapping
) {
  return rows.map((row, index) => {
    const mappedRow: Record<string, unknown> = { row: index + 2 }

    Object.entries(mapping).forEach(([header, key]) => {
      if (key) mappedRow[key] = row[header]
    })

    return mappedRow
  })
}

export function isEmptyEventImportRow(row: Record<string, unknown>) {
  return ["equipmentId", "propertyName", "eventType", "eventDate", "amountKg", "notes"]
    .every((key) => !hasValue(row[key]))
}

export function normalizeEventImportRow(
  rawRow: Record<string, unknown>,
  fallbackRowNumber = 2
): ParsedEventImportRow {
  const row = parseRowNumber(rawRow.row, fallbackRowNumber)
  const equipmentId = getString(rawRow, "equipmentId")
  const propertyName = getOptionalString(rawRow, "propertyName")
  const eventType = getString(rawRow, "eventType")
  const normalizedType = normalizeEventType(eventType)
  const eventDate = parseDateValue(rawRow.eventDate)
  const amountKg = parseNumber(rawRow.amountKg)
  const notes = getOptionalString(rawRow, "notes")
  const errors: string[] = []
  const warnings: string[] = []

  if (!equipmentId) errors.push("Saknar Aggregat-ID / märkning")
  if (!eventType) {
    errors.push("Saknar händelsetyp")
  } else if (!normalizedType) {
    errors.push("Ogiltig händelsetyp")
  }
  if (!eventDate) errors.push("Saknar eller har ogiltigt händelsedatum")
  if (hasValue(rawRow.amountKg) && amountKg === null) {
    errors.push("Ogiltig mängd")
  }
  if (amountKg !== null && amountKg < 0) {
    errors.push("Mängd måste vara 0 eller högre")
  }
  if (normalizedType === "LEAK" && !notes) {
    errors.push("Anteckningar krävs för läckagehändelser")
  }
  if (normalizedType === "LEAK" && amountKg === null) {
    warnings.push("Saknar läckagemängd - händelsen importeras utan mängd")
  }
  if (normalizedType === "REFILL" && amountKg === null) {
    errors.push("Påfylld mängd krävs för påfyllning")
  }
  if (!propertyName) {
    warnings.push("Saknar fastighet - händelsen matchas endast på Aggregat-ID")
  }

  return {
    row,
    equipmentId,
    propertyName,
    eventType,
    eventDate,
    amountKg,
    notes,
    normalizedType,
    errors,
    warnings,
  }
}

export function buildEventImportPreview({
  rows,
  installations,
  properties,
}: {
  rows: Record<string, unknown>[]
  installations: EventImportInstallationReference[]
  properties: EventImportPropertyReference[]
}) {
  return rows
    .filter((row) => !isEmptyEventImportRow(row))
    .slice(0, MAX_EVENT_IMPORT_ROWS)
    .map((row, index) => {
      const parsed = normalizeEventImportRow(row, index + 2)
      const match = findEventImportInstallationMatch(parsed, installations, properties)
      const errors = [...parsed.errors, ...match.errors]
      const warnings = [...parsed.warnings, ...match.warnings]
      const status =
        errors.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "valid"

      return {
        ...parsed,
        errors,
        warnings,
        status,
        installationId: match.installation?.id ?? null,
        installationName: match.installation?.name ?? null,
        matchedPropertyName: match.matchedPropertyName,
      } satisfies EventImportPreviewRow
    })
}

export function findEventImportInstallationMatch(
  row: ParsedEventImportRow,
  installations: EventImportInstallationReference[],
  properties: EventImportPropertyReference[]
) {
  const errors: string[] = []
  const warnings: string[] = []
  const normalizedEquipmentId = normalizeImportMatchValue(row.equipmentId)

  if (!normalizedEquipmentId) {
    return { installation: null, matchedPropertyName: null, errors, warnings }
  }

  const candidates = installations.filter(
    (installation) =>
      normalizeImportMatchValue(installation.equipmentId) === normalizedEquipmentId
  )

  if (candidates.length === 0) {
    errors.push("Inget aggregat hittades med angivet Aggregat-ID")
    return { installation: null, matchedPropertyName: null, errors, warnings }
  }

  const propertyMatch = findEventImportPropertyMatch(row.propertyName, properties)

  if (row.propertyName && propertyMatch) {
    const propertyCandidates = candidates.filter(
      (installation) => installation.propertyId === propertyMatch.id
    )

    if (propertyCandidates.length === 1) {
      return {
        installation: propertyCandidates[0],
        matchedPropertyName: propertyMatch.name,
        errors,
        warnings,
      }
    }

    if (propertyCandidates.length === 0) {
      errors.push("Inget aggregat med detta Aggregat-ID hittades på angiven fastighet")
    } else {
      errors.push("Flera aggregat matchar samma Aggregat-ID och fastighet")
    }

    return { installation: null, matchedPropertyName: propertyMatch.name, errors, warnings }
  }

  if (row.propertyName && !propertyMatch) {
    warnings.push("Fastigheten hittades inte - matchar endast på Aggregat-ID")
  }

  if (candidates.length === 1) {
    return {
      installation: candidates[0],
      matchedPropertyName: candidates[0].property?.name ?? candidates[0].propertyName,
      errors,
      warnings,
    }
  }

  errors.push("Flera aggregat har samma Aggregat-ID - ange fastighet för att särskilja")
  return { installation: null, matchedPropertyName: null, errors, warnings }
}

export function filterEventImportPreviewRows(
  rows: EventImportPreviewRow[],
  filter: EventImportPreviewFilter
) {
  if (filter === "importable") return rows.filter((row) => row.status !== "blocked")
  if (filter === "warnings") return rows.filter((row) => row.status === "warning")
  if (filter === "blocked") return rows.filter((row) => row.status === "blocked")
  return rows
}

export function normalizeEventType(value: string): SupportedEventImportType | null {
  const normalized = normalizeHeader(value)

  if (["kontroll", "lackagekontroll", "inspektion", "inspection"].includes(normalized)) {
    return "INSPECTION"
  }
  if (["leak", "leakage", "lackage", "lackage"].includes(normalized)) {
    return "LEAK"
  }
  if (["refill", "pafyllning", "påfyllning", "fyllning"].includes(normalized)) {
    return "REFILL"
  }
  if (["service", "servicehandelse", "service event"].includes(normalized)) {
    return "SERVICE"
  }
  if (["inspection", "inspektion"].includes(value.trim().toLowerCase())) {
    return "INSPECTION"
  }
  if (["INSPECTION", "LEAK", "REFILL", "SERVICE"].includes(value.trim())) {
    return value.trim() as SupportedEventImportType
  }

  return null
}

export function findEventImportPropertyMatch(
  propertyName: string | null | undefined,
  properties: EventImportPropertyReference[]
) {
  const normalizedPropertyName = normalizeImportMatchValue(propertyName)
  if (!normalizedPropertyName) return null

  return (
    properties.find(
      (property) => normalizeImportMatchValue(property.name) === normalizedPropertyName
    ) ?? null
  )
}

function getString(row: Record<string, unknown>, key: EventImportFieldKey) {
  return String(row[key] ?? "").trim()
}

function getOptionalString(row: Record<string, unknown>, key: EventImportFieldKey) {
  const value = getString(row, key)
  return value ? value : null
}

function parseRowNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseNumber(value: unknown) {
  if (!hasValue(value)) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null

  const parsed = Number(String(value).replace(",", ".").trim())
  return Number.isNaN(parsed) ? null : parsed
}

function parseDateValue(value: unknown) {
  if (!hasValue(value)) return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value)
  }

  if (typeof value === "number") {
    return formatDate(excelSerialDateToDate(value))
  }

  const text = String(value).trim()
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed)

  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const fullYear = year.length === 2 ? `20${year}` : year
  const date = new Date(Number(fullYear), Number(month) - 1, Number(day))

  return Number.isNaN(date.getTime()) ? null : formatDate(date)
}

function excelSerialDateToDate(serialDate: number) {
  const utcDays = Math.floor(serialDate - 25569)
  const utcValue = utcDays * 86400
  return new Date(utcValue * 1000)
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== ""
}
