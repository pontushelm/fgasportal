import {
  calculateCO2e,
  calculateInspectionObligation,
} from "@/lib/fgas-calculations"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"

export type ImportInstallationInput = {
  row: number
  name: string
  location: string
  propertyName: string | null
  refrigerantType: string
  refrigerantAmount: number | null
  lastInspection: string | null
  inspectionIntervalMonths: number | null
  serialNumber: string | null
  notes: string | null
}

export type ParsedImportRow = ImportInstallationInput & {
  nextInspection: string | null
  errors: string[]
  warnings: string[]
}

const MAX_IMPORT_ROWS = 500
const HEADER_ALIASES: Record<keyof Omit<ImportInstallationInput, "row">, string[]> = {
  name: ["name", "namn", "aggregat", "installation", "installation name"],
  location: ["location", "plats", "placering", "anläggning", "anlaggning"],
  propertyName: ["property", "fastighet", "fastighetsnamn", "property name"],
  refrigerantType: ["refrigerant", "köldmedium", "koldmedium", "medium"],
  refrigerantAmount: [
    "charge",
    "fyllnadsmängd",
    "fyllnadsmangd",
    "mängd",
    "mangd",
    "kg",
  ],
  lastInspection: [
    "last inspection",
    "senaste kontroll",
    "senast kontrollerad",
    "kontroll datum",
    "kontrolldatum",
  ],
  inspectionIntervalMonths: [
    "interval",
    "kontrollintervall",
    "inspection interval",
    "months",
    "månader",
    "manader",
  ],
  serialNumber: ["serial number", "serienummer"],
  notes: ["notes", "anteckningar"],
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
  const name = getString(rawRow, "name")
  const location = getString(rawRow, "location")
  const propertyName = getOptionalString(rawRow, "propertyName")
  const refrigerantType = getString(rawRow, "refrigerantType")
  const serialNumber = getOptionalString(rawRow, "serialNumber")
  const notes = getOptionalString(rawRow, "notes")
  const refrigerantAmount = parseNumber(getValue(rawRow, "refrigerantAmount"))
  const lastInspection = parseDateValue(getValue(rawRow, "lastInspection"))
  const inspectionIntervalMonths =
    refrigerantAmount !== null && !Number.isNaN(refrigerantAmount)
      ? calculateInspectionObligation(
          calculateCO2e(refrigerantType, refrigerantAmount).co2eTon,
          false
        ).intervalMonths
      : null

  if (!name) errors.push("Saknar namn")
  if (!refrigerantType) errors.push("Saknar köldmedium")
  if (refrigerantAmount === null || Number.isNaN(refrigerantAmount) || refrigerantAmount <= 0) {
    errors.push("Ogiltig fyllnadsmängd")
  }

  if (!location) warnings.push("Saknar placering – kan kompletteras senare")
  if (!propertyName) warnings.push("Saknar fastighet – kan kopplas senare")

  const rawLastInspection = getValue(rawRow, "lastInspection")
  if (hasValue(rawLastInspection) && !lastInspection) {
    errors.push("Ogiltigt datum")
  }

  const nextInspection = calculateNextInspectionDate(
    lastInspection,
    inspectionIntervalMonths
  )

  return {
    row: rowNumber,
    name,
    location,
    propertyName,
    refrigerantType,
    refrigerantAmount,
    lastInspection,
    inspectionIntervalMonths,
    serialNumber,
    notes,
    nextInspection: nextInspection ? formatDate(nextInspection) : null,
    errors,
    warnings,
  }
}

export function isEmptyImportRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => !hasValue(value))
}

export function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function mapImportRowHeaders(row: Record<string, unknown>) {
  const mappedRow: Record<string, unknown> = {}

  Object.entries(row).forEach(([header, value]) => {
    const key = findFieldKey(header)
    if (key) mappedRow[key] = value
  })

  return mappedRow
}

export function getMaxImportRows() {
  return MAX_IMPORT_ROWS
}

function findFieldKey(header: string) {
  const normalizedHeader = normalizeHeader(header)

  return Object.entries(HEADER_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)
  )?.[0]
}

function getValue(
  row: Record<string, unknown>,
  key: keyof Omit<ImportInstallationInput, "row">
) {
  return row[key]
}

function getString(
  row: Record<string, unknown>,
  key: keyof Omit<ImportInstallationInput, "row">
) {
  return String(getValue(row, key) ?? "").trim()
}

function getOptionalString(
  row: Record<string, unknown>,
  key: keyof Omit<ImportInstallationInput, "row">
) {
  const value = getString(row, key)
  return value ? value : null
}

function parseNumber(value: unknown) {
  if (!hasValue(value)) return null
  if (typeof value === "number") return value

  const parsed = Number(String(value).replace(",", ".").trim())
  return Number.isNaN(parsed) ? null : parsed
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
