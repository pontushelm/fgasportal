"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  PROPERTY_IMPORT_FIELD_DEFINITIONS,
  getDuplicatePropertyMappedFields,
  getMaxPropertyImportRows,
  getMissingRequiredPropertyImportFields,
  getPropertyImportFieldLabel,
  getSuggestedPropertyImportField,
  isEmptyPropertyImportRow,
  isPropertyFieldSelectedByAnotherColumn,
  mapPropertyRowsWithMapping,
  normalizePropertyDesignation,
  parsePropertyImportRows,
  type ParsedPropertyImportRow,
  type PropertyColumnMapping,
  type PropertyImportFieldKey,
} from "@/lib/property-import"

type ImportSummary = {
  created: number
  skippedDuplicates: number
  invalid: number
  errors: Array<{ row: number; message: string }>
}

type WorksheetPreview = {
  name: string
  rows: Record<string, unknown>[]
}

type PreviewPropertyRow = ParsedPropertyImportRow & {
  duplicateInFile: boolean
}

const TEMPLATE_COLUMNS = [
  "Fastighetsbeteckning",
  "Namn",
  "Kommun",
  "Ort",
  "Adress",
  "Postnummer",
  "Intern referens",
  "Kommentar",
]

const TEMPLATE_ROWS = [
  {
    Fastighetsbeteckning: "Åsen 1:23",
    Namn: "Förskolan Åsen",
    Kommun: "Stockholm",
    Ort: "Stockholm",
    Adress: "Skolgatan 1",
    Postnummer: "123 45",
    "Intern referens": "OBJ-1001",
    Kommentar: "",
  },
]

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"

export default function PropertiesImportPageClient() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<PropertyColumnMapping>({})
  const [rows, setRows] = useState<PreviewPropertyRow[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const mappedFields = useMemo(
    () => Object.values(columnMapping).filter(Boolean) as PropertyImportFieldKey[],
    [columnMapping]
  )
  const missingRequiredFields = getMissingRequiredPropertyImportFields(mappedFields)
  const duplicatedFields = useMemo(
    () => getDuplicatePropertyMappedFields(columnMapping),
    [columnMapping]
  )
  const hasBlockingMappingIssue =
    missingRequiredFields.length > 0 || duplicatedFields.length > 0
  const validRows = rows.filter(
    (row) => row.errors.length === 0 && !row.duplicateInFile
  )
  const invalidRows = rows.filter(
    (row) => row.errors.length > 0 || row.duplicateInFile
  )
  const warningRows = validRows.filter((row) => row.warnings.length > 0)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFile(file ?? null)
    setWorksheets([])
    setSelectedWorksheetName("")
    setRawRows([])
    setDetectedColumns([])
    setColumnMapping({})
    setRows([])
    setError("")
    setSummary(null)
  }

  async function handlePreviewFile() {
    if (!selectedFile) return

    setError("")
    setSummary(null)
    setIsParsing(true)

    try {
      const data = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: true,
      })
      const parsedWorksheets = workbook.SheetNames.map((name) => ({
        name,
        rows: readWorksheetRows(workbook.Sheets[name]),
      }))
      const firstWorksheet = parsedWorksheets[0]

      setWorksheets(parsedWorksheets)
      setSelectedWorksheetName(firstWorksheet?.name ?? "")
      applyWorksheetPreview(firstWorksheet?.rows ?? [])
    } catch (err) {
      console.error("Parse property import file error:", err)
      setWorksheets([])
      setSelectedWorksheetName("")
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setRows([])
      setError("Kunde inte läsa filen. Kontrollera att den är en giltig .xlsx eller .csv.")
    } finally {
      setIsParsing(false)
    }
  }

  function handleWorksheetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const worksheetName = event.target.value
    const worksheet = worksheets.find((item) => item.name === worksheetName)

    setSelectedWorksheetName(worksheetName)
    applyWorksheetPreview(worksheet?.rows ?? [])
  }

  function applyWorksheetPreview(worksheetRows: Record<string, unknown>[]) {
    const preview = applyWorksheetPreviewRows(worksheetRows)

    setRawRows(worksheetRows)
    setDetectedColumns(preview.columns)
    setColumnMapping(preview.suggestedMapping)
    setRows(preview.parsedRows)
  }

  function handleMappingChange(column: string, field: PropertyImportFieldKey | "") {
    const nextMapping = {
      ...columnMapping,
      [column]: field,
    }

    setColumnMapping(nextMapping)
    setRows(buildPreviewRows(rawRows, nextMapping))
  }

  function handleDownloadTemplate() {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
      header: TEMPLATE_COLUMNS,
    })

    XLSX.utils.book_append_sheet(workbook, worksheet, "Fastigheter")
    XLSX.writeFile(workbook, "fgasportal-importmall-fastigheter.xlsx")
  }

  async function handleImport() {
    setError("")
    setSummary(null)
    setIsImporting(true)

    const response = await fetch("/api/properties/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        rows: validRows,
      }),
    })
    const result = await response.json()

    setIsImporting(false)

    if (!response.ok) {
      setError(result.error || "Importen misslyckades")
      return
    }

    setSummary(result)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div>
        <Link
          className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          href="/dashboard/properties"
        >
          Tillbaka till fastigheter
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Importera fastigheter
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          Ladda upp Excel/CSV och koppla fastighetsuppgifter till registret.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <ul className="grid gap-1.5">
              <li>Fastighetsbeteckning krävs för årsrapporten.</li>
              <li>Kommun, ort och adress kan mappas om de finns i filen.</li>
              <li>Befintliga fastigheter med samma fastighetsbeteckning importeras inte igen.</li>
            </ul>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={handleDownloadTemplate}
            type="button"
          >
            Ladda ner importmall
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            accept=".xlsx,.csv"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
            onChange={handleFileChange}
            type="file"
          />
          <button
            className="w-fit rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            disabled={!selectedFile || isParsing}
            onClick={handlePreviewFile}
            type="button"
          >
            {isParsing ? "Läser in..." : "Läs in fil"}
          </button>
        </div>

        {worksheets.length > 0 && (
          <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
            Arbetsblad
            <select
              className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              onChange={handleWorksheetChange}
              value={selectedWorksheetName}
            >
              {worksheets.map((worksheet) => (
                <option key={worksheet.name} value={worksheet.name}>
                  {worksheet.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-slate-500">
              Välj vilket blad i filen som ska läsas in.
            </span>
          </label>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      {detectedColumns.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Koppla fält
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Matcha kolumnerna i filen mot fastighetsfält i FgasPortal.
              </p>
            </div>
            <div className="text-sm text-slate-600">
              {detectedColumns.length} kolumner i filen
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Kolumn i filen</th>
                  <th className={tableHeaderClassName}>Fält i FgasPortal</th>
                  <th className={tableHeaderClassName}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {detectedColumns.map((column) => {
                  const mappedField = columnMapping[column]

                  return (
                    <tr key={column}>
                      <td className={tableCellClassName}>{column}</td>
                      <td className={tableCellClassName}>
                        <select
                          className="w-full min-w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                          onChange={(event) =>
                            handleMappingChange(
                              column,
                              event.target.value as PropertyImportFieldKey | ""
                            )
                          }
                          value={mappedField ?? ""}
                        >
                          <option value="">Importera inte</option>
                          {PROPERTY_IMPORT_FIELD_DEFINITIONS.map((field) => (
                            <option
                              disabled={isPropertyFieldSelectedByAnotherColumn(
                                columnMapping,
                                field.key,
                                column
                              )}
                              key={field.key}
                              value={field.key}
                            >
                              {field.label}
                              {field.required ? " (krävs)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tableCellClassName}>
                        {mappedField ? (
                          <span className="font-medium text-emerald-700">
                            OK
                          </span>
                        ) : (
                          <span className="text-slate-500">Inte kopplad</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasBlockingMappingIssue && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {missingRequiredFields.length > 0 && (
                <p>
                  Saknar obligatorisk koppling:{" "}
                  {missingRequiredFields.map(getPropertyImportFieldLabel).join(", ")}.
                </p>
              )}
              {duplicatedFields.length > 0 && (
                <p className="mt-1">
                  Samma fält i FgasPortal är valt flera gånger:{" "}
                  {[...new Set(duplicatedFields)]
                    .map(getPropertyImportFieldLabel)
                    .join(", ")}
                  .
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                {validRows.length} av {rows.length} rader kan importeras.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {warningRows.length} med varningar, {invalidRows.length} hoppas över.
              </p>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              disabled={
                validRows.length === 0 || isImporting || hasBlockingMappingIssue
              }
              onClick={handleImport}
              type="button"
            >
              {isImporting ? "Importerar..." : `Importera ${validRows.length} fastigheter`}
            </button>
          </div>

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Rad</th>
                  <th className={tableHeaderClassName}>Fastighetsbeteckning</th>
                  <th className={tableHeaderClassName}>Namn</th>
                  <th className={tableHeaderClassName}>Kommun</th>
                  <th className={tableHeaderClassName}>Ort</th>
                  <th className={tableHeaderClassName}>Adress</th>
                  <th className={tableHeaderClassName}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td className={tableCellClassName}>{row.row}</td>
                    <td className={tableCellClassName}>{row.propertyDesignation || "-"}</td>
                    <td className={tableCellClassName}>{row.name || row.propertyDesignation || "-"}</td>
                    <td className={tableCellClassName}>{row.municipality || "-"}</td>
                    <td className={tableCellClassName}>{row.city || "-"}</td>
                    <td className={tableCellClassName}>{formatAddress(row)}</td>
                    <td
                      className={`${tableCellClassName} font-semibold ${
                        row.errors.length > 0 || row.duplicateInFile
                          ? "text-red-700"
                          : row.warnings.length > 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                      }`}
                    >
                      {row.duplicateInFile
                        ? "Dubblett i filen"
                        : row.errors.length > 0
                          ? row.errors.join(", ")
                          : row.warnings.length > 0
                            ? row.warnings.join(", ")
                            : "Giltig"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary && (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h2 className="font-semibold">Import klar</h2>
          <p className="mt-2">Importerade: {summary.created}</p>
          <p>Hoppade över dubbletter: {summary.skippedDuplicates}</p>
          <p>Ogiltiga rader: {summary.invalid}</p>
          {summary.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {summary.errors.map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Rad {item.row}: {item.message}
                </li>
              ))}
            </ul>
          )}
          <Link
            className="mt-3 inline-flex rounded-lg border border-emerald-300 bg-white px-3 py-2 font-semibold text-emerald-900 hover:bg-emerald-50"
            href="/dashboard/properties"
          >
            Till fastighetsöversikten
          </Link>
        </section>
      )}
    </main>
  )
}

function applyWorksheetPreviewRows(rows: Record<string, unknown>[]) {
  const columns = getDetectedColumns(rows)
  const suggestedMapping = Object.fromEntries(
    columns.map((column) => [column, getSuggestedPropertyImportField(column) ?? ""])
  ) as PropertyColumnMapping

  return {
    columns,
    suggestedMapping,
    parsedRows: buildPreviewRows(rows, suggestedMapping),
  }
}

function buildPreviewRows(
  rows: Record<string, unknown>[],
  mapping: PropertyColumnMapping
) {
  const mappedRows = mapPropertyRowsWithMapping(rows, mapping)
    .filter((row) => !isEmptyPropertyImportRow(row))
    .slice(0, getMaxPropertyImportRows())
  const parsedRows = parsePropertyImportRows(mappedRows)
  const seenDesignations = new Set<string>()

  return parsedRows.map((row) => {
    const normalizedDesignation = normalizePropertyDesignation(
      row.propertyDesignation
    )
    const duplicateInFile =
      Boolean(normalizedDesignation) && seenDesignations.has(normalizedDesignation)

    if (normalizedDesignation) {
      seenDesignations.add(normalizedDesignation)
    }

    return {
      ...row,
      duplicateInFile,
    }
  })
}

function getDetectedColumns(rows: Record<string, unknown>[]) {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
}

function readWorksheetRows(worksheet: XLSX.WorkSheet | undefined) {
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  })
}

function formatAddress(row: ParsedPropertyImportRow) {
  return [row.address, row.postalCode].filter(Boolean).join(", ") || "-"
}
