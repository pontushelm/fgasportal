"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type EventType = "INSPECTION" | "LEAK" | "REFILL" | "SERVICE"

type ReportData = {
  year: number
  metrics: {
    totalInstallations: number
    totalRefrigerantAmountKg: number
    totalCo2eTon: number
    requiringInspection: number
    inspectionsPerformed: number
    leakageEvents: number
    refilledAmountKg: number
    serviceEvents: number
  }
  refrigerants: Array<{
    refrigerantType: string
    installationCount: number
    totalAmountKg: number
    totalCo2eTon: number
    refilledAmountKg: number
    leakageEvents: number
  }>
  events: Array<{
    id: string
    date: string
    installationId: string
    installationName: string
    type: EventType
    refrigerantAddedKg: number | null
    notes: string | null
  }>
}

const EVENT_LABELS: Record<EventType, string> = {
  INSPECTION: "Kontroll",
  LEAK: "Läckage",
  REFILL: "Påfyllning",
  SERVICE: "Service",
}

const EVENT_TONE: Record<EventType, string> = {
  INSPECTION: "border-sky-200 bg-sky-50 text-sky-800",
  LEAK: "border-red-200 bg-red-50 text-red-800",
  REFILL: "border-amber-200 bg-amber-50 text-amber-800",
  SERVICE: "border-neutral-200 bg-neutral-50 text-neutral-700",
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear]
  )
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function fetchReport() {
      setIsLoading(true)
      setError("")

      const response = await fetch(`/api/reports/fgas?year=${selectedYear}`, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta årsrapporten")
        setIsLoading(false)
        return
      }

      const data: ReportData = await response.json()

      if (!isMounted) return

      setReportData(data)
      setIsLoading(false)
    }

    void fetchReport()

    return () => {
      isMounted = false
    }
  }, [router, selectedYear])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-neutral-950 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link className="text-sm font-semibold text-neutral-600 underline-offset-4 hover:underline" href="/dashboard">
            Till dashboard
          </Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Rapportering
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            F-gas årsrapport
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Årssammanställning av aggregat, kontrollhändelser,
            läckagehändelser, påfyllningar och klimatpåverkan.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            År
            <select
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              value={selectedYear}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <a
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            href={`/api/reports/fgas/export?year=${selectedYear}&format=csv`}
          >
            Exportera CSV
          </a>
          <a
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            href={`/api/reports/fgas/export?year=${selectedYear}&format=pdf`}
          >
            Exportera PDF
          </a>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-neutral-600">Laddar rapport...</p>}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {reportData && !isLoading && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Totalt antal aggregat" value={reportData.metrics.totalInstallations} />
            <MetricCard label="Total köldmediemängd" value={`${formatNumber(reportData.metrics.totalRefrigerantAmountKg)} kg`} />
            <MetricCard label="Total CO₂e" value={`${formatNumber(reportData.metrics.totalCo2eTon)} ton`} />
            <MetricCard label="Kontrollpliktiga aggregat" value={reportData.metrics.requiringInspection} />
            <MetricCard label="Utförda kontroller under året" value={reportData.metrics.inspectionsPerformed} tone="sky" />
            <MetricCard label="Läckagehändelser under året" value={reportData.metrics.leakageEvents} tone="red" />
            <MetricCard label="Påfylld mängd köldmedium" value={`${formatNumber(reportData.metrics.refilledAmountKg)} kg`} tone="amber" />
            <MetricCard label="Servicehändelser under året" value={reportData.metrics.serviceEvents} />
          </section>

          <section className="mt-10">
            <div>
              <h2 className="text-xl font-semibold">Köldmediesammanställning</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Summerat per köldmedium för aktiva, ej arkiverade aggregat.
              </p>
            </div>

            {reportData.refrigerants.length === 0 ? (
              <EmptyState text="Inga aggregat finns att summera för valt år." />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <TableHeader>Köldmedium</TableHeader>
                      <TableHeader>Antal aggregat</TableHeader>
                      <TableHeader>Total mängd, kg</TableHeader>
                      <TableHeader>Total CO₂e, ton</TableHeader>
                      <TableHeader>Påfylld mängd under året, kg</TableHeader>
                      <TableHeader>Antal läckagehändelser</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {reportData.refrigerants.map((item) => (
                      <tr key={item.refrigerantType}>
                        <TableCell>{item.refrigerantType}</TableCell>
                        <TableCell>{item.installationCount}</TableCell>
                        <TableCell>{formatNumber(item.totalAmountKg)}</TableCell>
                        <TableCell>{formatNumber(item.totalCo2eTon)}</TableCell>
                        <TableCell>{formatNumber(item.refilledAmountKg)}</TableCell>
                        <TableCell>{item.leakageEvents}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-10">
            <div>
              <h2 className="text-xl font-semibold">Händelser under året</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Senaste kontroll-, läckage-, påfyllnings- och servicehändelser
                för valt år.
              </p>
            </div>

            {reportData.events.length === 0 ? (
              <EmptyState text="Inga händelser registrerade för valt år." />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <TableHeader>Datum</TableHeader>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Typ</TableHeader>
                      <TableHeader>Påfylld mängd, kg</TableHeader>
                      <TableHeader>Anteckningar</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {reportData.events.map((event) => (
                      <tr key={event.id}>
                        <TableCell>{formatDate(event.date)}</TableCell>
                        <TableCell>
                          <Link
                            className="font-semibold text-neutral-950 underline-offset-4 hover:underline"
                            href={`/dashboard/installations/${event.installationId}`}
                          >
                            {event.installationName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <EventBadge type={event.type} />
                        </TableCell>
                        <TableCell>
                          {event.refrigerantAddedKg === null
                            ? "-"
                            : formatNumber(event.refrigerantAddedKg)}
                        </TableCell>
                        <TableCell>{event.notes || "-"}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number | string
  tone?: "neutral" | "sky" | "red" | "amber"
}) {
  const toneClass = {
    neutral: "border-neutral-200 bg-white",
    sky: "border-sky-200 bg-sky-50",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
  }[tone]

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-sm font-medium text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
    </div>
  )
}

function EventBadge({ type }: { type: EventType }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${EVENT_TONE[type]}`}>
      {EVENT_LABELS[type]}
    </span>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-neutral-700">{children}</td>
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
      {text}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
