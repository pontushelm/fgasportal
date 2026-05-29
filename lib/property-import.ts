import { normalizeHeader } from "@/lib/installation-import"

export type ImportPropertyInput = {
  row: number
  propertyDesignation: string | null
  name: string | null
  municipality: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  internalReference: string | null
  description: string | null
}

export type PropertyImportFieldKey = keyof Omit<ImportPropertyInput, "row">

export type PropertyImportFieldDefinition = {
  key: PropertyImportFieldKey
  label: string
  required?: boolean
  aliases: string[]
}

export type PropertyColumnMapping = Record<string, PropertyImportFieldKey | "">

export type ParsedPropertyImportRow = ImportPropertyInput & {
  errors: string[]
  warnings: string[]
}

const MAX_PROPERTY_IMPORT_ROWS = 500

export const PROPERTY_IMPORT_FIELD_DEFINITIONS: PropertyImportFieldDefinition[] = [
  {
    key: "propertyDesignation",
    label: "Fastighetsbeteckning",
    required: true,
    aliases: [
      "fastighetsbeteckning",
      "fastighet beteckning",
      "fastighet",
      "fastighets id",
      "property designation",
      "designation",
    ],
  },
  {
    key: "name",
    label: "Namn",
    aliases: [
      "fastighetsnamn",
      "namn",
      "objekt",
      "objektsnamn",
      "byggnad",
      "property name",
      "name",
    ],
  },
  {
    key: "municipality",
    label: "Kommun",
    aliases: ["kommun", "municipality"],
  },
  {
    key: "city",
    label: "Ort",
    aliases: ["ort", "stad", "city"],
  },
  {
    key: "address",
    label: "Adress",
    aliases: ["adress", "besöksadress", "gatuadress", "address", "street"],
  },
  {
    key: "postalCode",
    label: "Postnummer",
    aliases: ["postnummer", "postnr", "postkod", "postal code", "zip"],
  },
  {
    key: "internalReference",
    label: "Intern referens",
    aliases: [
      "organisationsintern referens",
      "intern referens",
      "intern kod",
      "objektsnummer",
      "referens",
      "reference",
      "internal reference",
    ],
  },
  {
    key: "description",
    label: "Kommentar",
    aliases: ["kommentar", "beskrivning", "anteckning", "notes", "description"],
  },
]

export const REQUIRED_PROPERTY_IMPORT_FIELDS = PROPERTY_IMPORT_FIELD_DEFINITIONS.filter(
  (field) => field.required
).map((field) => field.key)

export function getSuggestedPropertyImportField(
  header: string
): PropertyImportFieldKey | null {
  const normalizedHeader = normalizeHeader(header)

  return (
    PROPERTY_IMPORT_FIELD_DEFINITIONS.find((field) =>
      field.aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)
    )?.key ?? null
  )
}

export function getPropertyImportFieldLabel(key: PropertyImportFieldKey) {
  return PROPERTY_IMPORT_FIELD_DEFINITIONS.find((field) => field.key === key)?.label ?? key
}

export function getMissingRequiredPropertyImportFields(
  mappedFields: PropertyImportFieldKey[]
) {
  return REQUIRED_PROPERTY_IMPORT_FIELDS.filter(
    (field) => !mappedFields.includes(field)
  )
}

export function getDuplicatePropertyMappedFields(mapping: PropertyColumnMapping) {
  const mappedFields = Object.values(mapping).filter(Boolean) as PropertyImportFieldKey[]

  return Array.from(
    new Set(
      mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index)
    )
  )
}

export function isPropertyFieldSelectedByAnotherColumn(
  mapping: PropertyColumnMapping,
  field: PropertyImportFieldKey,
  currentColumn: string
) {
  return Object.entries(mapping).some(
    ([column, mappedField]) => column !== currentColumn && mappedField === field
  )
}

export function mapPropertyRowsWithMapping(
  rows: Record<string, unknown>[],
  mapping: PropertyColumnMapping
) {
  return rows.map((row) => {
    const mappedRow: Record<string, unknown> = {}

    Object.entries(mapping).forEach(([header, key]) => {
      if (key) mappedRow[key] = row[header]
    })

    return mappedRow
  })
}

export function parsePropertyImportRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, MAX_PROPERTY_IMPORT_ROWS).map((row, index) =>
    normalizePropertyImportRow(row, index + 2)
  )
}

export function normalizePropertyImportRow(
  rawRow: Record<string, unknown>,
  rowNumber: number
): ParsedPropertyImportRow {
  const propertyDesignation = getOptionalString(rawRow, "propertyDesignation")
  const name = getOptionalString(rawRow, "name")
  const municipality = getOptionalString(rawRow, "municipality")
  const city = getOptionalString(rawRow, "city")
  const address = getOptionalString(rawRow, "address")
  const postalCode = getOptionalString(rawRow, "postalCode")
  const internalReference = getOptionalString(rawRow, "internalReference")
  const description = getOptionalString(rawRow, "description")
  const errors: string[] = []
  const warnings: string[] = []

  if (!propertyDesignation) {
    errors.push("Saknar fastighetsbeteckning")
  }

  if (!name && propertyDesignation) {
    warnings.push("Namn saknas - fastighetsbeteckning används som namn")
  }

  return {
    row: rowNumber,
    propertyDesignation,
    name,
    municipality,
    city,
    address,
    postalCode,
    internalReference,
    description,
    errors,
    warnings,
  }
}

export function isEmptyPropertyImportRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => !hasValue(value))
}

export function normalizePropertyDesignation(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*/g, ":") ?? ""
}

export function getMaxPropertyImportRows() {
  return MAX_PROPERTY_IMPORT_ROWS
}

function getOptionalString(
  row: Record<string, unknown>,
  key: PropertyImportFieldKey
) {
  const value = row[key]
  if (!hasValue(value)) return null

  return String(value).trim()
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== ""
}
