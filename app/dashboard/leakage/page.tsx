"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type LeakageData = {
  year: number
  metrics: {
    leakageEvents: number
    installationsWithLeakage: number
    totalLeakageKg: number
    totalCo2eTon: number
    topRefrigerant: string
    topInstallation: string
  }
  byRefrigerant: Array<{
    label: string
    eventCount: number
    totalLeakageKg: number
    totalCo2eTon: number
  }>
  byInstallation: Array<{
    installationId: string
    label: string
    location: string
    refrigerantType: string
    eventCount: number
    totalLeakageKg: number
    totalCo2eTon: number
    latestLeakage: string | null
  }>
  monthlyCounts: Array<{
    label: string
    month: number
    eventCount: number
  }>
  events: Array<{
    id: string
    date: string
    installationId: string
    installationName: string
    location: string
    refrigerantType: string
    leakageKg: number | null
    co2eTon: number | null
    notes: string | null
  }>
}

export default function LeakagePage() {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - index),
    [currentYear]
  )
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [leakageData, setLeakageData] = useState<LeakageData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function fetchLeakageData() {
      setIsLoading(true)
      setError("")

      const response = await fetch(`/api/dashboard/leakage?year=${selectedYear}`, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta läckageanalysen")
        setIsLoading(false)
        return
      }

      const data: LeakageData = await response.json()

      if (!isMounted) return

      setLeakageData(data)
      setIsLoading(false)
    }

    void fetchLeakageData()

    return () => {
      isMounted = false
    }
  }, [router, selectedYear])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline" href="/dashboard">
            Till dashboard
          </Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Miljö och läckage
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Läckageanalys
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Översikt över läckagehändelser, läckagemängder och beräknad CO₂e
            för valt år.
          </p>
        </div>

        <label className="grid gap-1 text-sm font-semibold text-slate-800">
          År
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950"
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
      </div>

      {isLoading && <p className="mt-8 text-slate-700">Laddar läckageanalys...</p>}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {leakageData && !isLoading && (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <MetricCard label="Antal läckagehändelser" value={leakageData.metrics.leakageEvents} tone="red" />
            <MetricCard label="Aggregat med läckage" value={leakageData.metrics.installationsWithLeakage} />
            <MetricCard label="Total läckagemängd" value={`${formatNumber(leakageData.metrics.totalLeakageKg)} kg`} tone="amber" />
            <MetricCard label="Beräknad CO₂e från läckage" value={`${formatNumber(leakageData.metrics.totalCo2eTon)} ton`} tone="red" />
            <MetricCard label="Mest läckande köldmedium" value={leakageData.metrics.topRefrigerant} />
            <MetricCard label="Mest läckande aggregat" value={leakageData.metrics.topInstallation} />
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-3">
            <VisualCard title="Läckage per köldmedium">
              <HorizontalBars
                emptyText="Inga läckage med mängd finns per köldmedium."
                items={leakageData.byRefrigerant.map((item) => ({
                  href: null,
                  label: item.label,
                  meta: `${item.eventCount} händelser`,
                  value: item.totalLeakageKg,
                  suffix: "kg",
                }))}
              />
            </VisualCard>

            <VisualCard title="Läckage per aggregat">
              <HorizontalBars
                emptyText="Inga läckage med mängd finns per aggregat."
                items={leakageData.byInstallation.map((item) => ({
                  href: `/dashboard/installations/${item.installationId}`,
                  label: item.label,
                  meta: item.location,
                  value: item.totalLeakageKg,
                  suffix: "kg",
                }))}
              />
            </VisualCard>

            <VisualCard title="Läckagehändelser per månad">
              <HorizontalBars
                emptyText="Inga läckagehändelser finns för valt år."
                items={leakageData.monthlyCounts.map((item) => ({
                  href: null,
                  label: item.label,
                  meta: "",
                  value: item.eventCount,
                  suffix: "st",
                }))}
              />
            </VisualCard>
          </section>

          <section className="mt-10">
            <div>
              <h2 className="text-xl font-semibold">Läckagehändelser</h2>
              <p className="mt-1 text-sm text-slate-700">
                Händelser utan angiven mängd räknas som läckagehändelser men
                ingår inte i kg- eller CO₂e-summor.
              </p>
            </div>

            {leakageData.events.length === 0 ? (
              <EmptyState text="Inga läckagehändelser registrerade för valt år." />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeader>Datum</TableHeader>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Plats</TableHeader>
                      <TableHeader>Köldmedium</TableHeader>
                      <TableHeader>Mängd kg</TableHeader>
                      <TableHeader>CO₂e ton</TableHeader>
                      <TableHeader>Anteckningar</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leakageData.events.map((event) => (
                      <tr className="hover:bg-slate-50" key={event.id}>
                        <TableCell>{formatDate(event.date)}</TableCell>
                        <TableCell>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                            href={`/dashboard/installations/${event.installationId}`}
                          >
                            {event.installationName}
                          </Link>
                        </TableCell>
                        <TableCell>{event.location}</TableCell>
                        <TableCell>{event.refrigerantType}</TableCell>
                        <TableCell>{formatOptionalNumber(event.leakageKg)}</TableCell>
                        <TableCell>{formatOptionalNumber(event.co2eTon)}</TableCell>
                        <TableCell>{event.notes || "-"}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-10">
            <div>
              <h2 className="text-xl font-semibold">Aggregat med läckage</h2>
              <p className="mt-1 text-sm text-slate-700">
                Summering per aggregat för valt år.
              </p>
            </div>

            {leakageData.byInstallation.length === 0 ? (
              <EmptyState text="Inga aggregat har läckagehändelser för valt år." />
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <TableHeader>Aggregat</TableHeader>
                      <TableHeader>Plats</TableHeader>
                      <TableHeader>Köldmedium</TableHeader>
                      <TableHeader>Antal läckage</TableHeader>
                      <TableHeader>Total mängd kg</TableHeader>
                      <TableHeader>CO₂e ton</TableHeader>
                      <TableHeader>Senaste läckage</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leakageData.byInstallation.map((item) => (
                      <tr className="hover:bg-slate-50" key={item.installationId}>
                        <TableCell>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                            href={`/dashboard/installations/${item.installationId}`}
                          >
                            {item.label}
                          </Link>
                        </TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>{item.refrigerantType}</TableCell>
                        <TableCell>{item.eventCount}</TableCell>
                        <TableCell>{formatNumber(item.totalLeakageKg)}</TableCell>
                        <TableCell>{formatNumber(item.totalCo2eTon)}</TableCell>
                        <TableCell>{formatOptionalDate(item.latestLeakage)}</TableCell>
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
  tone?: "neutral" | "red" | "amber"
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-white",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
  }[tone]

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold text-slate-950">
        {value}
      </div>
    </div>
  )
}

function VisualCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function HorizontalBars({
  items,
  emptyText,
}: {
  items: Array<{
    href: string | null
    label: string
    meta: string
    value: number
    suffix: string
  }>
  emptyText: string
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  if (items.length === 0 || maxValue === 0) {
    return <p className="text-sm text-slate-700">{emptyText}</p>
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const label = (
          <span className="font-semibold text-slate-800">{item.label}</span>
        )

        return (
          <div key={`${item.label}-${item.meta}`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 truncate">
                {item.href ? (
                  <Link className="underline-offset-4 hover:underline" href={item.href}>
                    {label}
                  </Link>
                ) : (
                  label
                )}
                {item.meta && <span className="ml-2 text-slate-600">{item.meta}</span>}
              </div>
              <span className="shrink-0 font-medium text-slate-700">
                {formatNumber(item.value)} {item.suffix}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-slate-800">{children}</td>
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
      {text}
    </div>
  )
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "-"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "-" : formatNumber(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
