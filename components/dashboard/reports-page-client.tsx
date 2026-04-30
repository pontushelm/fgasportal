"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, buttonClassName, Card, EmptyState as UiEmptyState, PageHeader, SectionHeader } from "@/components/ui"

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

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
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
  const [selectedMunicipality, setSelectedMunicipality] = useState("")
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()
  const municipalityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .map((property) => property.municipality)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((first, second) => first.localeCompare(second, "sv")),
    [properties]
  )
  const reportQuery = useMemo(() => {
    const params = new URLSearchParams({
      year: String(selectedYear),
    })

    if (selectedMunicipality) params.set("municipality", selectedMunicipality)
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId)

    return params.toString()
  }, [selectedMunicipality, selectedPropertyId, selectedYear])

  useEffect(() => {
    let isMounted = true

    async function fetchReport() {
      setIsLoading(true)
      setError("")

      const [response, propertiesResponse] = await Promise.all([
        fetch(`/api/reports/fgas?${reportQuery}`, {
          credentials: "include",
        }),
        fetch("/api/properties", {
          credentials: "include",
        }),
      ])

      if (response.status === 401 || propertiesResponse.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok || !propertiesResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta årsrapporten")
        setIsLoading(false)
        return
      }

      const data: ReportData = await response.json()
      const propertiesData: PropertyOption[] = await propertiesResponse.json()

      if (!isMounted) return

      setReportData(data)
      setProperties(propertiesData)
      setIsLoading(false)
    }

    void fetchReport()

    return () => {
      isMounted = false
    }
  }, [reportQuery, router])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-neutral-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          <>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              År
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Kommun
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                onChange={(event) => {
                  setSelectedMunicipality(event.target.value)
                  setSelectedPropertyId("")
                }}
                value={selectedMunicipality}
              >
                <option value="">Alla kommuner</option>
                {municipalityOptions.map((municipality) => (
                  <option key={municipality} value={municipality}>
                    {municipality}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              Fastighet
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                value={selectedPropertyId}
              >
                <option value="">Alla fastigheter</option>
                {properties
                  .filter((property) =>
                    selectedMunicipality
                      ? property.municipality === selectedMunicipality
                      : true
                  )
                  .map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
              </select>
            </label>
            <a
              className={buttonClassName({ variant: "primary" })}
              href={`/api/reports/fgas/export?${reportQuery}&format=csv`}
            >
              Exportera CSV
            </a>
            <a
              className={buttonClassName({ variant: "secondary" })}
              href={`/api/reports/fgas/export?${reportQuery}&format=pdf`}
            >
              Exportera PDF
            </a>
          </>
        }
        backHref="/dashboard"
        backLabel="Till dashboard"
        eyebrow="Rapportering"
        title="F-gas årsrapport"
        subtitle="Årssammanställning av aggregat, kontrollhändelser, läckagehändelser, påfyllningar och klimatpåverkan."
      />
      <div className="hidden flex-col gap-4 border-b border-neutral-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
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
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Kommun
            <select
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => {
                setSelectedMunicipality(event.target.value)
                setSelectedPropertyId("")
              }}
              value={selectedMunicipality}
            >
              <option value="">Alla kommuner</option>
              {municipalityOptions.map((municipality) => (
                <option key={municipality} value={municipality}>
                  {municipality}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-neutral-700">
            Fastighet
            <select
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              value={selectedPropertyId}
            >
              <option value="">Alla fastigheter</option>
              {properties
                .filter((property) =>
                  selectedMunicipality
                    ? property.municipality === selectedMunicipality
                    : true
                )
                .map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
            </select>
          </label>
          <a
            className={buttonClassName({ variant: "primary" })}
            href={`/api/reports/fgas/export?${reportQuery}&format=csv`}
          >
            Exportera CSV
          </a>
          <a
            className={buttonClassName({ variant: "secondary" })}
            href={`/api/reports/fgas/export?${reportQuery}&format=pdf`}
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
            <SectionHeader
              title="Köldmediesammanställning"
              subtitle="Summerat per köldmedium för aktiva, ej arkiverade aggregat."
            />

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
            <SectionHeader
              title="Händelser under året"
              subtitle="Senaste kontroll-, läckage-, påfyllnings- och servicehändelser för valt år."
            />

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
    <Card className={`p-4 ${toneClass}`}>
      <div className="text-sm font-medium text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
    </Card>
  )
}

function EventBadge({ type }: { type: EventType }) {
  const variant = type === "LEAK" ? "danger" : type === "REFILL" ? "warning" : type === "INSPECTION" ? "info" : "neutral"

  return (
    <Badge className={EVENT_TONE[type]} variant={variant}>
      {EVENT_LABELS[type]}
    </Badge>
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
  return <UiEmptyState className="mt-5" description={text} />
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
