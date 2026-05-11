"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useState } from "react"
import { Badge, Card, EmptyState as UiEmptyState, PageHeader, SectionHeader } from "@/components/ui"
import { getInstallationEventAmountLabel } from "@/lib/installation-events"

type EventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"
type ReportType =
  | "annual"
  | "climate"
  | "compliance"
  | "risk"
  | "refrigerants"

type ReportData = {
  year: number
  metrics: {
    totalInstallations: number
    totalRefrigerantAmountKg: number
    totalCo2eTon: number | null
    knownCo2eTon: number
    unknownCo2eInstallations: number
    requiringInspection: number
    inspectionsPerformed: number
    leakageEvents: number
    refilledAmountKg: number
    serviceEvents: number
  }
  warnings?: Array<{
    id: string
    message: string
    installationName?: string | null
  }>
  refrigerants: Array<{
    refrigerantType: string
    installationCount: number
    totalAmountKg: number
    totalCo2eTon: number | null
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
  REPAIR: "Reparation",
  RECOVERY: "Tömning / Återvinning",
  REFRIGERANT_CHANGE: "Byte av köldmedium",
}

const EVENT_TONE: Record<EventType, string> = {
  INSPECTION: "border-sky-200 bg-sky-50 text-sky-800",
  LEAK: "border-red-200 bg-red-50 text-red-800",
  REFILL: "border-amber-200 bg-amber-50 text-amber-800",
  SERVICE: "border-neutral-200 bg-neutral-50 text-neutral-700",
  REPAIR: "border-violet-200 bg-violet-50 text-violet-800",
  RECOVERY: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REFRIGERANT_CHANGE: "border-cyan-200 bg-cyan-50 text-cyan-800",
}

const REPORT_TYPE_OPTIONS: Array<{
  value: ReportType
  label: string
  title: string
  subtitle: string
  contextTitle: string
}> = [
  {
    value: "annual",
    label: "Årsrapport enligt F-gasförordningen",
    title: "F-gas årsrapport",
    subtitle:
      "Årssammanställning av aggregat, kontrollhändelser, läckagehändelser, påfyllningar och klimatpåverkan.",
    contextTitle: "Rapportunderlag",
  },
  {
    value: "climate",
    label: "Klimatpåverkan",
    title: "Klimatpåverkan",
    subtitle:
      "Översikt över CO₂e, köldmedier, läckage och påfyllningar för valt urval.",
    contextTitle: "Klimat- och läckageunderlag",
  },
  {
    value: "compliance",
    label: "Kontrollstatus",
    title: "Kontrollstatus",
    subtitle:
      "Underlag för uppföljning av kontrollplikt, utförda kontroller och status.",
    contextTitle: "Kontroll- och serviceunderlag",
  },
  {
    value: "risk",
    label: "Högriskaggregat",
    title: "Högriskaggregat",
    subtitle:
      "Rapportvy för prioritering av aggregat med hög risk och försenade kontroller.",
    contextTitle: "Prioriteringsunderlag",
  },
  {
    value: "refrigerants",
    label: "Köldmediesammanställning",
    title: "Köldmediesammanställning",
    subtitle:
      "Summering per köldmedium med mängder, CO₂e, påfyllningar och läckage.",
    contextTitle: "Köldmedieunderlag",
  },
]

const METRIC_HELP = {
  totalInstallations: "Antal aktiva aggregat som ingår i rapporten.",
  totalCo2eTon: "Samlad klimatpåverkan från aggregaten i rapporten.",
  requiringInspection: "Aggregat som omfattas av lagstadgad läckagekontroll.",
  inspectionsPerformed: "Utförda kontrollhändelser under valt år.",
  leakageEvents: "Registrerade läckagehändelser under valt år.",
  refilledAmountKg: "Total påfylld mängd köldmedium under valt år.",
  serviceEvents: "Registrerade servicehändelser under valt år.",
} as const

const filterLabelClassName = "grid gap-1 text-sm font-semibold text-slate-700"
const filterSelectClassName =
  "h-9 w-full min-w-0 truncate rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
const yearInputClassName =
  "h-9 w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
const exportButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"

export default function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("annual")
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
      reportType: selectedReportType,
      year: String(selectedYear),
    })

    if (selectedMunicipality) params.set("municipality", selectedMunicipality)
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId)

    return params.toString()
  }, [selectedMunicipality, selectedPropertyId, selectedReportType, selectedYear])
  const pdfExportHref = useMemo(() => {
    if (selectedReportType !== "annual") {
      return `/api/reports/fgas/export?${reportQuery}&format=pdf`
    }

    const params = new URLSearchParams({
      year: String(selectedYear),
    })

    if (selectedMunicipality) params.set("municipality", selectedMunicipality)
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId)

    return `/api/reports/annual-fgas?${params.toString()}`
  }, [reportQuery, selectedMunicipality, selectedPropertyId, selectedReportType, selectedYear])
  const selectedReport = useMemo(
    () =>
      REPORT_TYPE_OPTIONS.find((option) => option.value === selectedReportType) ??
      REPORT_TYPE_OPTIONS[0],
    [selectedReportType]
  )

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
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(320px,2fr)_96px_minmax(160px,1fr)_minmax(160px,1fr)]">
              <label className={`${filterLabelClassName} min-w-0`}>
                Rapporttyp
                <select
                  className={filterSelectClassName}
                  onChange={(event) =>
                    setSelectedReportType(event.target.value as ReportType)
                  }
                  value={selectedReportType}
                >
                  {REPORT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={filterLabelClassName}>
                År
                <input
                  className={yearInputClassName}
                  max={currentYear + 1}
                  min={2000}
                  onChange={(event) => {
                    if (!event.target.value) return
                    const year = Number(event.target.value)
                    if (
                      Number.isInteger(year) &&
                      year >= 2000 &&
                      year <= currentYear + 1
                    ) {
                      setSelectedYear(year)
                    }
                  }}
                  type="number"
                  value={selectedYear}
                />
              </label>
              <label className={`${filterLabelClassName} min-w-0`}>
                Kommun
                <select
                  className={filterSelectClassName}
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
              <label className={`${filterLabelClassName} min-w-0`}>
                Fastighet
                <select
                  className={filterSelectClassName}
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
            </div>
            <div className="flex flex-wrap justify-start gap-2 border-t border-slate-200 pt-3 lg:justify-end">
              <a
                className={exportButtonClassName}
                href={`/api/reports/fgas/export?${reportQuery}&format=csv`}
              >
                Exportera Excel
              </a>
              <a
                className={exportButtonClassName}
                href={pdfExportHref}
              >
                Exportera PDF
              </a>
            </div>
          </div>
        }
        title={selectedReport.title}
        subtitle={selectedReport.subtitle}
      />

      {isLoading && <p className="mt-8 text-neutral-600">Laddar rapport...</p>}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {reportData && !isLoading && (
        <>
          {selectedReportType === "annual" &&
            reportData.warnings &&
            reportData.warnings.length > 0 && (
            <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="font-semibold">Rapportunderlag att kontrollera</h2>
              <p className="mt-1 text-amber-900">
                Rapporten kan skapas, men följande uppgifter bör kontrolleras innan den skickas till tillsynsmyndigheten.
              </p>
              <ul className="mt-3 grid gap-1">
                {reportData.warnings.slice(0, 5).map((warning) => (
                  <li key={warning.id}>
                    {warning.installationName
                      ? `${warning.installationName}: ${warning.message}`
                      : warning.message}
                  </li>
                ))}
              </ul>
              {reportData.warnings.length > 5 && (
                <p className="mt-2 font-medium">
                  +{reportData.warnings.length - 5} fler varningar visas i PDF-underlaget.
                </p>
              )}
            </section>
          )}

          <section className="mt-8 grid gap-4 md:grid-cols-3">
            <MetricCard
              description={METRIC_HELP.totalInstallations}
              label="Totalt antal aggregat"
              value={reportData.metrics.totalInstallations}
            />
            <MetricCard
              description={METRIC_HELP.totalCo2eTon}
              label="Total CO₂e"
              value={formatTotalCo2eTon(reportData.metrics)}
            />
            <MetricCard
              description={METRIC_HELP.requiringInspection}
              label="Kontrollpliktiga aggregat"
              value={reportData.metrics.requiringInspection}
            />
          </section>

          <section className="mt-8">
            <SectionHeader
              title={selectedReport.contextTitle}
              subtitle="Kompletterande nyckeltal för valt år, kommun och fastighet."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                description={METRIC_HELP.inspectionsPerformed}
                label="Utförda kontroller under året"
                value={reportData.metrics.inspectionsPerformed}
                tone="sky"
              />
              <MetricCard
                description={METRIC_HELP.leakageEvents}
                label="Läckagehändelser under året"
                value={reportData.metrics.leakageEvents}
                tone="red"
              />
              <MetricCard
                description={METRIC_HELP.refilledAmountKg}
                label="Påfylld mängd köldmedium"
                value={`${formatNumber(reportData.metrics.refilledAmountKg)} kg`}
                tone="amber"
              />
              <MetricCard
                description={METRIC_HELP.serviceEvents}
                label="Servicehändelser under året"
                value={reportData.metrics.serviceEvents}
              />
            </div>
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
                        <TableCell>{formatCo2eTon(item.totalCo2eTon)}</TableCell>
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
                      <TableHeader>Mängd</TableHeader>
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
                            : `${getEventAmountLabel(event.type)}: ${formatNumber(event.refrigerantAddedKg)} kg`}
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
  description,
  label,
  value,
  tone = "neutral",
}: {
  description: string
  label: string
  value: number | string
  tone?: "neutral" | "sky" | "red" | "amber"
}) {
  const tooltipId = useId()
  const toneClass = {
    neutral: "border-neutral-200 bg-white",
    sky: "border-sky-200 bg-sky-50",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
  }[tone]

  return (
    <Card
      aria-describedby={tooltipId}
      className={`group relative p-4 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${toneClass}`}
      tabIndex={0}
    >
      <div className="text-sm font-medium text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
      <div
        className="pointer-events-none absolute left-3 right-3 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {description}
      </div>
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

function formatCo2eTon(value: number | null) {
  return value === null ? "Okänt GWP-värde" : formatNumber(value)
}

function formatTotalCo2eTon(metrics: ReportData["metrics"]) {
  if (metrics.totalCo2eTon !== null) {
    return `${formatNumber(metrics.totalCo2eTon)} ton`
  }

  return `Ej fullständig (${formatNumber(metrics.knownCo2eTon)} ton känd)`
}

function getEventAmountLabel(type: EventType) {
  return getInstallationEventAmountLabel(type) ?? "Mängd"
}
