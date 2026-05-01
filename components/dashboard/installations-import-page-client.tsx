"use client"

import Link from "next/link"
import { useState } from "react"
import * as XLSX from "xlsx"
import {
  getMaxImportRows,
  isEmptyImportRow,
  mapImportRowHeaders,
  parseImportRows,
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

export default function ImportInstallationsPage({
  embedded = false,
  onClose,
  onImported,
}: ImportInstallationsPageProps = {}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const validRows = rows.filter((row) => row.errors.length === 0)

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setSelectedFile(file ?? null)
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
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      })
      const mappedRows = rawRows
        .map(mapImportRowHeaders)
        .filter((row) => !isEmptyImportRow(row))
        .slice(0, getMaxImportRows())

      setRows(parseImportRows(mappedRows))
    } catch (err) {
      console.error("Parse import file error:", err)
      setRows([])
      setError("Kunde inte läsa filen. Kontrollera att den är en giltig .xlsx eller .csv.")
    } finally {
      setIsParsing(false)
    }
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
          Ladda upp en .xlsx- eller .csv-fil, förhandsgranska raderna och
          importera bara de rader som är giltiga.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Stödda kolumner är till exempel namn, plats, köldmedium, mängd,
          senaste kontroll och kontrollintervall.
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
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </section>

      {rows.length > 0 && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              {validRows.length} av {rows.length} rader är giltiga.
            </p>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
              onClick={handleImport}
              disabled={validRows.length === 0 || isImporting}
            >
              {isImporting ? "Importerar..." : `Importera ${validRows.length} giltiga rader`}
            </button>
          </div>

          <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={tableHeaderClassName}>Rad</th>
                  <th className={tableHeaderClassName}>Namn</th>
                  <th className={tableHeaderClassName}>Plats</th>
                  <th className={tableHeaderClassName}>Köldmedium</th>
                  <th className={tableHeaderClassName}>Mängd</th>
                  <th className={tableHeaderClassName}>Senaste kontroll</th>
                  <th className={tableHeaderClassName}>Intervall</th>
                  <th className={tableHeaderClassName}>Nästa kontroll</th>
                  <th className={tableHeaderClassName}>Status / fel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td className={tableCellClassName}>{row.row}</td>
                    <td className={tableCellClassName}>{row.name || "-"}</td>
                    <td className={tableCellClassName}>{row.location || "-"}</td>
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
                        row.errors.length > 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {row.errors.length > 0 ? row.errors.join(", ") : "Giltig"}
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

const tableHeaderClassName =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
const tableCellClassName = "whitespace-nowrap px-4 py-3 text-slate-800"
