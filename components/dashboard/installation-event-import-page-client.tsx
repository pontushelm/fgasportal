"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  EVENT_IMPORT_FIELD_DEFINITIONS,
  getDuplicateEventImportMappedFields,
  getEventImportFieldLabel,
  getMaxEventImportRows,
  getMissingRequiredEventImportFields,
  getSuggestedEventImportField,
  isEmptyEventImportRow,
  isEventImportFieldSelectedByAnotherColumn,
  mapEventImportRowsWithMapping,
  type EventImportColumnMapping,
  type EventImportFieldKey,
  type EventImportPreviewRow,
} from "@/lib/installation-event-import"

type WorksheetPreview = {
  name: string
  rows: Record<string, unknown>[]
}

type PreviewResponse = {
  rows: EventImportPreviewRow[]
  summary: {
    total: number
    importable: number
    warnings: number
    blocked: number
  }
}

type ImportSummary = {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

const TEMPLATE_COLUMNS = [
  "Aggregat-ID",
  "Fastighet",
  "Händelsetyp",
  "Händelsedatum",
  "Mängd",
  "Kommentar",
]

const TEMPLATE_ROWS = [
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Kontroll",
    Händelsedatum: "2026-01-15",
    Mängd: "",
    Kommentar: "Importerad historisk kontroll",
  },
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Påfyllning",
    Händelsedatum: "2026-02-01",
    Mängd: 2.5,
    Kommentar: "Påfyllning efter service",
  },
]

export default function InstallationEventImportPageClient() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<EventImportColumnMapping>({})
  const [previewRows, setPreviewRows] = useState<EventImportPreviewRow[]>([])
  const [previewSummary, setPreviewSummary] = useState<PreviewResponse["summary"] | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const mappedFields = useMemo(
    () => Object.values(columnMapping).filter(Boolean) as EventImportFieldKey[],
    [columnMapping]
  )
  const missingRequiredFields = getMissingRequiredEventImportFields(mappedFields)
  const duplicatedFields = useMemo(
    () => getDuplicateEventImportMappedFields(columnMapping),
    [columnMapping]
  )
  const hasBlockingMappingIssue =
    missingRequiredFields.length > 0 || duplicatedFields.length > 0
  const importableRows = previewRows.filter((row) => row.status !== "blocked")
  const warningRows = previewRows.filter((row) => row.status === "warning")
  const blockedRows = previewRows.filter((row) => row.status === "blocked")

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFile(file ?? null)
    resetPreviewState()
  }

  async function handleReadFile() {
    if (!selectedFile) return

    setError("")
    setIsParsing(true)
    setImportSummary(null)

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
      applyWorksheetRows(firstWorksheet?.rows ?? [])
    } catch (err) {
      console.error("Parse event import file error:", err)
      resetPreviewState()
      setError("Kunde inte läsa filen. Kontrollera att den är en giltig .xlsx eller .csv.")
    } finally {
      setIsParsing(false)
    }
  }

  function handleWorksheetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const worksheetName = event.target.value
    const worksheet = worksheets.find((item) => item.name === worksheetName)

    setSelectedWorksheetName(worksheetName)
    applyWorksheetRows(worksheet?.rows ?? [])
  }

  function handleMappingChange(column: string, field: EventImportFieldKey | "") {
    setColumnMapping((current) => ({
      ...current,
      [column]: field,
    }))
    setPreviewRows([])
    setPreviewSummary(null)
    setImportSummary(null)
  }

  async function handlePreview() {
    await submitRows("preview")
  }

  async function handleImport() {
    await submitRows("import")
  }

  async function submitRows(mode: "preview" | "import") {
    setError("")
    setImportSummary(null)

    if (hasBlockingMappingIssue) {
      setError("Kontrollera kolumnkopplingen innan du fortsätter.")
      return
    }

    const rows = mapEventImportRowsWithMapping(rawRows, columnMapping)
      .filter((row) => !isEmptyEventImportRow(row))
      .slice(0, getMaxEventImportRows())

    if (mode === "preview") setIsPreviewing(true)
    if (mode === "import") setIsImporting(true)

    const response = await fetch("/api/installations/import-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ mode, rows }),
    })
    const result = await response.json()

    setIsPreviewing(false)
    setIsImporting(false)

    if (!response.ok) {
      const details = Array.isArray(result.details)
        ? result.details
            .map((detail: { path?: string; message?: string }) =>
              [detail.path, detail.message].filter(Boolean).join(": ")
            )
            .filter(Boolean)
            .join("; ")
        : ""
      setError(details ? `${result.error || "Importen misslyckades"}: ${details}` : result.error || "Importen misslyckades")
      return
    }

    if (mode === "preview") {
      setPreviewRows(result.rows)
      setPreviewSummary(result.summary)
      return
    }

    setImportSummary(result)
  }

  function handleDownloadTemplate() {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
      header: TEMPLATE_COLUMNS,
    })

    XLSX.utils.book_append_sheet(workbook, worksheet, "Händelser")
    XLSX.writeFile(workbook, "fgasportal-importmall-handelser.xlsx")
  }

  function applyWorksheetRows(worksheetRows: Record<string, unknown>[]) {
    const columns = getDetectedColumns(worksheetRows)
    const suggestedMapping = Object.fromEntries(
      columns.map((column) => [column, getSuggestedEventImportField(column) ?? ""])
    ) as EventImportColumnMapping

    setRawRows(worksheetRows)
    setDetectedColumns(columns)
    setColumnMapping(suggestedMapping)
    setPreviewRows([])
    setPreviewSummary(null)
    setImportSummary(null)
  }

  function resetPreviewState() {
    setWorksheets([])
    setSelectedWorksheetName("")
    setRawRows([])
    setDetectedColumns([])
    setColumnMapping({})
    setPreviewRows([])
    setPreviewSummary(null)
    setImportSummary(null)
    setError("")
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div>
        <Link
          className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          href="/dashboard/installations"
        >
          Tillbaka till aggregat
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Importera händelser
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Importera strukturerad historik för befintliga aggregat. Händelser
          kopplas med Aggregat-ID och vid behov fastighet.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <ul className="grid gap-1.5">
              <li>Endast kontroll, läckage, påfyllning och service stöds i Phase 1.</li>
              <li>Aggregat-ID / märkning är primär matchningsnyckel.</li>
              <li>Fastighet hjälper till att särskilja återkommande ID:n som VP1 eller Kyl 01.</li>
              <li>Importen skapar inte aggregat automatiskt.</li>
            </ul>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={handleDownloadTemplate}
          >
            Ladda ner mall
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            accept=".xlsx,.csv"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
            type="file"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              disabled={!selectedFile || isParsing}
              type="button"
              onClick={handleReadFile}
            >
              {isParsing ? "Läser fil..." : "Läs fil"}
            </button>
            {detectedColumns.length > 0 && (
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                disabled={isPreviewing || hasBlockingMappingIssue}
                type="button"
                onClick={handlePreview}
              >
                {isPreviewing ? "Förhandsgranskar..." : "Förhandsgranska"}
              </button>
            )}
          </div>
        </div>

        {worksheets.length > 0 && (
          <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
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
          </label>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      {detectedColumns.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Kolumnkoppling
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Koppla filens kolumner till händelsefält. Lämna irrelevanta
                kolumner utan koppling.
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
                              event.target.value as EventImportFieldKey | ""
                            )
                          }
                        >
                          <option value="">Importera inte</option>
                          {EVENT_IMPORT_FIELD_DEFINITIONS.map((field) => (
                            <option
                              disabled={isEventImportFieldSelectedByAnotherColumn(
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
                          <span className="font-medium text-emerald-700">OK</span>
                        ) : (
                          <span className="text-slate-500">Ej kopplad</span>
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
                  {missingRequiredFields.map(getEventImportFieldLabel).join(", ")}.
                </p>
              )}
              {duplicatedFields.length > 0 && (
                <p className="mt-1">
                  Samma FgasPortal-fält är valt flera gånger:{" "}
                  {[...new Set(duplicatedFields)].map(getEventImportFieldLabel).join(", ")}.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {previewRows.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <p>
                {previewSummary?.importable ?? importableRows.length} av{" "}
                {previewSummary?.total ?? previewRows.length} rader kan importeras.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {previewSummary?.warnings ?? warningRows.length} med varningar,{" "}
                {previewSummary?.blocked ?? blockedRows.length} blockerade.
              </p>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              disabled={importableRows.length === 0 || isImporting}
              type="button"
              onClick={handleImport}
            >
              {isImporting ? "Importerar..." : `Importera ${importableRows.length} händelser`}
            </button>
          </div>

          <div className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Rad</th>
                  <th className={tableHeaderClassName}>Aggregat-ID</th>
                  <th className={tableHeaderClassName}>Fastighet</th>
                  <th className={tableHeaderClassName}>Matchat aggregat</th>
                  <th className={tableHeaderClassName}>Typ</th>
                  <th className={tableHeaderClassName}>Datum</th>
                  <th className={tableHeaderClassName}>Mängd</th>
                  <th className={tableHeaderClassName}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {previewRows.map((row) => (
                  <tr key={row.row}>
                    <td className={tableCellClassName}>{row.row}</td>
                    <td className={tableCellClassName}>{row.equipmentId || "-"}</td>
                    <td className={tableCellClassName}>{row.propertyName || "-"}</td>
                    <td className={tableCellClassName}>{row.installationName || "-"}</td>
                    <td className={tableCellClassName}>{formatEventType(row.normalizedType)}</td>
                    <td className={tableCellClassName}>{row.eventDate || "-"}</td>
                    <td className={tableCellClassName}>{row.amountKg ?? "-"}</td>
                    <td
                      className={`${tableCellClassName} font-semibold ${
                        row.status === "blocked"
                          ? "text-red-700"
                          : row.status === "warning"
                            ? "text-amber-700"
                            : "text-emerald-700"
                      }`}
                    >
                      {row.status === "blocked"
                        ? row.errors.join(", ")
                        : row.status === "warning"
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

      {importSummary && (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h2 className="font-semibold">Import klar</h2>
          <p className="mt-2">Skapade händelser: {importSummary.created}</p>
          <p>Hoppade över: {importSummary.skipped}</p>
          {importSummary.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {importSummary.errors.map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Rad {item.row}: {item.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  )
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

function formatEventType(type: EventImportPreviewRow["normalizedType"]) {
  if (type === "INSPECTION") return "Kontroll"
  if (type === "LEAK") return "Läckage"
  if (type === "REFILL") return "Påfyllning"
  if (type === "SERVICE") return "Service"
  return "-"
}

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
