"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { ImportCompletionSummary } from "@/components/dashboard/import-completion-summary"
import { Toast, type ToastMessage } from "@/components/ui"
import {
  EVENT_IMPORT_FIELD_DEFINITIONS,
  filterEventImportPreviewRows,
  getDuplicateEventImportMappedFields,
  getEventImportFieldLabel,
  getMaxEventImportRows,
  getMissingRequiredEventImportFields,
  getSuggestedEventImportField,
  isEmptyEventImportRow,
  mapEventImportRowsWithMapping,
  type EventImportColumnMapping,
  type EventImportFieldKey,
  type EventImportPreviewFilter,
  type EventImportPreviewRow,
} from "@/lib/installation-event-import"

type WorksheetPreview = {
  name: string
}

type PreviewResponse = {
  rows: EventImportPreviewRow[]
  summary: {
    total: number
    importable: number
    warnings: number
    blocked: number
    exactDate: number
    yearOnlyDate: number
    missingDateOrYear: number
  }
}

type ImportSummary = {
  created: number
  skipped: number
  createdWithExactDate?: number
  createdWithYearOnlyDate?: number
  errors: Array<{ row: number; message: string }>
}

type InstallationEventImportPageClientProps = {
  embedded?: boolean
  onClose?: () => void
  onImportStateChange?: (state: ImportWorkspaceState) => void
  onImported?: () => void
}

type ImportWorkspaceState = {
  hasProgress: boolean
  isBusy: boolean
  message?: string
}

const TEMPLATE_COLUMNS = [
  "Aggregat-ID",
  "Fastighet",
  "Händelsetyp",
  "Händelsedatum",
  "Händelseår",
  "Mängd",
  "Tidigare köldmedium",
  "Nytt köldmedium",
  "Omhändertagen mängd",
  "Kommentar",
]

const TEMPLATE_ROWS = [
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Kontroll",
    Händelsedatum: "2026-01-15",
    Händelseår: "",
    Mängd: "",
    Kommentar: "Importerad historisk kontroll",
  },
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Läckage",
    Händelsedatum: "",
    Händelseår: 2025,
    Mängd: 1.2,
    "Tidigare köldmedium": "",
    "Nytt köldmedium": "",
    "Omhändertagen mängd": "",
    Kommentar: "Exakt datum saknades i källfilen",
  },
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Påfyllning",
    Händelsedatum: "2026-02-01",
    Händelseår: "",
    Mängd: 2.5,
    "Tidigare köldmedium": "",
    "Nytt köldmedium": "",
    "Omhändertagen mängd": "",
    Kommentar: "Påfyllning efter service",
  },
  {
    "Aggregat-ID": "AGG-001",
    Fastighet: "Stadshuset",
    Händelsetyp: "Byte av köldmedium",
    Händelsedatum: "2026-03-01",
    Händelseår: "",
    Mängd: 10,
    "Tidigare köldmedium": "R404A",
    "Nytt köldmedium": "R449A",
    "Omhändertagen mängd": 9.5,
    Kommentar: "Historiskt köldmediebyte",
  },
]
const TEMPLATE_REQUIRED_COLUMNS = ["Aggregat-ID", "Händelsetyp", "Händelsedatum eller Händelseår"]
const TEMPLATE_RECOMMENDED_COLUMNS = ["Fastighet", "Mängd", "Kommentar"]
const TEMPLATE_COLUMN_WIDTHS: Record<string, number> = {
  "Aggregat-ID": 18,
  Fastighet: 24,
  Händelsetyp: 24,
  Händelsedatum: 18,
  Händelseår: 14,
  Mängd: 14,
  "Tidigare köldmedium": 22,
  "Nytt köldmedium": 20,
  "Omhändertagen mängd": 24,
  Kommentar: 38,
}

const PREVIEW_ROW_LIMIT = 50
const EVENT_REQUIRED_FIELD_KEYS: EventImportFieldKey[] = [
  "equipmentId",
  "eventType",
  "eventDate",
  "eventYear",
]
const EVENT_RECOMMENDED_FIELD_KEYS: EventImportFieldKey[] = [
  "amountKg",
  "notes",
]
const EVENT_ADVANCED_FIELD_KEYS: EventImportFieldKey[] =
  EVENT_IMPORT_FIELD_DEFINITIONS.map((field) => field.key).filter(
    (key) =>
      !EVENT_REQUIRED_FIELD_KEYS.includes(key) &&
      !EVENT_RECOMMENDED_FIELD_KEYS.includes(key)
  )

export default function InstallationEventImportPageClient({
  embedded = false,
  onClose,
  onImportStateChange,
  onImported,
}: InstallationEventImportPageClientProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<EventImportColumnMapping>({})
  const [previewRows, setPreviewRows] = useState<EventImportPreviewRow[]>([])
  const [previewFilter, setPreviewFilter] = useState<EventImportPreviewFilter>("all")
  const [previewSummary, setPreviewSummary] = useState<PreviewResponse["summary"] | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [error, setError] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [showIgnoredColumns, setShowIgnoredColumns] = useState(false)
  const workbookDataRef = useRef<ArrayBuffer | null>(null)
  const templateDownloadInProgressRef = useRef(false)
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
  const importableRows = useMemo(
    () => previewRows.filter((row) => row.status !== "blocked"),
    [previewRows]
  )
  const warningRows = useMemo(
    () => previewRows.filter((row) => row.status === "warning"),
    [previewRows]
  )
  const blockedRows = useMemo(
    () => previewRows.filter((row) => row.status === "blocked"),
    [previewRows]
  )
  const filteredPreviewRows = useMemo(
    () => filterEventImportPreviewRows(previewRows, previewFilter),
    [previewRows, previewFilter]
  )
  const visiblePreviewRows = useMemo(
    () => filteredPreviewRows.slice(0, PREVIEW_ROW_LIMIT),
    [filteredPreviewRows]
  )
  const ignoredColumns = useMemo(
    () => detectedColumns.filter((column) => !columnMapping[column]),
    [columnMapping, detectedColumns]
  )
  const mappedAdvancedFieldCount = EVENT_ADVANCED_FIELD_KEYS.filter((field) =>
    mappedFields.includes(field)
  ).length
  const hasImportProgress =
    Boolean(selectedFile) ||
    worksheets.length > 0 ||
    detectedColumns.length > 0 ||
    previewRows.length > 0 ||
    Boolean(importSummary)
  const isImportBusy = isParsing || isPreviewing || isImporting

  useEffect(() => {
    onImportStateChange?.({
      hasProgress: hasImportProgress,
      isBusy: isImportBusy,
      message:
        isParsing || isPreviewing
          ? "Filen läses in. Vänta tills förhandsgranskningen är klar."
          : isImporting
            ? "Importen pågår. Vänta tills den är klar."
            : undefined,
    })
  }, [
    hasImportProgress,
    isImportBusy,
    isImporting,
    isParsing,
    isPreviewing,
    onImportStateChange,
  ])

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
      await yieldToBrowser()
      startImportTimer("event-import:file-read")
      const data = await selectedFile.arrayBuffer()
      endImportTimer("event-import:file-read")
      workbookDataRef.current = data

      startImportTimer("event-import:workbook-sheets")
      const workbookInfo = XLSX.read(data, {
        type: "array",
        bookSheets: true,
      })
      endImportTimer("event-import:workbook-sheets")
      const parsedWorksheets = workbookInfo.SheetNames.map((name) => ({ name }))
      const firstWorksheet = parsedWorksheets[0]
      const firstWorksheetRows = await readSelectedWorksheetRows(firstWorksheet?.name ?? "")
      const firstWorksheetState = buildWorksheetState(firstWorksheetRows)

      setWorksheets(parsedWorksheets)
      setSelectedWorksheetName(firstWorksheet?.name ?? "")
      applyWorksheetRows(firstWorksheetRows, firstWorksheetState)
      await submitRows("preview", firstWorksheetRows, firstWorksheetState.mapping)
    } catch (err) {
      console.error("Parse event import file error:", err)
      resetPreviewState()
      setError("Kunde inte läsa filen. Kontrollera att den är en giltig .xlsx eller .csv.")
    } finally {
      setIsParsing(false)
    }
  }

  async function handleWorksheetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const worksheetName = event.target.value

    setSelectedWorksheetName(worksheetName)
    setError("")
    setIsParsing(true)

    try {
      const worksheetRows = await readSelectedWorksheetRows(worksheetName)
      const worksheetState = buildWorksheetState(worksheetRows)

      applyWorksheetRows(worksheetRows, worksheetState)
      await submitRows("preview", worksheetRows, worksheetState.mapping)
    } catch (err) {
      console.error("Parse event import worksheet error:", err)
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setPreviewRows([])
      setPreviewSummary(null)
      setError("Kunde inte läsa arbetsbladet. Kontrollera filens innehåll.")
    } finally {
      setIsParsing(false)
    }
  }

  function handleFieldMappingChange(field: EventImportFieldKey, column: string) {
    const nextMapping = { ...columnMapping }

    Object.keys(nextMapping).forEach((mappedColumn) => {
      if (nextMapping[mappedColumn] === field) nextMapping[mappedColumn] = ""
    })
    if (column) nextMapping[column] = field

    setColumnMapping(nextMapping)
    setPreviewRows([])
    setPreviewFilter("all")
    setPreviewSummary(null)
    setImportSummary(null)
    void submitRows("preview", rawRows, nextMapping)
  }

  async function readSelectedWorksheetRows(worksheetName: string) {
    if (!workbookDataRef.current || !worksheetName) return []

    await yieldToBrowser()
    startImportTimer("event-import:worksheet-parse")
    const workbook = XLSX.read(workbookDataRef.current, {
      type: "array",
      cellDates: true,
      sheetStubs: false,
      sheets: worksheetName,
    })
    endImportTimer("event-import:worksheet-parse")
    startImportTimer("event-import:rows-extraction")
    const rows = readWorksheetRows(workbook.Sheets[worksheetName])
    endImportTimer("event-import:rows-extraction")

    return rows
  }

  async function handleImport() {
    await submitRows("import")
  }

  async function submitRows(
    mode: "preview" | "import",
    sourceRows = rawRows,
    sourceMapping = columnMapping
  ) {
    setError("")
    setImportSummary(null)

    const sourceMappedFields = Object.values(sourceMapping).filter(
      Boolean
    ) as EventImportFieldKey[]
    const sourceMissingRequiredFields =
      getMissingRequiredEventImportFields(sourceMappedFields)
    const sourceDuplicatedFields =
      getDuplicateEventImportMappedFields(sourceMapping)

    if (sourceMissingRequiredFields.length > 0 || sourceDuplicatedFields.length > 0) {
      setError("Kontrollera de obligatoriska fälten och eventuella dubbla kopplingar innan du fortsätter.")
      return
    }

    const rows = mapEventImportRowsWithMapping(sourceRows, sourceMapping, {
      worksheetName: selectedWorksheetName,
    })
      .filter((row) => !isEmptyEventImportRow(row))
      .slice(0, getMaxEventImportRows())

    if (mode === "preview") setIsPreviewing(true)
    if (mode === "import") setIsImporting(true)

    startImportTimer(`event-import:${mode}-mapping-validation`)
    const response = await fetch("/api/installations/import-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ mode, rows }),
    })
    const result = await response.json()
    endImportTimer(`event-import:${mode}-mapping-validation`)

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
      if (mode === "import") {
        setToast({
          type: "error",
          title: "Fel",
          message: "Kunde inte importera händelser.",
        })
      }
      return
    }

    if (mode === "preview") {
      setPreviewRows(result.rows)
      setPreviewFilter(result.summary?.blocked > 0 ? "blocked" : "all")
      setPreviewSummary(result.summary)
      return
    }

    setImportSummary(result)
    setToast({
      type: result.skipped > 0 || result.errors?.length > 0 ? "warning" : "success",
      title: result.skipped > 0 || result.errors?.length > 0 ? "Import klar" : "Klart",
      message:
        result.skipped > 0 || result.errors?.length > 0
          ? `${result.created} händelser importerades. ${result.skipped} rader kunde inte importeras.`
          : `${result.created} händelser importerades.`,
    })
    onImported?.()
  }

  function handleDownloadTemplate() {
    if (templateDownloadInProgressRef.current) return

    templateDownloadInProgressRef.current = true
    setIsDownloadingTemplate(true)
    const workbook = XLSX.utils.book_new()
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["FgasPortal - importmall för händelser"],
      [""],
      ["Fyll i fliken Händelser och behåll rubrikraden överst."],
      ["Obligatoriska fält", TEMPLATE_REQUIRED_COLUMNS.join(", ")],
      ["Rekommenderade fält", TEMPLATE_RECOMMENDED_COLUMNS.join(", ")],
      [
        "Aggregat-ID",
        "Måste matcha ett befintligt aggregat i FgasPortal. Nya aggregat skapas inte i händelseimporten.",
      ],
      [
        "Händelsetyper",
        "Kontroll, Läckage, Påfyllning, Service, Reparation, Tömning/återvinning och Byte av köldmedium stöds.",
      ],
      [
        "Datum eller Händelseår",
        "Exakt datum är bäst. Om bara år finns används Händelseår och händelsen registreras på årets sista dag.",
      ],
      [
        "Historik",
        "Använd händelseimporten för äldre kontroller, läckage, påfyllningar, service och annan historik.",
      ],
    ])
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
      header: TEMPLATE_COLUMNS,
    })

    instructionSheet["!cols"] = [{ wch: 24 }, { wch: 118 }]
    worksheet["!cols"] = TEMPLATE_COLUMNS.map((column) => ({
      wch: TEMPLATE_COLUMN_WIDTHS[column] ?? 18,
    }))
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(TEMPLATE_ROWS.length, 1), c: TEMPLATE_COLUMNS.length - 1 },
      }),
    }
    ;(worksheet as XLSX.WorkSheet & { "!freeze"?: unknown })["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    }

    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Läs först")
    XLSX.utils.book_append_sheet(workbook, worksheet, "Händelser")
    XLSX.writeFile(workbook, "fgasportal-importmall-handelser.xlsx")
    window.setTimeout(() => {
      templateDownloadInProgressRef.current = false
      setIsDownloadingTemplate(false)
    }, 700)
  }

  function buildWorksheetState(worksheetRows: Record<string, unknown>[]) {
    const columns = getDetectedColumns(worksheetRows)
    const suggestedMapping = Object.fromEntries(
      columns.map((column) => [column, getSuggestedEventImportField(column) ?? ""])
    ) as EventImportColumnMapping

    return {
      columns,
      mapping: suggestedMapping,
    }
  }

  function applyWorksheetRows(
    worksheetRows: Record<string, unknown>[],
    worksheetState = buildWorksheetState(worksheetRows)
  ) {
    const { columns, mapping } = worksheetState

    setRawRows(worksheetRows)
    setDetectedColumns(columns)
    setColumnMapping(mapping)
    setPreviewRows([])
    setPreviewFilter("all")
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
    setPreviewFilter("all")
    setPreviewSummary(null)
    setImportSummary(null)
    setError("")
    workbookDataRef.current = null
  }

  function handleImportMore() {
    setSelectedFile(null)
    setFileInputKey((current) => current + 1)
    resetPreviewState()
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
          Importera händelser
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">
          Importera kontroller, läckage, service, påfyllningar och annan historik
          för befintliga aggregat.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <ul className="grid gap-1.5">
              <li>Inläsning av kontroll, läckage, påfyllning, service, reparation, tömning/återvinning och köldmediebyte stöds.</li>
              <li>Händelser kopplas till befintliga aggregat via aggregat-ID.</li>
              <li>Om exakt datum saknas kan du ange händelseår. Händelsen registreras då på årets sista dag och markeras som importerad utan exakt datum.</li>
              <li>Om samma aggregat-ID finns på flera platser kan fastighet användas för att hitta rätt aggregat.</li>
              <li>Aggregatet måste redan finnas i FgasPortal för att händelsen ska kunna kopplas. Nya aggregat skapas inte i den här importen.</li>
            </ul>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isDownloadingTemplate}
            onClick={handleDownloadTemplate}
          >
            {isDownloadingTemplate ? "Förbereder mall..." : "Ladda ner importmall"}
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input
            accept=".xlsx,.csv"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
            key={fileInputKey}
            type="file"
            onChange={handleFileChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              disabled={!selectedFile || isParsing || isPreviewing}
              type="button"
              onClick={handleReadFile}
            >
              {isParsing || isPreviewing ? "Läser in..." : "Läs in fil"}
            </button>
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
                Kontrollera fält
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                FgasPortal föreslår matchningar baserat på kolumnnamn. Kontrollera
                de viktigaste fälten först.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Du behöver inte koppla alla kolumner. Omappade kolumner ignoreras.
              </p>
            </div>
            <div className="text-sm text-slate-600">
              {detectedColumns.length} kolumner i filen
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <EventMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={EVENT_REQUIRED_FIELD_KEYS}
              onChange={handleFieldMappingChange}
              title="Obligatoriska fält"
            />
            <p className="-mt-2 px-1 text-xs text-slate-500">
              Datum är förstahandsval. Händelseår kan användas om exakt datum
              saknas.
            </p>
            <EventMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={EVENT_RECOMMENDED_FIELD_KEYS}
              onChange={handleFieldMappingChange}
              title="Rekommenderade fält"
            />
            <details
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
              open={showAdvancedFields || mappedAdvancedFieldCount > 0}
              onToggle={(event) => setShowAdvancedFields(event.currentTarget.open)}
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Avancerade fält
                {mappedAdvancedFieldCount > 0 ? ` (${mappedAdvancedFieldCount} kopplade)` : ""}
              </summary>
              <div className="mt-3">
                <EventMappingFieldGroup
                  columnMapping={columnMapping}
                  columns={detectedColumns}
                  fields={EVENT_ADVANCED_FIELD_KEYS}
                  onChange={handleFieldMappingChange}
                  title=""
                />
              </div>
            </details>
            {ignoredColumns.length > 0 && (
              <details
                className="rounded-lg border border-slate-200 bg-white p-3"
                open={showIgnoredColumns}
                onToggle={(event) => setShowIgnoredColumns(event.currentTarget.open)}
              >
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Ignorerade kolumner ({ignoredColumns.length})
                </summary>
                <p className="mt-2 text-xs text-slate-500">
                  Dessa kolumner importeras inte om de lämnas omappade.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ignoredColumns.map((column) => (
                    <span
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
                      key={column}
                    >
                      {column}
                    </span>
                  ))}
                </div>
              </details>
            )}
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
                  Samma fält i FgasPortal är valt flera gånger:{" "}
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
              {previewSummary && (
                <p className="mt-1 text-xs text-slate-500">
                  {previewSummary.exactDate} med exakt datum,{" "}
                  {previewSummary.yearOnlyDate} med endast händelseår,{" "}
                  {previewSummary.missingDateOrYear} saknar datum/år.
                </p>
              )}
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

          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <ImportMetric label="Rader hittade" value={previewSummary?.total ?? previewRows.length} />
            <ImportMetric label="Kan importeras" value={previewSummary?.importable ?? importableRows.length} />
            <ImportMetric label="Har varningar" value={previewSummary?.warnings ?? warningRows.length} />
            <ImportMetric label="Kommer hoppas över" value={previewSummary?.blocked ?? blockedRows.length} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PreviewFilterButton
              active={previewFilter === "all"}
              count={previewRows.length}
              label="Alla"
              onClick={() => setPreviewFilter("all")}
            />
            <PreviewFilterButton
              active={previewFilter === "importable"}
              count={importableRows.length}
              label="Importerbara"
              onClick={() => setPreviewFilter("importable")}
            />
            <PreviewFilterButton
              active={previewFilter === "warnings"}
              count={warningRows.length}
              label="Varningar"
              onClick={() => setPreviewFilter("warnings")}
            />
            <PreviewFilterButton
              active={previewFilter === "blocked"}
              count={blockedRows.length}
              label="Blockerade"
              onClick={() => setPreviewFilter("blocked")}
            />
            {blockedRows.length > 0 && previewFilter !== "blocked" && (
              <button
                className="ml-auto rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                type="button"
                onClick={() => setPreviewFilter("blocked")}
              >
                Visa blockerade rader
              </button>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Visar de första {Math.min(PREVIEW_ROW_LIMIT, filteredPreviewRows.length)} raderna
            i aktuell vy. Totalt hittades {previewRows.length} rader. Importen använder alla importerbara rader inom importgränsen.
          </p>

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
                {visiblePreviewRows.map((row) => (
                  <tr
                    className={
                      row.status === "blocked"
                        ? "bg-red-50/50"
                        : row.status === "warning"
                          ? "bg-amber-50/40"
                          : ""
                    }
                    key={row.row}
                  >
                    <td className={`${tableCellClassName} font-semibold`}>Excel-rad {row.row}</td>
                    <td className={tableCellClassName}>{row.equipmentId || "-"}</td>
                    <td className={tableCellClassName}>{row.propertyName || "-"}</td>
                    <td className={tableCellClassName}>{row.installationName || "-"}</td>
                    <td className={tableCellClassName}>{formatEventType(row.normalizedType)}</td>
                    <td className={tableCellClassName}>{row.eventDate || "-"}</td>
                    <td className={tableCellClassName}>{formatEventAmount(row)}</td>
                    <td
                      className={`${tableCellClassName} min-w-80 ${
                        row.status === "blocked"
                          ? "text-red-700"
                          : row.status === "warning"
                            ? "text-amber-700"
                            : "text-emerald-700"
                      }`}
                    >
                      <StatusMessages row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {importSummary && embedded && (
        <EventImportSuccessPanel
          importSummary={importSummary}
          warningCount={warningRows.length}
          onClose={onClose}
          onImportMore={handleImportMore}
        />
      )}

      {importSummary && !embedded && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl">
            <EventImportSuccessPanel
              importSummary={importSummary}
              onImportMore={handleImportMore}
              warningCount={warningRows.length}
            />
          </div>
        </div>
      )}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
    </>
  )

  if (embedded) return content

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      {content}
    </main>
  )
}

function EventImportSuccessPanel({
  importSummary,
  onClose,
  onImportMore,
  warningCount,
}: {
  importSummary: ImportSummary
  onClose?: () => void
  onImportMore: () => void
  warningCount: number
}) {
  return (
    <ImportCompletionSummary
      actions={[
        {
          label: "Importera fler händelser",
          onClick: onImportMore,
        },
        {
          href: "/dashboard/installations",
          label: "Visa aggregat",
          variant: "primary",
        },
        {
          href: "/dashboard/actions",
          label: "Granska åtgärder",
        },
        ...(onClose
          ? [
              {
                label: "Stäng import",
                onClick: onClose,
              },
            ]
          : []),
      ]}
      errors={importSummary.errors}
      importedCount={importSummary.created}
      kind="events"
      skippedCount={importSummary.skipped}
      subtitle={`${importSummary.createdWithExactDate ?? 0} med exakt datum, ${importSummary.createdWithYearOnlyDate ?? 0} med endast händelseår.`}
      validationIssueCount={importSummary.errors.length + warningCount}
    />
  )
}

function getDetectedColumns(rows: Record<string, unknown>[]) {
  return Object.keys(rows[0] ?? {})
}

function readWorksheetRows(worksheet: XLSX.WorkSheet | undefined) {
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
    range: getActualWorksheetRange(worksheet),
  })
}

function getActualWorksheetRange(worksheet: XLSX.WorkSheet) {
  const cellAddresses = Object.keys(worksheet).filter(
    (key) => key[0] !== "!" && worksheet[key]?.v !== undefined
  )
  if (cellAddresses.length === 0) return worksheet["!ref"]

  let minRow = Number.POSITIVE_INFINITY
  let maxRow = 0
  let minColumn = Number.POSITIVE_INFINITY
  let maxColumn = 0

  for (const address of cellAddresses) {
    const cell = XLSX.utils.decode_cell(address)
    minRow = Math.min(minRow, cell.r)
    maxRow = Math.max(maxRow, cell.r)
    minColumn = Math.min(minColumn, cell.c)
    maxColumn = Math.max(maxColumn, cell.c)
  }

  return XLSX.utils.encode_range({
    s: { r: minRow, c: minColumn },
    e: { r: maxRow, c: maxColumn },
  })
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

function startImportTimer(label: string) {
  if (process.env.NODE_ENV !== "production") console.time(label)
}

function endImportTimer(label: string) {
  if (process.env.NODE_ENV !== "production") console.timeEnd(label)
}

function formatEventType(type: EventImportPreviewRow["normalizedType"]) {
  if (type === "INSPECTION") return "Kontroll"
  if (type === "LEAK") return "Läckage"
  if (type === "REFILL") return "Påfyllning"
  if (type === "SERVICE") return "Service"
  if (type === "REPAIR") return "Reparation"
  if (type === "RECOVERY") return "Tömning / Återvinning"
  if (type === "REFRIGERANT_CHANGE") return "Byte av köldmedium"
  return "-"
}

function formatEventAmount(row: EventImportPreviewRow) {
  if (row.normalizedType === "RECOVERY") return row.recoveredKg ?? row.amountKg ?? "-"
  return row.amountKg ?? "-"
}

function EventMappingFieldGroup({
  columnMapping,
  columns,
  fields,
  onChange,
  title,
}: {
  columnMapping: EventImportColumnMapping
  columns: string[]
  fields: EventImportFieldKey[]
  onChange: (field: EventImportFieldKey, column: string) => void
  title: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {title && (
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
          {title}
        </div>
      )}
      <div className="divide-y divide-slate-200">
        {fields.map((field) => {
          const selectedColumn = getColumnForEventField(columnMapping, field)
          const label = getEventImportFieldLabel(field)

          return (
            <div className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)_5.5rem] md:items-center" key={field}>
              <div>
                <div className="text-sm font-medium text-slate-900">{label}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {selectedColumn ? `Kolumn: ${selectedColumn}` : "Ingen kolumn vald"}
                </div>
              </div>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                value={selectedColumn || "__unmapped__"}
                onChange={(event) =>
                  onChange(
                    field,
                    event.target.value === "__ignore__" ? "" : event.target.value
                  )
                }
              >
                <option disabled value="__unmapped__">
                  Välj kolumn
                </option>
                <option value="__ignore__">Importera inte</option>
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                    {columnMapping[column] && columnMapping[column] !== field
                      ? ` - används för ${getEventImportFieldLabel(columnMapping[column] as EventImportFieldKey)}`
                      : ""}
                  </option>
                ))}
              </select>
              <span
                className={`w-20 text-left text-xs font-semibold md:text-right ${
                  selectedColumn ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {selectedColumn ? "Kopplad" : "Saknas"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getColumnForEventField(
  mapping: EventImportColumnMapping,
  field: EventImportFieldKey
) {
  return Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0] ?? ""
}

function ImportMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-950">{value}</div>
    </div>
  )
}

function PreviewFilterButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-blue-600 bg-blue-50 text-blue-800"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      type="button"
      onClick={onClick}
    >
      {label} <span className="ml-1 text-xs opacity-75">{count}</span>
    </button>
  )
}

function StatusMessages({ row }: { row: EventImportPreviewRow }) {
  if (row.status === "valid") {
    return <span className="font-semibold">Giltig</span>
  }

  const messages = row.status === "blocked" ? row.errors : row.warnings

  return (
    <ul className="grid gap-1">
      {messages.map((message) => (
        <li className="flex gap-2" key={message}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
          <span>{message}</span>
        </li>
      ))}
    </ul>
  )
}

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
