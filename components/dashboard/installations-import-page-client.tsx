"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { ImportCompletionSummary } from "@/components/dashboard/import-completion-summary"
import { Toast, type ToastMessage } from "@/components/ui"
import {
  EVENT_HISTORY_IMPORT_MESSAGE,
  IMPORT_FIELD_DEFINITIONS,
  getDuplicateMappedFields,
  getDetectedEventHistoryColumns,
  getImportFieldLabel,
  getMissingRequiredImportFields,
  getMaxImportRows,
  getSuggestedImportField,
  findImportPropertyMatch,
  getImportPropertyMatchWarning,
  isEmptyImportRow,
  mapImportRowsWithMapping,
  parseImportRows,
  type ColumnMapping,
  type ImportFieldKey,
  type ImportPropertyReference,
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
  onImportStateChange?: (state: ImportWorkspaceState) => void
}

type ImportWorkspaceState = {
  hasProgress: boolean
  isBusy: boolean
  message?: string
}

type WorksheetPreview = {
  name: string
}

type PreviewImportRow = ParsedImportRow & {
  matchedPropertyId: string | null
  matchedPropertyName: string | null
}

const TEMPLATE_COLUMNS = [
  "Aggregat-ID / märkning",
  "Aggregatnamn / benämning",
  "Placering",
  "Fastighet",
  "Köldmedium",
  "Fyllnadsmängd kg",
  "Läckagevarningssystem",
  "Senaste kontroll",
  "Nästa kontroll",
  "Driftsättningsdatum",
  "Serienummer",
  "Kommentar",
]

const TEMPLATE_ROWS = [
  {
    "Aggregat-ID / märkning": "AGG-001",
    "Aggregatnamn / benämning": "Kylaggregat 1",
    Placering: "Tak plan 3",
    Fastighet: "Stadshuset",
    Köldmedium: "R410A",
    "Fyllnadsmängd kg": 12.5,
    Läckagevarningssystem: "Nej",
    "Senaste kontroll": "2026-01-15",
    "Nästa kontroll": "2027-01-15",
    Driftsättningsdatum: "2021-05-01",
    Serienummer: "SN-12345",
    Kommentar: "Exempelrad - byt ut eller ta bort",
  },
  {
    "Aggregat-ID / märkning": "AGG-002",
    "Aggregatnamn / benämning": "Frysrum",
    Placering: "Källare",
    Fastighet: "Servicehuset",
    Köldmedium: "R404A",
    "Fyllnadsmängd kg": 8,
    Läckagevarningssystem: "Ja",
    "Senaste kontroll": "2026-02-20",
    "Nästa kontroll": "",
    Driftsättningsdatum: "2020-09-10",
    Serienummer: "SN-67890",
    Kommentar: "",
  },
]
const TEMPLATE_REQUIRED_COLUMNS = [
  "Aggregat-ID / märkning",
  "Köldmedium",
  "Fyllnadsmängd kg",
]
const TEMPLATE_RECOMMENDED_COLUMNS = [
  "Fastighet",
  "Placering",
  "Senaste kontroll",
  "Nästa kontroll",
]
const TEMPLATE_COLUMN_WIDTHS: Record<string, number> = {
  "Aggregat-ID / märkning": 24,
  "Aggregatnamn / benämning": 28,
  Placering: 22,
  Fastighet: 24,
  Köldmedium: 16,
  "Fyllnadsmängd kg": 18,
  Läckagevarningssystem: 24,
  "Senaste kontroll": 18,
  "Nästa kontroll": 18,
  Driftsättningsdatum: 20,
  Serienummer: 20,
  Kommentar: 34,
}

const PREVIEW_ROW_LIMIT = 50
const INSTALLATION_REQUIRED_FIELD_KEYS: ImportFieldKey[] = [
  "equipmentId",
  "refrigerantType",
  "refrigerantAmount",
]
const INSTALLATION_RECOMMENDED_FIELD_KEYS: ImportFieldKey[] = [
  "propertyName",
  "lastInspection",
  "nextInspection",
]
const INSTALLATION_HIDDEN_MAPPING_FIELD_KEYS: ImportFieldKey[] = [
  "municipality",
  "inspectionIntervalMonths",
  "servicePartner",
  "status",
  "equipmentType",
  "operatorName",
]
const INSTALLATION_ADVANCED_FIELD_KEYS: ImportFieldKey[] =
  IMPORT_FIELD_DEFINITIONS.map((field) => field.key).filter(
    (key) =>
      !INSTALLATION_REQUIRED_FIELD_KEYS.includes(key) &&
      !INSTALLATION_RECOMMENDED_FIELD_KEYS.includes(key) &&
      !INSTALLATION_HIDDEN_MAPPING_FIELD_KEYS.includes(key)
  )

export default function ImportInstallationsPage({
  embedded = false,
  onImportStateChange,
  onImported,
}: ImportInstallationsPageProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [rows, setRows] = useState<PreviewImportRow[]>([])
  const [properties, setProperties] = useState<ImportPropertyReference[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [showIgnoredColumns, setShowIgnoredColumns] = useState(false)
  const workbookDataRef = useRef<ArrayBuffer | null>(null)
  const templateDownloadInProgressRef = useRef(false)
  const validRows = useMemo(
    () => rows.filter((row) => row.errors.length === 0),
    [rows]
  )
  const warningRows = useMemo(
    () => validRows.filter((row) => row.warnings.length > 0),
    [validRows]
  )
  const invalidRows = useMemo(
    () => rows.filter((row) => row.errors.length > 0),
    [rows]
  )
  const previewRows = useMemo(
    () => rows.slice(0, PREVIEW_ROW_LIMIT),
    [rows]
  )
  const mappedFields = useMemo(
    () => Object.values(columnMapping).filter(Boolean) as ImportFieldKey[],
    [columnMapping]
  )
  const missingRequiredFields = getMissingRequiredImportFields(mappedFields)
  const duplicatedFields = useMemo(
    () => getDuplicateMappedFields(columnMapping),
    [columnMapping]
  )
  const detectedEventHistoryColumns = useMemo(
    () => getDetectedEventHistoryColumns(detectedColumns),
    [detectedColumns]
  )
  const ignoredColumns = useMemo(
    () => detectedColumns.filter((column) => !columnMapping[column]),
    [columnMapping, detectedColumns]
  )
  const mappedAdvancedFieldCount = INSTALLATION_ADVANCED_FIELD_KEYS.filter((field) =>
    mappedFields.includes(field)
  ).length
  const hasBlockingMappingIssue =
    missingRequiredFields.length > 0 || duplicatedFields.length > 0
  const hasImportProgress =
    Boolean(selectedFile) ||
    worksheets.length > 0 ||
    detectedColumns.length > 0 ||
    rows.length > 0 ||
    Boolean(summary)
  const isImportBusy = isParsing || isImporting

  useEffect(() => {
    onImportStateChange?.({
      hasProgress: hasImportProgress,
      isBusy: isImportBusy,
      message: isParsing
        ? "Filen läses in. Vänta tills förhandsgranskningen är klar."
        : isImporting
          ? "Importen pågår. Vänta tills den är klar."
          : undefined,
    })
  }, [hasImportProgress, isImportBusy, isImporting, isParsing, onImportStateChange])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFile(file ?? null)
    setWorksheets([])
    setSelectedWorksheetName("")
    setRawRows([])
    setDetectedColumns([])
    setColumnMapping({})
    setRows([])
    setProperties([])
    setError("")
    setSummary(null)
    setToast(null)
    workbookDataRef.current = null
  }

  async function handlePreviewFile() {
    if (!selectedFile) return

    setError("")
    setSummary(null)
    setIsParsing(true)

    try {
      await yieldToBrowser()
      startImportTimer("installation-import:file-read")
      const data = await selectedFile.arrayBuffer()
      endImportTimer("installation-import:file-read")
      workbookDataRef.current = data

      startImportTimer("installation-import:workbook-sheets")
      const workbookInfo = XLSX.read(data, {
        type: "array",
        bookSheets: true,
      })
      endImportTimer("installation-import:workbook-sheets")
      const propertiesRes = await fetch("/api/properties", {
        credentials: "include",
      })
      const propertyData: ImportPropertyReference[] = propertiesRes.ok
        ? await propertiesRes.json()
        : []
      const parsedWorksheets = workbookInfo.SheetNames.map((name) => ({ name }))
      const firstWorksheet = parsedWorksheets[0]

      setProperties(propertyData)
      setWorksheets(parsedWorksheets)
      setSelectedWorksheetName(firstWorksheet?.name ?? "")
      await applyWorksheetPreview(firstWorksheet?.name ?? "", propertyData)
    } catch (err) {
      console.error("Parse import file error:", err)
      setWorksheets([])
      setSelectedWorksheetName("")
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setRows([])
      setProperties([])
      workbookDataRef.current = null
      setError("Kunde inte läsa filen. Kontrollera att den är en giltig .xlsx eller .csv.")
    } finally {
      setIsParsing(false)
    }
  }

  async function handleWorksheetChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const worksheetName = event.target.value

    setSelectedWorksheetName(worksheetName)
    setError("")
    setSummary(null)
    setIsParsing(true)

    try {
      await applyWorksheetPreview(worksheetName, properties)
    } catch (err) {
      console.error("Parse import worksheet error:", err)
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setRows([])
      setError("Kunde inte läsa arbetsbladet. Kontrollera filens innehåll.")
    } finally {
      setIsParsing(false)
    }
  }

  async function applyWorksheetPreview(
    worksheetName: string,
    propertyOptions: ImportPropertyReference[]
  ) {
    if (!workbookDataRef.current || !worksheetName) {
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setRows([])
      return
    }

    await yieldToBrowser()
    startImportTimer("installation-import:worksheet-parse")
    const workbook = XLSX.read(workbookDataRef.current, {
      type: "array",
      cellDates: true,
      sheetStubs: false,
      sheets: worksheetName,
    })
    endImportTimer("installation-import:worksheet-parse")
    startImportTimer("installation-import:rows-extraction")
    const worksheetRows = readWorksheetRows(workbook.Sheets[worksheetName])
    endImportTimer("installation-import:rows-extraction")
    startImportTimer("installation-import:mapping-validation")
    const preview = applyWorksheetPreviewRows(worksheetRows, propertyOptions)
    endImportTimer("installation-import:mapping-validation")

    setRawRows(worksheetRows)
    setDetectedColumns(preview.columns)
    setColumnMapping(preview.suggestedMapping)
    setRows(preview.parsedRows)
  }

  function handleFieldMappingChange(field: ImportFieldKey, column: string) {
    const nextMapping = { ...columnMapping }

    Object.keys(nextMapping).forEach((mappedColumn) => {
      if (nextMapping[mappedColumn] === field) nextMapping[mappedColumn] = ""
    })
    if (column) nextMapping[column] = field

    setColumnMapping(nextMapping)
    setRows(buildPreviewRows(rawRows, nextMapping, properties))
  }

  function handleDownloadTemplate() {
    if (templateDownloadInProgressRef.current) return

    templateDownloadInProgressRef.current = true
    setIsDownloadingTemplate(true)
    const workbook = XLSX.utils.book_new()
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Helm Polar - importmall för aggregat"],
      [""],
      ["Fyll i fliken Aggregat och behåll rubrikraden överst."],
      ["Obligatoriska fält", TEMPLATE_REQUIRED_COLUMNS.join(", ")],
      ["Rekommenderade fält", TEMPLATE_RECOMMENDED_COLUMNS.join(", ")],
      ["Datumformat", "Använd helst ÅÅÅÅ-MM-DD, till exempel 2026-01-15."],
      [
        "Beräkningar",
        "Importera normalt inte GWP eller CO₂e. Helm Polar beräknar detta från köldmedium och fyllnadsmängd.",
      ],
      [
        "Historik",
        "Kontroller, läckage, service och påfyllningar importeras via händelseimporten.",
      ],
    ])
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS, {
      header: TEMPLATE_COLUMNS,
    })

    instructionSheet["!cols"] = [{ wch: 24 }, { wch: 110 }]
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aggregat")
    XLSX.writeFile(workbook, "helm-polar-importmall-aggregat.xlsx")
    window.setTimeout(() => {
      templateDownloadInProgressRef.current = false
      setIsDownloadingTemplate(false)
    }, 700)
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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Importen misslyckades.",
      })
      return
    }

    setSummary(result)
    setToast({
      type: result.skipped > 0 || result.errors?.length > 0 ? "warning" : "success",
      title: result.skipped > 0 || result.errors?.length > 0 ? "Import klar" : "Klart",
      message:
        result.skipped > 0 || result.errors?.length > 0
          ? `${result.created} aggregat importerades. ${result.skipped} rader hoppades över.`
          : `${result.created} aggregat importerades.`,
    })
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
          Ladda upp Excel/CSV och koppla aggregatdata till registret.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Ska du importera historiska kontroller, läckage, service eller
          påfyllningar?{" "}
          <Link
            className="font-semibold text-blue-700 underline-offset-4 hover:underline"
            href="/dashboard/installations/import-events"
          >
            Gå till händelseimport
          </Link>
          .
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <ul className="grid gap-1.5">
              <li>Aggregat-ID / märkning används som primär identitet.</li>
              <li>
                GWP och CO₂e beräknas automatiskt och behöver inte importeras.
              </li>
              <li>
                Fastigheter kopplas bara om de redan finns inlagda i systemet
                och namnet matchar.
              </li>
            </ul>
            <details className="mt-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">
                Visa importtips
              </summary>
              <ul className="mt-2 list-disc space-y-1.5 pl-4">
                <li>Använd tydliga datumformat, till exempel 2026-01-15.</li>
                <li>Aggregat-ID används som primär identitet vid import.</li>
                <li>Låt Helm Polar beräkna GWP och CO₂e i stället för att importera manuella värden.</li>
                <li>Lämna okända värden tomma hellre än att fylla i uppskattningar.</li>
                <li>Se till att märkning eller Aggregat-ID är unik och konsekvent i filen.</li>
              </ul>
            </details>
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
              {isParsing ? "Läser in..." : "Läs in fil"}
            </button>
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
              Välj vilket blad i filen som ska läsas in.
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
                Kontrollera fält
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Helm Polar föreslår matchningar baserat på kolumnnamn. Kontrollera
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
            <ImportMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={INSTALLATION_REQUIRED_FIELD_KEYS}
              onChange={handleFieldMappingChange}
              title="Obligatoriska fält"
            />
            <ImportMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={INSTALLATION_RECOMMENDED_FIELD_KEYS}
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
                <ImportMappingFieldGroup
                  columnMapping={columnMapping}
                  columns={detectedColumns}
                  fields={INSTALLATION_ADVANCED_FIELD_KEYS}
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

          {detectedEventHistoryColumns.length > 0 && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <p>{EVENT_HISTORY_IMPORT_MESSAGE}</p>
              <p className="mt-1 text-xs">
                Upptäckta historikkolumner: {detectedEventHistoryColumns.join(", ")}.
              </p>
            </div>
          )}

          {hasBlockingMappingIssue && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {missingRequiredFields.length > 0 && (
                <p>
                  Saknar obligatorisk koppling:{" "}
                  {missingRequiredFields.map(getImportFieldLabel).join(", ")}.
                </p>
              )}
              {duplicatedFields.length > 0 && (
                <p className="mt-1">
                  Samma fält i Helm Polar är valt flera gånger:{" "}
                  {[...new Set(duplicatedFields)].map(getImportFieldLabel).join(", ")}.
                  Välj ett unikt fält per kolumn eller lämna extra kolumner
                  utan koppling.
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

          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <ImportMetric label="Rader hittade" value={rows.length} />
            <ImportMetric label="Kan importeras" value={validRows.length} />
            <ImportMetric label="Har varningar" value={warningRows.length} />
            <ImportMetric label="Kommer hoppas över" value={invalidRows.length} />
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

          <p className="mt-4 text-xs text-slate-500">
            Visar de första {Math.min(PREVIEW_ROW_LIMIT, rows.length)} raderna.
            Totalt hittades {rows.length} rader. Importen använder alla giltiga rader inom importgränsen.
          </p>

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Rad</th>
                  <th className={tableHeaderClassName}>Aggregat-ID / märkning</th>
                  <th className={tableHeaderClassName}>Aggregatnamn / benämning</th>
                  <th className={tableHeaderClassName}>Plats</th>
                  <th className={tableHeaderClassName}>Fastighet</th>
                  <th className={tableHeaderClassName}>Fastighetskoppling</th>
                  <th className={tableHeaderClassName}>Köldmedium</th>
                  <th className={tableHeaderClassName}>Mängd</th>
                  <th className={tableHeaderClassName}>Senaste kontroll</th>
                  <th className={tableHeaderClassName}>Intervall</th>
                  <th className={tableHeaderClassName}>Nästa kontroll</th>
                  <th className={tableHeaderClassName}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {previewRows.map((row) => (
                  <tr key={row.row}>
                    <td className={tableCellClassName}>{row.row}</td>
                    <td className={tableCellClassName}>{row.equipmentId || "-"}</td>
                    <td className={tableCellClassName}>{row.name || "-"}</td>
                    <td className={tableCellClassName}>{row.location || "-"}</td>
                    <td className={tableCellClassName}>{row.propertyName || "-"}</td>
                    <td className={tableCellClassName}>
                      {formatPropertyMatchStatus(row)}
                    </td>
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
        <ImportCompletionSummary
          actions={[
            {
              href: "/dashboard/installations",
              label: "Visa aggregat",
              variant: "primary",
            },
            {
              href: "/dashboard/data-quality",
              label: "Öppna registerstatus",
            },
          ]}
          context={{
            hasNoProperties: properties.length === 0,
            installationsMissingPropertyCount: rows.filter(
              (row) => row.errors.length === 0 && !row.matchedPropertyId
            ).length,
          }}
          errors={summary.errors}
          importedCount={summary.created}
          kind="installations"
          skippedCount={summary.skipped}
          subtitle="Aggregatimporten är klar. Kontrollera resultatet och komplettera uppgifter vid behov."
          unmappedColumnCount={ignoredColumns.length}
          validationIssueCount={summary.errors.length}
        />
      )}
      {isImporting && <ImportInProgressOverlay />}
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

function ImportMappingFieldGroup({
  columnMapping,
  columns,
  fields,
  onChange,
  title,
}: {
  columnMapping: ColumnMapping
  columns: string[]
  fields: ImportFieldKey[]
  onChange: (field: ImportFieldKey, column: string) => void
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
          const selectedColumn = getColumnForImportField(columnMapping, field)
          const label = getImportFieldLabel(field)

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
                      ? ` - används för ${getImportFieldLabel(columnMapping[column] as ImportFieldKey)}`
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

function getColumnForImportField(mapping: ColumnMapping, field: ImportFieldKey) {
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

function ImportInProgressOverlay() {
  return (
    <div
      aria-live="polite"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-950">Importerar aggregat</h2>
        <p className="mt-2 text-sm text-slate-600">
          Vi läser in filen och skapar aggregat. Det kan ta en stund vid stora
          register.
        </p>
        <div className="mt-5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-2 w-1/2 animate-pulse rounded-full bg-blue-600" />
        </div>
        <div className="mt-4 grid gap-1 text-xs text-slate-500">
          <p>Validerar rader</p>
          <p>Skapar aggregat</p>
          <p>Sammanställer resultat</p>
        </div>
      </div>
    </div>
  )
}

function createSuggestedMapping(columns: string[]): ColumnMapping {
  return Object.fromEntries(
    columns.map((column) => {
      const suggestedField = getSuggestedImportField(column)

      return [
        column,
        suggestedField && !INSTALLATION_HIDDEN_MAPPING_FIELD_KEYS.includes(suggestedField)
          ? suggestedField
          : "",
      ]
    })
  )
}

function applyWorksheetPreviewRows(
  rows: Record<string, unknown>[],
  properties: ImportPropertyReference[]
) {
  const columns = getDetectedColumns(rows)
  const suggestedMapping = createSuggestedMapping(columns)

  return {
    columns,
    suggestedMapping,
    parsedRows: buildPreviewRows(rows, suggestedMapping, properties),
  }
}

function buildPreviewRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  properties: ImportPropertyReference[]
) {
  const mappedRows = mapImportRowsWithMapping(rows, mapping)
    .filter((row) => !isEmptyImportRow(row))
    .slice(0, getMaxImportRows())

  return parseImportRows(mappedRows).map((row) =>
    addPropertyMatchPreview(row, properties)
  )
}

function addPropertyMatchPreview(
  row: ParsedImportRow,
  properties: ImportPropertyReference[]
): PreviewImportRow {
  const propertyMatch = findImportPropertyMatch(row.propertyName, properties)
  const propertyWarning = getImportPropertyMatchWarning(row.propertyName, properties)

  return {
    ...row,
    warnings: propertyWarning ? [...row.warnings, propertyWarning] : row.warnings,
    matchedPropertyId: propertyMatch?.id ?? null,
    matchedPropertyName: propertyMatch?.name ?? null,
  }
}

function formatPropertyMatchStatus(row: PreviewImportRow) {
  if (!row.propertyName) return "Saknas"
  if (row.matchedPropertyName) return `Kopplas till ${row.matchedPropertyName}`
  return "Hittades inte"
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

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
