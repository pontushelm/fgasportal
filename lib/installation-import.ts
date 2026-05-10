import {
  calculateCO2e,
  calculateInspectionObligation,
} from "@/lib/fgas-calculations"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { normalizeRefrigerantCode } from "@/lib/refrigerants"

export type ImportInstallationInput = {
  row: number
  name: string
  equipmentId: string | null
  location: string
  propertyName: string | null
  municipality: string | null
  refrigerantType: string
  refrigerantAmount: number | null
  lastInspection: string | null
  nextInspection: string | null
  inspectionIntervalMonths: number | null
  hasLeakDetectionSystem: boolean
  servicePartner: string | null
  status: string | null
  installationDate: string | null
  serialNumber: string | null
  equipmentType: string | null
  operatorName: string | null
  notes: string | null
}

export type ImportFieldKey = keyof Omit<ImportInstallationInput, "row">

export type ImportFieldDefinition = {
  key: ImportFieldKey
  label: string
  required?: boolean
  aliases: string[]
}

export type ColumnMapping = Record<string, ImportFieldKey | "">

export type ParsedImportRow = ImportInstallationInput & {
  errors: string[]
  warnings: string[]
}

export type ImportPropertyReference = {
  id: string
  name: string
}

export type ExistingEquipmentIdentity = {
  equipmentId: string | null
  propertyId: string | null
  propertyName: string | null
}

const MAX_IMPORT_ROWS = 500
export const UNMATCHED_PROPERTY_WARNING =
  "Fastigheten hittades inte och aggregatet importeras utan kopplad fastighet."
export const EVENT_HISTORY_IMPORT_MESSAGE =
  "Filen verkar innehålla händelsehistorik. Den här importen skapar endast aggregat. Händelser som läckage, kontroller, service och påfyllningar importeras inte i detta steg."
export const DUPLICATE_AGGREGAT_HISTORY_MESSAGE =
  "Raden verkar vara ytterligare historik för samma aggregat och importerades inte som nytt aggregat. Händelseimport byggs separat."

const EVENT_HISTORY_COLUMN_ALIASES = [
  "händelsedatum",
  "handelsedatum",
  "händelse datum",
  "handelse datum",
  "händelsetyp",
  "handelsetyp",
  "händelse typ",
  "handelse typ",
  "event date",
  "event type",
  "kontroll",
  "kontrolldatum",
  "läckage",
  "lackage",
  "påfyllning",
  "pafyllning",
  "service",
  "reparation",
  "byte av köldmedium",
  "byte av koldmedium",
  "återvinning",
  "atervinning",
  "tömning",
  "tomning",
]

export const IMPORT_FIELD_DEFINITIONS: ImportFieldDefinition[] = [
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
      "märknings-id",
      "marknings-id",
      "objekt-id",
      "objekt id",
      "objektid",
      "utrustnings-id",
      "utrustnings id",
      "utrustningsid",
      "inventarienummer",
      "anläggnings-id",
      "anlaggnings-id",
      "anläggnings id",
      "anlaggnings id",
      "anlaggningsid",
      "id",
      "asset id",
      "equipment id",
    ],
  },
  {
    key: "name",
    label: "Aggregatnamn / benämning",
    aliases: [
      "namn",
      "aggregat",
      "aggregatnamn",
      "benämning",
      "benamning",
      "equipment",
      "unit name",
      "installation",
      "installation name",
    ],
  },
  {
    key: "location",
    label: "Plats / Placering",
    aliases: ["plats", "placering", "location", "position"],
  },
  {
    key: "propertyName",
    label: "Fastighet",
    aliases: [
      "fastighet",
      "fastighetsnamn",
      "anläggning",
      "byggnad",
      "site",
      "property",
      "property name",
    ],
  },
  {
    key: "municipality",
    label: "Kommun",
    aliases: ["kommun", "municipality"],
  },
  {
    key: "refrigerantType",
    label: "Köldmedium",
    required: true,
    aliases: ["köldmedium", "köldmedia", "koldmedium", "medium", "refrigerant", "gas"],
  },
  {
    key: "refrigerantAmount",
    label: "Fyllnadsmängd",
    required: true,
    aliases: [
      "mängd",
      "mangd",
      "fyllnadsmängd",
      "fyllnadsmangd",
      "köldmediemängd",
      "köldmediemängd kg",
      "köldmediemängd (kg)",
      "koldmediemangd",
      "koldmediemangd kg",
      "koldmediemangd (kg)",
      "charge",
      "refrigerant amount",
      "amount kg",
      "quantity",
      "kg",
    ],
  },
  {
    key: "lastInspection",
    label: "Senaste kontroll",
    aliases: [
      "senaste kontroll",
      "senaste läckagekontroll",
      "senast kontrollerad",
      "kontroll datum",
      "kontrolldatum",
      "last inspection",
      "last check",
    ],
  },
  {
    key: "nextInspection",
    label: "Nästa kontroll",
    aliases: ["nästa kontroll", "nasta kontroll", "next inspection", "next check"],
  },
  {
    key: "inspectionIntervalMonths",
    label: "Kontrollintervall",
    aliases: [
      "kontrollintervall",
      "intervall",
      "inspection interval",
      "control interval",
      "interval",
      "months",
      "månader",
      "manader",
    ],
  },
  {
    key: "hasLeakDetectionSystem",
    label: "Läckagevarningssystem",
    aliases: ["gaslarm", "läckagevarningssystem", "larm", "leak detection", "alarm"],
  },
  {
    key: "servicePartner",
    label: "Servicepartner",
    aliases: ["servicepartner", "service partner", "entreprenör", "contractor"],
  },
  {
    key: "status",
    label: "Status",
    aliases: ["status"],
  },
  {
    key: "installationDate",
    label: "Driftsättningsdatum",
    aliases: ["driftsättningsdatum", "driftsatt", "installationsdatum", "commissioning date"],
  },
  {
    key: "serialNumber",
    label: "Serienummer",
    aliases: ["serienummer", "serial number", "serial"],
  },
  {
    key: "equipmentType",
    label: "Utrustningstyp",
    aliases: ["utrustningstyp", "typ", "equipment type"],
  },
  {
    key: "operatorName",
    label: "Operatör",
    aliases: ["operatör", "operator"],
  },
  {
    key: "notes",
    label: "Anteckningar",
    aliases: ["anteckningar", "notes", "kommentar"],
  },
]

export const REQUIRED_IMPORT_FIELDS = IMPORT_FIELD_DEFINITIONS.filter(
  (field) => field.required
).map((field) => field.key)

export const IMPORT_IDENTITY_FIELDS: ImportFieldKey[] = ["equipmentId", "name"]

export function getMissingRequiredImportFields(mappedFields: ImportFieldKey[]) {
  return REQUIRED_IMPORT_FIELDS.filter((field) => {
    if (field === "equipmentId") {
      return !IMPORT_IDENTITY_FIELDS.some((identityField) =>
        mappedFields.includes(identityField)
      )
    }

    return !mappedFields.includes(field)
  })
}

export function parseImportRows(rows: Record<string, unknown>[]) {
  return rows.slice(0, MAX_IMPORT_ROWS).map((row, index) =>
    normalizeImportRow(row, index + 2)
  )
}

export function normalizeImportRow(
  rawRow: Record<string, unknown>,
  rowNumber: number
): ParsedImportRow {
  const errors: string[] = []
  const warnings: string[] = []
  const rawName = getString(rawRow, "name")
  const equipmentId = getOptionalString(rawRow, "equipmentId")
  const name = rawName || equipmentId || ""
  const location = getString(rawRow, "location")
  const propertyName = getOptionalString(rawRow, "propertyName")
  const municipality = getOptionalString(rawRow, "municipality")
  const rawRefrigerantType = getString(rawRow, "refrigerantType")
  const refrigerantType = normalizeRefrigerantCode(rawRefrigerantType)
  const serialNumber = getOptionalString(rawRow, "serialNumber")
  const equipmentType = getOptionalString(rawRow, "equipmentType")
  const operatorName = getOptionalString(rawRow, "operatorName")
  const servicePartner = getOptionalString(rawRow, "servicePartner")
  const status = getOptionalString(rawRow, "status")
  const notes = getOptionalString(rawRow, "notes")
  const refrigerantAmount = parseNumber(getValue(rawRow, "refrigerantAmount"))
  const hasLeakDetectionSystem = parseBoolean(getValue(rawRow, "hasLeakDetectionSystem"))
  const lastInspection = parseDateValue(getValue(rawRow, "lastInspection"))
  const providedNextInspection = parseDateValue(getValue(rawRow, "nextInspection"))
  const installationDate = parseDateValue(getValue(rawRow, "installationDate"))
  const providedInspectionIntervalMonths = parseInteger(
    getValue(rawRow, "inspectionIntervalMonths")
  )

  if (!equipmentId && !rawName) {
    errors.push("Saknar Aggregat-ID / märkning eller aggregatnamn")
  } else if (!equipmentId && rawName) {
    warnings.push(
      "Saknar Aggregat-ID / märkning - rekommenderas för register och framtida händelsematchning"
    )
  }
  if (!rawRefrigerantType) {
    errors.push("Saknar köldmedium")
  } else if (!refrigerantType) {
    warnings.push("Okänt GWP-värde - CO₂e och kontrollplikt kan kompletteras senare")
  }

  if (refrigerantAmount === null || Number.isNaN(refrigerantAmount) || refrigerantAmount <= 0) {
    errors.push("Ogiltig fyllnadsmängd")
  }

  if (!propertyName) warnings.push("Saknar fastighet - kan kopplas senare")

  const rawLastInspection = getValue(rawRow, "lastInspection")
  if (hasValue(rawLastInspection) && !lastInspection) {
    errors.push("Ogiltigt datum för senaste kontroll")
  }

  const rawNextInspection = getValue(rawRow, "nextInspection")
  if (hasValue(rawNextInspection) && !providedNextInspection) {
    errors.push("Ogiltigt datum för nästa kontroll")
  }

  const rawInstallationDate = getValue(rawRow, "installationDate")
  if (hasValue(rawInstallationDate) && !installationDate) {
    errors.push("Ogiltigt driftsättningsdatum")
  }

  const rawInspectionInterval = getValue(rawRow, "inspectionIntervalMonths")
  if (
    hasValue(rawInspectionInterval) &&
    (providedInspectionIntervalMonths === null || providedInspectionIntervalMonths <= 0)
  ) {
    errors.push("Ogiltigt kontrollintervall")
  }

  const calculatedInspectionIntervalMonths =
    refrigerantType && refrigerantAmount !== null && !Number.isNaN(refrigerantAmount)
      ? calculateInspectionObligation(
          calculateCO2e(refrigerantType, refrigerantAmount).co2eTon,
          hasLeakDetectionSystem
        ).intervalMonths
      : null
  const inspectionIntervalMonths =
    providedInspectionIntervalMonths ?? calculatedInspectionIntervalMonths

  const calculatedNextInspection = calculateNextInspectionDate(
    lastInspection,
    inspectionIntervalMonths
  )
  const nextInspection =
    providedNextInspection ?? (calculatedNextInspection ? formatDate(calculatedNextInspection) : null)

  return {
    row: rowNumber,
    name,
    equipmentId,
    location,
    propertyName,
    municipality,
    refrigerantType: refrigerantType ?? rawRefrigerantType,
    refrigerantAmount,
    lastInspection,
    nextInspection,
    inspectionIntervalMonths,
    hasLeakDetectionSystem,
    servicePartner,
    status,
    installationDate,
    serialNumber,
    equipmentType,
    operatorName,
    notes,
    errors,
    warnings,
  }
}

export function isEmptyImportRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => !hasValue(value))
}

export function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function getSuggestedImportField(header: string): ImportFieldKey | null {
  const normalizedHeader = normalizeHeader(header)

  return (
    IMPORT_FIELD_DEFINITIONS.find((field) =>
      field.aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)
    )?.key ?? null
  )
}

export function getImportFieldLabel(key: ImportFieldKey) {
  return IMPORT_FIELD_DEFINITIONS.find((field) => field.key === key)?.label ?? key
}

export function getDetectedEventHistoryColumns(headers: string[]) {
  const normalizedEventAliases = new Set(
    EVENT_HISTORY_COLUMN_ALIASES.map((alias) => normalizeHeader(alias))
  )

  return headers.filter((header) =>
    normalizedEventAliases.has(normalizeHeader(header))
  )
}

export function mapImportRowHeaders(row: Record<string, unknown>) {
  const mappedRow: Record<string, unknown> = {}

  Object.entries(row).forEach(([header, value]) => {
    const key = getSuggestedImportField(header)
    if (key) mappedRow[key] = value
  })

  return mappedRow
}

export function mapImportRowsWithMapping(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
) {
  return rows.map((row) => {
    const mappedRow: Record<string, unknown> = {}

    Object.entries(mapping).forEach(([header, key]) => {
      if (key) mappedRow[key] = row[header]
    })

    return mappedRow
  })
}

export function getDuplicateMappedFields(mapping: ColumnMapping) {
  const mappedFields = Object.values(mapping).filter(Boolean) as ImportFieldKey[]

  return Array.from(
    new Set(
      mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index)
    )
  )
}

export function isImportFieldSelectedByAnotherColumn(
  mapping: ColumnMapping,
  field: ImportFieldKey,
  currentColumn: string
) {
  return Object.entries(mapping).some(
    ([column, mappedField]) => column !== currentColumn && mappedField === field
  )
}

export function getMaxImportRows() {
  return MAX_IMPORT_ROWS
}

export function normalizeImportMatchValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

export function findImportPropertyMatch(
  propertyName: string | null | undefined,
  properties: ImportPropertyReference[]
) {
  const normalizedPropertyName = normalizeImportMatchValue(propertyName)
  if (!normalizedPropertyName) return null

  return (
    properties.find(
      (property) => normalizeImportMatchValue(property.name) === normalizedPropertyName
    ) ?? null
  )
}

export function getImportPropertyMatchWarning(
  propertyName: string | null | undefined,
  properties: ImportPropertyReference[]
) {
  return propertyName && !findImportPropertyMatch(propertyName, properties)
    ? UNMATCHED_PROPERTY_WARNING
    : null
}

export function isDuplicateEquipmentIdentity({
  equipmentId,
  propertyId,
  propertyName,
  existingInstallations,
}: {
  equipmentId: string | null
  propertyId: string | null
  propertyName: string | null
  existingInstallations: ExistingEquipmentIdentity[]
}) {
  const normalizedEquipmentId = normalizeImportMatchValue(equipmentId)
  if (!normalizedEquipmentId) return false

  const normalizedPropertyName = normalizeImportMatchValue(propertyName)

  // Keep equipment identity property-scoped so future event imports can match
  // recurring IDs like "VP1" by Aggregat-ID plus property context.
  return existingInstallations.some((installation) => {
    if (normalizeImportMatchValue(installation.equipmentId) !== normalizedEquipmentId) {
      return false
    }

    if (propertyId) return installation.propertyId === propertyId

    if (normalizedPropertyName) {
      return (
        !installation.propertyId &&
        normalizeImportMatchValue(installation.propertyName) === normalizedPropertyName
      )
    }

    return !installation.propertyId
  })
}

function getValue(row: Record<string, unknown>, key: ImportFieldKey) {
  return row[key]
}

function getString(row: Record<string, unknown>, key: ImportFieldKey) {
  return String(getValue(row, key) ?? "").trim()
}

function getOptionalString(row: Record<string, unknown>, key: ImportFieldKey) {
  const value = getString(row, key)
  return value ? value : null
}

function parseNumber(value: unknown) {
  if (!hasValue(value)) return null
  if (typeof value === "number") return value

  const parsed = Number(String(value).replace(",", ".").trim())
  return Number.isNaN(parsed) ? null : parsed
}

function parseInteger(value: unknown) {
  const parsed = parseNumber(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function parseBoolean(value: unknown) {
  if (!hasValue(value)) return false
  if (typeof value === "boolean") return value

  const normalizedValue = String(value).trim().toLowerCase()
  return ["1", "ja", "j", "yes", "y", "true", "x"].includes(normalizedValue)
}

function parseDateValue(value: unknown) {
  if (!hasValue(value)) return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value)
  }

  if (typeof value === "number") {
    const date = excelSerialDateToDate(value)
    return formatDate(date)
  }

  const text = String(value).trim()
  const parsed = new Date(text)

  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed)
  }

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

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== ""
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
