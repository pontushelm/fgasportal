"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { ImportCompletionSummary } from "@/components/dashboard/import-completion-summary"
import { Toast, type ToastMessage } from "@/components/ui"
import {
  PROPERTY_IMPORT_FIELD_DEFINITIONS,
  getDuplicatePropertyMappedFields,
  getMissingRequiredPropertyImportFields,
  getPropertyImportFieldLabel,
  getSuggestedPropertyImportField,
  isEmptyPropertyImportRow,
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
}

type PropertiesImportPageClientProps = {
  embedded?: boolean
  onImportStateChange?: (state: ImportWorkspaceState) => void
  onImported?: () => void
}

type ImportWorkspaceState = {
  hasProgress: boolean
  isBusy: boolean
  message?: string
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
const TEMPLATE_REQUIRED_COLUMNS = ["Fastighetsbeteckning"]
const TEMPLATE_RECOMMENDED_COLUMNS = ["Namn", "Kommun", "Ort", "Adress"]
const TEMPLATE_COLUMN_WIDTHS: Record<string, number> = {
  Fastighetsbeteckning: 24,
  Namn: 30,
  Kommun: 18,
  Ort: 18,
  Adress: 34,
  Postnummer: 14,
  "Intern referens": 20,
  Kommentar: 34,
}

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
const PREVIEW_ROW_LIMIT = 50
const PROPERTY_REQUIRED_FIELD_KEYS: PropertyImportFieldKey[] = [
  "propertyDesignation",
]
const PROPERTY_RECOMMENDED_FIELD_KEYS: PropertyImportFieldKey[] = [
  "name",
  "municipality",
  "city",
  "address",
]
const PROPERTY_ADVANCED_FIELD_KEYS: PropertyImportFieldKey[] =
  PROPERTY_IMPORT_FIELD_DEFINITIONS.map((field) => field.key).filter(
    (key) =>
      !PROPERTY_REQUIRED_FIELD_KEYS.includes(key) &&
      !PROPERTY_RECOMMENDED_FIELD_KEYS.includes(key)
  )

export default function PropertiesImportPageClient({
  embedded = false,
  onImportStateChange,
  onImported,
}: PropertiesImportPageClientProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [worksheets, setWorksheets] = useState<WorksheetPreview[]>([])
  const [selectedWorksheetName, setSelectedWorksheetName] = useState("")
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<PropertyColumnMapping>({})
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
  const ignoredColumns = useMemo(
    () => detectedColumns.filter((column) => !columnMapping[column]),
    [columnMapping, detectedColumns]
  )
  const mappedAdvancedFieldCount = PROPERTY_ADVANCED_FIELD_KEYS.filter((field) =>
    mappedFields.includes(field)
  ).length
  const rows = useMemo(
    () => buildPreviewRows(rawRows, columnMapping),
    [rawRows, columnMapping]
  )
  const rowSummary = useMemo(() => {
    const validRows: typeof rows = []
    const invalidRows: typeof rows = []
    const warningRows: typeof rows = []
    const missingDesignationRows: typeof rows = []
    const duplicateRowsInFile: typeof rows = []

    for (const row of rows) {
      if (row.errors.includes("Saknar fastighetsbeteckning")) {
        missingDesignationRows.push(row)
      }

      if (row.duplicateInFile) {
        duplicateRowsInFile.push(row)
      }

      if (row.errors.length > 0 || row.duplicateInFile) {
        invalidRows.push(row)
        continue
      }

      validRows.push(row)
      if (row.warnings.length > 0) warningRows.push(row)
    }

    return {
      validRows,
      invalidRows,
      warningRows,
      missingDesignationRows,
      duplicateRowsInFile,
    }
  }, [rows])
  const validRows = rowSummary.validRows
  const invalidRows = rowSummary.invalidRows
  const warningRows = rowSummary.warningRows
  const previewRows = useMemo(
    () => rows.slice(0, PREVIEW_ROW_LIMIT),
    [rows]
  )
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
      startImportTimer("property-import:file-read")
      const data = await selectedFile.arrayBuffer()
      endImportTimer("property-import:file-read")
      workbookDataRef.current = data

      startImportTimer("property-import:workbook-sheets")
      const workbookInfo = XLSX.read(data, {
        type: "array",
        bookSheets: true,
      })
      endImportTimer("property-import:workbook-sheets")
      const parsedWorksheets = workbookInfo.SheetNames.map((name) => ({ name }))
      const firstWorksheet = parsedWorksheets[0]

      setWorksheets(parsedWorksheets)
      setSelectedWorksheetName(firstWorksheet?.name ?? "")
      await applyWorksheetPreview(firstWorksheet?.name ?? "")
    } catch (err) {
      console.error("Parse property import file error:", err)
      setWorksheets([])
      setSelectedWorksheetName("")
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
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
      await applyWorksheetPreview(worksheetName)
    } catch (err) {
      console.error("Parse property import worksheet error:", err)
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      setError("Kunde inte läsa arbetsbladet. Kontrollera filens innehåll.")
    } finally {
      setIsParsing(false)
    }
  }

  async function applyWorksheetPreview(worksheetName: string) {
    if (!workbookDataRef.current || !worksheetName) {
      setRawRows([])
      setDetectedColumns([])
      setColumnMapping({})
      return
    }

    await yieldToBrowser()
    startImportTimer("property-import:worksheet-parse")
    const workbook = XLSX.read(workbookDataRef.current, {
      type: "array",
      cellDates: true,
      sheetStubs: false,
      sheets: worksheetName,
    })
    endImportTimer("property-import:worksheet-parse")
    startImportTimer("property-import:rows-extraction")
    const worksheetRows = readWorksheetRows(workbook.Sheets[worksheetName])
    endImportTimer("property-import:rows-extraction")
    startImportTimer("property-import:mapping")
    const preview = applyWorksheetPreviewRows(worksheetRows)
    endImportTimer("property-import:mapping")

    setRawRows(worksheetRows)
    setDetectedColumns(preview.columns)
    setColumnMapping(preview.suggestedMapping)
  }

  function handleFieldMappingChange(field: PropertyImportFieldKey, column: string) {
    const nextMapping = { ...columnMapping }

    Object.keys(nextMapping).forEach((mappedColumn) => {
      if (nextMapping[mappedColumn] === field) nextMapping[mappedColumn] = ""
    })
    if (column) nextMapping[column] = field

    setColumnMapping(nextMapping)
  }

  function handleDownloadTemplate() {
    if (templateDownloadInProgressRef.current) return

    templateDownloadInProgressRef.current = true
    setIsDownloadingTemplate(true)
    const workbook = XLSX.utils.book_new()
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Helm Polar - importmall för fastigheter"],
      [""],
      ["Fyll i fliken Fastigheter och behåll rubrikraden överst."],
      ["Obligatoriska fält", TEMPLATE_REQUIRED_COLUMNS.join(", ")],
      ["Rekommenderade fält", TEMPLATE_RECOMMENDED_COLUMNS.join(", ")],
      [
        "Fastighetsbeteckning",
        "Använd den juridiskt relevanta beteckningen som ska synas i årsrapporten.",
      ],
      [
        "Dubbletter",
        "Fastigheter med samma fastighetsbeteckning i företaget importeras inte igen.",
      ],
      [
        "Valfria uppgifter",
        "Kommun, ort, adress, intern referens och kommentar kan lämnas tomma om de saknas.",
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fastigheter")
    XLSX.writeFile(workbook, "helm-polar-importmall-fastigheter.xlsx")
    window.setTimeout(() => {
      templateDownloadInProgressRef.current = false
      setIsDownloadingTemplate(false)
    }, 700)
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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Importen misslyckades.",
      })
      return
    }

    setSummary(result)
    setToast({
      type: result.invalid > 0 || result.skippedDuplicates > 0 ? "warning" : "success",
      title: result.invalid > 0 || result.skippedDuplicates > 0 ? "Import klar" : "Klart",
      message:
        result.invalid > 0 || result.skippedDuplicates > 0
          ? `${result.created} fastigheter importerades. ${result.skippedDuplicates} dubbletter och ${result.invalid} ogiltiga rader hoppades över.`
          : `${result.created} fastigheter importerades.`,
    })
    onImported?.()
  }

  const content = (
    <>
      <div>
        {!embedded && (
          <Link
            className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
            href="/dashboard/properties"
          >
            Tillbaka till fastigheter
          </Link>
        )}
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDownloadingTemplate}
            onClick={handleDownloadTemplate}
            type="button"
          >
            {isDownloadingTemplate ? "Förbereder mall..." : "Ladda ner importmall"}
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
                Kontrollera fält
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Polar föreslår matchningar baserat på kolumnnamn. Kontrollera
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
            <PropertyMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={PROPERTY_REQUIRED_FIELD_KEYS}
              onChange={handleFieldMappingChange}
              title="Obligatoriska fält"
            />
            <PropertyMappingFieldGroup
              columnMapping={columnMapping}
              columns={detectedColumns}
              fields={PROPERTY_RECOMMENDED_FIELD_KEYS}
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
                <PropertyMappingFieldGroup
                  columnMapping={columnMapping}
                  columns={detectedColumns}
                  fields={PROPERTY_ADVANCED_FIELD_KEYS}
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
                  {missingRequiredFields.map(getPropertyImportFieldLabel).join(", ")}.
                </p>
              )}
              {duplicatedFields.length > 0 && (
                <p className="mt-1">
                  Samma fält i Polar är valt flera gånger:{" "}
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

          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <ImportMetric label="Rader hittade" value={rows.length} />
            <ImportMetric label="Kan importeras" value={validRows.length} />
            <ImportMetric label="Har varningar" value={warningRows.length} />
            <ImportMetric label="Kommer hoppas över" value={invalidRows.length} />
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Visar de första {Math.min(PREVIEW_ROW_LIMIT, rows.length)} raderna.
            Totalt hittades {rows.length} rader. Importen använder alla giltiga rader.
          </p>

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
                {previewRows.map((row) => (
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
        <ImportCompletionSummary
          actions={[
            {
              href: "/dashboard/properties",
              label: "Visa fastigheter",
              variant: "primary",
            },
            {
              href: "/dashboard/installations",
              label: "Importera aggregat",
            },
          ]}
          errors={summary.errors}
          importedCount={summary.created}
          kind="properties"
          skippedCount={summary.skippedDuplicates}
          subtitle="Fastighetsimporten är klar. Nästa steg är att koppla aggregat till fastigheterna."
          unmappedColumnCount={ignoredColumns.length}
          validationIssueCount={summary.invalid}
        />
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

function PropertyMappingFieldGroup({
  columnMapping,
  columns,
  fields,
  onChange,
  title,
}: {
  columnMapping: PropertyColumnMapping
  columns: string[]
  fields: PropertyImportFieldKey[]
  onChange: (field: PropertyImportFieldKey, column: string) => void
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
          const selectedColumn = getColumnForPropertyField(columnMapping, field)
          const label = getPropertyImportFieldLabel(field)

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
                      ? ` - används för ${getPropertyImportFieldLabel(columnMapping[column] as PropertyImportFieldKey)}`
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

function getColumnForPropertyField(
  mapping: PropertyColumnMapping,
  field: PropertyImportFieldKey
) {
  return Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0] ?? ""
}

function applyWorksheetPreviewRows(rows: Record<string, unknown>[]) {
  const columns = getDetectedColumns(rows)
  const suggestedMapping = Object.fromEntries(
    columns.map((column) => [column, getSuggestedPropertyImportField(column) ?? ""])
  ) as PropertyColumnMapping

  return {
    columns,
    suggestedMapping,
  }
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

function buildPreviewRows(
  rows: Record<string, unknown>[],
  mapping: PropertyColumnMapping
) {
  const mappedRows = mapPropertyRowsWithMapping(rows, mapping)
    .filter((row) => !isEmptyPropertyImportRow(row))
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

function formatAddress(row: ParsedPropertyImportRow) {
  return [row.address, row.postalCode].filter(Boolean).join(", ") || "-"
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
