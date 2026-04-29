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

export default function ImportInstallationsPage() {
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const validRows = rows.filter((row) => row.errors.length === 0)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError("")
    setSummary(null)

    if (!file) return

    try {
      const data = await file.arrayBuffer()
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
  }

  return (
    <main style={{ maxWidth: 1100, margin: "60px auto", padding: 20 }}>
      <Link href="/dashboard">Tillbaka till dashboard</Link>
      <h1>Importera installationer</h1>
      <p>
        Ladda upp en .xlsx- eller .csv-fil, granska raderna och importera bara
        de rader som är giltiga.
      </p>

      <section style={sectionStyle}>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
        />
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      </section>

      {rows.length > 0 && (
        <section style={sectionStyle}>
          <div style={actionsStyle}>
            <button
              type="button"
              onClick={handleImport}
              disabled={validRows.length === 0 || isImporting}
            >
              {isImporting ? "Importerar..." : `Importera ${validRows.length} giltiga rader`}
            </button>
            <Link href="/dashboard">Avbryt</Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Rad</th>
                  <th style={cellStyle}>Namn</th>
                  <th style={cellStyle}>Plats</th>
                  <th style={cellStyle}>Köldmedium</th>
                  <th style={cellStyle}>Mängd</th>
                  <th style={cellStyle}>Senaste kontroll</th>
                  <th style={cellStyle}>Intervall</th>
                  <th style={cellStyle}>Nästa kontroll</th>
                  <th style={cellStyle}>Status / fel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td style={cellStyle}>{row.row}</td>
                    <td style={cellStyle}>{row.name || "-"}</td>
                    <td style={cellStyle}>{row.location || "-"}</td>
                    <td style={cellStyle}>{row.refrigerantType || "-"}</td>
                    <td style={cellStyle}>
                      {row.refrigerantAmount ?? "-"}
                    </td>
                    <td style={cellStyle}>{row.lastInspection || "-"}</td>
                    <td style={cellStyle}>
                      {row.inspectionIntervalMonths
                        ? `${row.inspectionIntervalMonths} mån`
                        : "-"}
                    </td>
                    <td style={cellStyle}>{row.nextInspection || "-"}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: row.errors.length > 0 ? "#b91c1c" : "#047857",
                      }}
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
        <section style={sectionStyle}>
          <h2>Import klar</h2>
          <p>Skapade: {summary.created}</p>
          <p>Hoppade över: {summary.skipped}</p>
          {summary.errors.length > 0 && (
            <ul>
              {summary.errors.map((item) => (
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

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
}

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "8px",
  textAlign: "left",
  verticalAlign: "top",
}
