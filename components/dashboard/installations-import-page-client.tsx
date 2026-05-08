"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  IMPORT_FIELD_DEFINITIONS,
  getDuplicateMappedFields,
  getImportFieldLabel,
  getMissingRequiredImportFields,
  getMaxImportRows,
  getSuggestedImportField,
  isImportFieldSelectedByAnotherColumn,
  isEmptyImportRow,
  mapImportRowsWithMapping,
  parseImportRows,
  type ColumnMapping,
  type ImportFieldKey,
  type ParsedImportRow,
} from "@/lib/installation-import"

type ImportSummary = {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

type ImportInstallationsPageProps = {
  embedded?: boolean
  onClose?: () => void
  onImported?: () => void
}

type WorksheetPreview = {
  name: string
  rows: Record<string, unknown>[]
}

const TEMPLATE_COLUMNS = [
  "Aggregat-ID / märkning",
  "Aggregatnamn / benämning",
  "Plats",
  "Fastighet",
  "Kommun",
  "Köldmedium",
  "Fyllnadsmängd",
  "Läckagevarningssystem",
  "Senaste kontroll",
  "Nästa kontroll",
  "Kontrollintervall",
  "Servicepartner",
  "Driftsättningsdatum",
  "Serienummer",
  "Utrustningstyp",
  "Operatör",
]

const TEMPLATE_ROWS = [
  {
    "Aggregat-ID / märkning": "AGG-001",
    "Aggregatnamn / benämning": "Kylaggregat 1",
    Plats: "Tak plan 3",
    Fastighet: "Stadshuset",
    Kommun: "Stockholm",
    Köldmedium: "R410A",
    Fyllnadsmängd: 12.5,
    Läckagevarningssystem: "Nej",
    "Senaste kontroll": "2026-01-15",
    "Nästa kontroll": "2027-01-15",
    Kontrollintervall: 12,
    Servicepartner: "Exempel Kyl AB",
    Driftsättningsdatum: "2021-05-01",
    Serienummer: "SN-12345",
    Utrustningstyp: "Kylaggregat",
    Operatör: "Fastighetsavdelningen",
  },
  {
    "Aggregat-ID / märkning": "AGG-002",
    "Aggregatnamn / benämning": "Frysrum",
    Plats: "Källare",
    Fastighet: "Servicehuset",
    Kommun: "Stockholm",
    Köldmedium: "R404A",
    Fyllnadsmängd: 8,
    Läckagevarningssystem: "Ja",
    "Senaste kontroll": "2026-02-20",
    "Nästa kontroll": "",
    Kontrollintervall: "",
    Servicepartner: "",
    Driftsättningsdatum: "2020-09-10",
    Serienummer: "SN-67890",
    Utrustningstyp: "Frys",
    Operatör: "Måltidsservice",
  },
]

export default function ImportInstallationsPage({
  embedded = false,
  onClose,
  onImported,
}: ImportInstallationsPageProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const validRows = rows.filter((row) => row.errors.length === 0)
  const warningRows = validRows.filter((row) => row.warnings.length > 0)
  const invalidRows = rows.filter((row) => row.errors.length > 0)
  const mappedFields = useMemo(
    () => Object.values(columnMapping).filter(Boolean) as ImportFieldKey[],
    [columnMapping]
  )
  const missingRequiredFields = getMissingRequiredImportFields(mappedFields)
  const duplicatedFields = useMemo(
    () => getDuplicateMappedFields(columnMapping),
    [columnMapping]
  )
  const hasBlockingMappingIssue =
    missingRequiredFields.length > 0 || duplicatedFields.length > 0

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
      console.error("Parse import file error:", err)
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

  function handleMappingChange(column: string, field: ImportFieldKey | "") {
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Aggregat")
    XLSX.writeFile(workbook, "fgasportal-importmall-aggregat.xlsx")
  }

  async function handleImport() {
    setError("")
    setSummary(null)
    setIsImporting(true)

    const res = await fetch("/api/installations/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        rows: validRows,
      }),
    })
    const result = await res.json()

    setIsImporting(false)

    if (!res.ok) {
      setError(result.error || "Importen misslyckades")
      return
    }

    setSummary(result)
    onImported?.()
  }

  const content = (
    <>
      <div>
        {!embedded && (
          <Link
            className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
            href="/dashboard/installations"
          >
            Tillbaka till aggregat
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Importera aggregat
        </h1>
        <p className="mt-2 text-sm text-slate-700">
          Ladda upp en .xlsx- eller .csv-fil, mappa kolumnerna och importera de
          rader som har nödvändiga uppgifter. Aggregat-ID / märkning är den
          viktigaste identiteten för register och framtida händelsematchning.
          Rader med varningar kan importeras och kompletteras senare.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              Obligatoriska fält är Aggregat-ID / märkning, Köldmedium och
              Fyllnadsmängd. Aggregatnamn / benämning är valfritt; om det
              saknas används Aggregat-ID som visningsnamn.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              GWP och CO₂e beräknas automatiskt från köldmedium och
              fyllnadsmängd. Importera normalt inte separata GWP- eller
              CO₂e-kolumner.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Har du ett äldre eller komplext register? FgasPortal kan hjälpa
              till med import och datarensning vid onboarding.
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={handleDownloadTemplate}
          >
            Ladda ner importmall
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <input
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
              onClick={handlePreviewFile}
              disabled={!selectedFile || isParsing}
            >
              {isParsing ? "Förhandsgranskar..." : "Förhandsgranska fil"}
            </button>
            {onClose && (
              <button
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={onClose}
              >
                Stäng
              </button>
            )}
          </div>
        </div>
        {worksheets.length > 0 && (
          <div className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
            Arbetsblad
            <select
              className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              value={selectedWorksheetName}
              onChange={handleWorksheetChange}
            >
              {worksheets.map((worksheet) => (
                <option key={worksheet.name} value={worksheet.name}>
                  {worksheet.name}
                </option>
              ))}
            </select>
            <p className="text-xs font-normal text-slate-500">
              När du byter arbetsblad byggs kolumner, föreslagna mappningar och
              förhandsgranskning om från det valda bladet.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      {detectedColumns.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Kolumnmappning
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                FgasPortal föreslår matchningar baserat på kolumnnamn. Ändra vid
                behov eller lämna kolumner omappade.
              </p>
            </div>
            <div className="text-sm text-slate-600">
              {detectedColumns.length} kolumner hittades
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Filkolumn</th>
                  <th className={tableHeaderClassName}>FgasPortal-fält</th>
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
                          value={mappedField ?? ""}
                          onChange={(event) =>
                            handleMappingChange(
                              column,
                              event.target.value as ImportFieldKey | ""
                            )
                          }
                        >
                          <option value="">Importera inte</option>
                          {IMPORT_FIELD_DEFINITIONS.map((field) => (
                            <option
                              key={field.key}
                              value={field.key}
                              disabled={isImportFieldSelectedByAnotherColumn(
                                columnMapping,
                                field.key,
                                column
                              )}
                            >
                              {field.label}
                              {field.required ? " (krävs)" : ""}
                              {isImportFieldSelectedByAnotherColumn(
                                columnMapping,
                                field.key,
                                column
                              )
                                ? " - redan vald"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={tableCellClassName}>
                        {mappedField ? (
                          <span className="font-medium text-emerald-700">
                            Mappad till {getImportFieldLabel(mappedField)}
                          </span>
                        ) : (
                          <span className="text-slate-500">Omappad</span>
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
                  Saknar obligatorisk mappning:{" "}
                  {missingRequiredFields.map(getImportFieldLabel).join(", ")}.
                </p>
              )}
              {duplicatedFields.length > 0 && (
                <p className="mt-1">
                  Samma FgasPortal-fält är valt flera gånger:{" "}
                  {[...new Set(duplicatedFields)].map(getImportFieldLabel).join(", ")}.
                  Välj ett unikt fält per kolumn eller lämna extra kolumner
                  omappade.
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
                {warningRows.length} med varningar, {invalidRows.length} med
                blockerande fel.
              </p>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
              onClick={handleImport}
              disabled={
                validRows.length === 0 || isImporting || hasBlockingMappingIssue
              }
            >
              {isImporting ? "Importerar..." : `Importera ${validRows.length} rader`}
            </button>
          </div>

          {(warningRows.length > 0 || invalidRows.length > 0) && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {warningRows.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <h2 className="font-semibold">Varningar</h2>
                  <p className="mt-1">
                    Dessa rader kan importeras men bör kompletteras senare.
                  </p>
                </div>
              )}
              {invalidRows.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <h2 className="font-semibold">Blockerande fel</h2>
                  <p className="mt-1">
                    Dessa rader importeras inte förrän felen är åtgärdade.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {invalidRows.slice(0, 5).map((row) => (
                      <li key={`invalid-${row.row}`}>
                        Rad {row.row}: {row.errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Rad</th>
                  <th className={tableHeaderClassName}>Aggregat-ID / märkning</th>
                  <th className={tableHeaderClassName}>Aggregatnamn / benämning</th>
                  <th className={tableHeaderClassName}>Plats</th>
                  <th className={tableHeaderClassName}>Fastighet</th>
                  <th className={tableHeaderClassName}>Köldmedium</th>
                  <th className={tableHeaderClassName}>Mängd</th>
                  <th className={tableHeaderClassName}>Senaste kontroll</th>
                  <th className={tableHeaderClassName}>Intervall</th>
                  <th className={tableHeaderClassName}>Nästa kontroll</th>
                  <th className={tableHeaderClassName}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td className={tableCellClassName}>{row.row}</td>
                    <td className={tableCellClassName}>{row.equipmentId || "-"}</td>
                    <td className={tableCellClassName}>{row.name || "-"}</td>
                    <td className={tableCellClassName}>{row.location || "-"}</td>
                    <td className={tableCellClassName}>{row.propertyName || "-"}</td>
                    <td className={tableCellClassName}>{row.refrigerantType || "-"}</td>
                    <td className={tableCellClassName}>{row.refrigerantAmount ?? "-"}</td>
                    <td className={tableCellClassName}>{row.lastInspection || "-"}</td>
                    <td className={tableCellClassName}>
                      {row.inspectionIntervalMonths
                        ? `${row.inspectionIntervalMonths} mån`
                        : "-"}
                    </td>
                    <td className={tableCellClassName}>{row.nextInspection || "-"}</td>
                    <td
                      className={`${tableCellClassName} font-semibold ${
                        row.errors.length > 0
                          ? "text-red-700"
                          : row.warnings.length > 0
                            ? "text-amber-700"
                            : "text-emerald-700"
                      }`}
                    >
                      {row.errors.length > 0
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
          <p className="mt-2">Skapade: {summary.created}</p>
          <p>Hoppade över: {summary.skipped}</p>
          {summary.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {summary.errors.map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Rad {item.row}: {item.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )

  if (embedded) return content

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      {content}
    </main>
  )
}

function createSuggestedMapping(columns: string[]): ColumnMapping {
  return Object.fromEntries(
    columns.map((column) => [column, getSuggestedImportField(column) ?? ""])
  )
}

function applyWorksheetPreviewRows(rows: Record<string, unknown>[]) {
  const columns = getDetectedColumns(rows)
  const suggestedMapping = createSuggestedMapping(columns)

  return {
    columns,
    suggestedMapping,
    parsedRows: buildPreviewRows(rows, suggestedMapping),
  }
}

function buildPreviewRows(rows: Record<string, unknown>[], mapping: ColumnMapping) {
  const mappedRows = mapImportRowsWithMapping(rows, mapping)
    .filter((row) => !isEmptyImportRow(row))
    .slice(0, getMaxImportRows())

  return parseImportRows(mappedRows)
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

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
