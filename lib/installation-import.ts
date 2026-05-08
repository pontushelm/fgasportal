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

const MAX_IMPORT_ROWS = 500

export const IMPORT_FIELD_DEFINITIONS: ImportFieldDefinition[] = [
  {
    key: "name",
    label: "Namn",
    required: true,
    aliases: [
      "namn",
      "aggregat",
      "aggregatnamn",
      "benämning",
      "equipment",
      "unit name",
      "installation",
      "installation name",
    ],
  },
  {
    key: "equipmentId",
    label: "Utrustnings-ID / Aggregat-ID",
    aliases: [
      "aggregat-id",
      "aggregatid",
      "utrustnings-id",
      "utrustningsid",
      "id",
      "asset id",
      "equipment id",
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
  const name = getString(rawRow, "name")
  const equipmentId = getOptionalString(rawRow, "equipmentId")
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

  if (!name) errors.push("Saknar namn")
  if (!rawRefrigerantType) {
    errors.push("Saknar köldmedium")
  } else if (!refrigerantType) {
    warnings.push("Okänt GWP-värde - CO₂e och kontrollplikt kan kompletteras senare")
  }

  if (refrigerantAmount === null || Number.isNaN(refrigerantAmount) || refrigerantAmount <= 0) {
    errors.push("Ogiltig fyllnadsmängd")
  }

  if (!location) warnings.push("Saknar placering - kan kompletteras senare")
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
