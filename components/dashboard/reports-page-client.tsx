"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useMemo, useState } from "react"
import { Badge, Card, EmptyState as UiEmptyState, PageHeader, SectionHeader } from "@/components/ui"
import { getInstallationEventAmountLabel } from "@/lib/installation-events"
import {
  getReportTypeMetadata,
  isReportExportAvailable,
  REPORT_TYPE_OPTIONS,
  type ReportType,
  type ReportTypeMetadata,
} from "@/lib/reports/reportTypeMetadata"

type EventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"
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
    severity?: "blocking" | "review"
    message: string
    installationName?: string | null
  }>
  qualitySummary?: {
    status: "READY" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA"
    blockingIssueCount: number
    warningCount: number
    totalIssueCount: number
  }
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
    previousRefrigerantType?: string | null
    newRefrigerantType?: string | null
    previousAmountKg?: number | null
    newAmountKg?: number | null
    recoveredAmountKg?: number | null
    notes: string | null
  }>
}

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
}

type SignedReportHistoryItem = {
  id: string
  reportYear: number
  scopeSummary: string
  signerName: string
  signerRole: string
  signingDate: string
  readinessStatus: "READY" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA" | string
  blockingIssueCount: number
  reviewWarningCount: number
  createdAt: string
  regenerateHref: string
}

type SigningFormState = {
  signerName: string
  signerRole: string
  signingDate: string
  comment: string
  confirmed: boolean
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
const signingInputClassName =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
const signingTextareaClassName =
  "min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"

export default function ReportsPage() {
  const currentYear = new Date().getFullYear()
  const searchParams = useSearchParams()
  const [selectedYear, setSelectedYear] = useState(() =>
    parseInitialReportYear(searchParams.get("year"), currentYear)
  )
  const [selectedReportType, setSelectedReportType] =
    useState<ReportType>("annual")
  const [selectedMunicipality, setSelectedMunicipality] = useState("")
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    searchParams.get("propertyId") ?? ""
  )
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [signedReports, setSignedReports] = useState<SignedReportHistoryItem[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [signingForm, setSigningForm] = useState<SigningFormState>({
    signerName: "",
    signerRole: "",
    signingDate: formatDateInputValue(new Date()),
    comment: "",
    confirmed: false,
  })
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
    if (!isReportExportAvailable(selectedReportType)) {
      return null
    }

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
    () => getReportTypeMetadata(selectedReportType),
    [selectedReportType]
  )
  const canExportSelectedReport = pdfExportHref !== null
  const signedPdfExportHref = useMemo(
    () =>
      pdfExportHref === null
        ? ""
        : buildSignedAnnualPdfHref({
            baseHref: pdfExportHref,
            signingForm,
          }),
    [pdfExportHref, signingForm]
  )
  const canExportSigned =
    selectedReportType === "annual" &&
    signingForm.confirmed &&
    signingForm.signerName.trim().length > 0 &&
    signingForm.signerRole.trim().length > 0 &&
    signingForm.signingDate.trim().length > 0

  useEffect(() => {
    let isMounted = true

    async function fetchReport() {
      setIsLoading(true)
      setError("")

      const [response, propertiesResponse, signedReportsResponse] = await Promise.all([
        fetch(`/api/reports/fgas?${reportQuery}`, {
          credentials: "include",
        }),
        fetch("/api/properties", {
          credentials: "include",
        }),
        fetch("/api/reports/annual-fgas/history", {
          credentials: "include",
        }),
      ])

      if (
        response.status === 401 ||
        propertiesResponse.status === 401 ||
        signedReportsResponse.status === 401
      ) {
        router.push("/login")
        return
      }

      if (!response.ok || !propertiesResponse.ok || !signedReportsResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta årsrapporten")
        setIsLoading(false)
        return
      }

      const data: ReportData = await response.json()
      const propertiesData: PropertyOption[] = await propertiesResponse.json()
      const signedReportsData: SignedReportHistoryItem[] =
        await signedReportsResponse.json()

      if (!isMounted) return

      setReportData(data)
      setProperties(propertiesData)
      setSignedReports(signedReportsData)
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
              {canExportSelectedReport ? (
                <>
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
                </>
              ) : (
                <span
                  aria-disabled="true"
                  className={`${exportButtonClassName} cursor-not-allowed opacity-60`}
                >
                  Export planeras
                </span>
              )}
            </div>
          </div>
        }
        title={selectedReport.title}
        subtitle={selectedReport.subtitle}
      />
      <ReportModuleStatusPanel report={selectedReport} />

      {isLoading && <p className="mt-8 text-neutral-600">Laddar rapport...</p>}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {reportData && !isLoading && (
        <>
          {selectedReportType === "annual" && (
            <>
              <ReportQualityPanel reportData={reportData} />
              <ReportSigningPanel
                canExportSigned={canExportSigned}
                onChange={setSigningForm}
                signingForm={signingForm}
                signedPdfExportHref={signedPdfExportHref}
                status={reportData.qualitySummary?.status}
              />
              <SignedReportsHistory reports={signedReports} />
            </>
          )}
          {selectedReportType !== "annual" && (
            <PlannedReportPreview
              report={selectedReport}
              reportData={reportData}
            />
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

function ReportModuleStatusPanel({ report }: { report: ReportTypeMetadata }) {
  const toneClass = {
    FULL: "border-emerald-200 bg-emerald-50 text-emerald-800",
    PREVIEW: "border-sky-200 bg-sky-50 text-sky-800",
    PLANNED: "border-slate-200 bg-slate-50 text-slate-700",
  }[report.supportStatus]
  const description =
    report.supportStatus === "FULL"
      ? "Den här rapporttypen har färdigt rapportunderlag, export och signeringsstöd."
      : "Den här vyn visar befintliga nyckeltal som operativt underlag. Färdig rapportexport byggs ut i senare version."

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>{description}</p>
        <Badge className={toneClass} variant="neutral">
          {report.supportLabel}
        </Badge>
      </div>
    </section>
  )
}

function PlannedReportPreview({
  report,
  reportData,
}: {
  report: ReportTypeMetadata
  reportData: ReportData
}) {
  const previewMetrics = getPreviewMetrics(report.value, reportData)

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">
            {report.placeholderTitle ?? `${report.title} utökas i senare version`}
          </h2>
          <p className="mt-1 max-w-3xl text-slate-600">
            {report.placeholderDescription}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          PDF-export planeras
        </span>
      </div>
      {previewMetrics.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {previewMetrics.map((metric) => (
            <div
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              key={metric.label}
            >
              <div className="text-xs font-medium text-slate-500">
                {metric.label}
              </div>
              <div className="mt-1 font-semibold text-slate-950">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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

function ReportQualityPanel({ reportData }: { reportData: ReportData }) {
  const summary =
    reportData.qualitySummary ??
    buildClientQualitySummary(reportData.warnings ?? [])
  const tone =
    summary.status === "MISSING_REQUIRED_DATA"
      ? "border-red-200 bg-red-50 text-red-950"
      : summary.status === "HAS_WARNINGS"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950"
  const textTone =
    summary.status === "MISSING_REQUIRED_DATA"
      ? "text-red-800"
      : summary.status === "HAS_WARNINGS"
        ? "text-amber-900"
        : "text-emerald-800"
  const warnings = reportData.warnings ?? []

  return (
    <section className={`mt-6 rounded-lg border p-4 text-sm ${tone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">{qualityStatusLabel(summary.status)}</h2>
          <p className={`mt-1 ${textTone}`}>
            {qualityStatusDescription(summary.status)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs font-semibold sm:min-w-48">
          <div className="rounded-md bg-white/70 px-3 py-2">
            <div className="text-lg">{summary.blockingIssueCount}</div>
            <div>Kräver komplettering</div>
          </div>
          <div className="rounded-md bg-white/70 px-3 py-2">
            <div className="text-lg">{summary.warningCount}</div>
            <div>Bör granskas</div>
          </div>
        </div>
      </div>
      {warnings.length > 0 && (
        <>
          <ul className="mt-3 grid gap-1">
            {warnings.slice(0, 5).map((warning) => (
              <li key={warning.id}>
                <span className="font-semibold">
                  {warning.severity === "blocking" ? "Kräver komplettering: " : "Bör granskas: "}
                </span>
                {warning.installationName
                  ? `${warning.installationName}: ${warning.message}`
                  : warning.message}
              </li>
            ))}
          </ul>
          {warnings.length > 5 && (
            <p className="mt-2 font-medium">
              +{warnings.length - 5} fler punkter visas i PDF-underlaget.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function ReportSigningPanel({
  canExportSigned,
  onChange,
  signedPdfExportHref,
  signingForm,
  status,
}: {
  canExportSigned: boolean
  onChange: React.Dispatch<React.SetStateAction<SigningFormState>>
  signedPdfExportHref: string
  signingForm: SigningFormState
  status?: NonNullable<ReportData["qualitySummary"]>["status"]
}) {
  const hasQualityIssues =
    status === "MISSING_REQUIRED_DATA" || status === "HAS_WARNINGS"

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Intygande inför signerad export</h2>
          <p className="mt-1 text-slate-600">
            Lägg till ansvarig person i PDF:en. Detta är inte BankID eller en extern e-signatur.
          </p>
        </div>
        {hasQualityIssues && (
          <p className="max-w-md rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            Rapporten innehåller uppgifter som bör kompletteras eller granskas innan den skickas till kommunen.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className={filterLabelClassName}>
          Signeras av
          <input
            className={signingInputClassName}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                signerName: event.target.value,
              }))
            }
            value={signingForm.signerName}
          />
        </label>
        <label className={filterLabelClassName}>
          Roll/titel
          <input
            className={signingInputClassName}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                signerRole: event.target.value,
              }))
            }
            value={signingForm.signerRole}
          />
        </label>
        <label className={filterLabelClassName}>
          Signeringsdatum
          <input
            className={signingInputClassName}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                signingDate: event.target.value,
              }))
            }
            type="date"
            value={signingForm.signingDate}
          />
        </label>
      </div>

      <label className={`${filterLabelClassName} mt-3`}>
        Kommentar
        <textarea
          className={signingTextareaClassName}
          maxLength={1000}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              comment: event.target.value,
            }))
          }
          value={signingForm.comment}
        />
      </label>

      <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex gap-2 text-sm font-medium text-slate-700">
          <input
            checked={signingForm.confirmed}
            className="mt-1 h-4 w-4 rounded border-slate-300"
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                confirmed: event.target.checked,
              }))
            }
            type="checkbox"
          />
          <span>
            Jag intygar att uppgifterna i rapporten är granskade utifrån tillgängliga underlag.
          </span>
        </label>
        <a
          aria-disabled={!canExportSigned}
          className={`${exportButtonClassName} ${
            canExportSigned
              ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              : "pointer-events-none opacity-50"
          }`}
          href={canExportSigned ? signedPdfExportHref : undefined}
        >
          Exportera signerad PDF
        </a>
      </div>
    </section>
  )
}

function SignedReportsHistory({
  reports,
}: {
  reports: SignedReportHistoryItem[]
}) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-900">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold">Signerade rapporter</h2>
          <p className="text-slate-600">
            PDF återskapas utifrån nuvarande systemdata och sparad signeringsinformation.
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-4 text-slate-600">
          Inga signerade årsrapporter finns ännu.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <TableHeader>År</TableHeader>
                <TableHeader>Omfattning</TableHeader>
                <TableHeader>Signerad av</TableHeader>
                <TableHeader>Signeringsdatum</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Skapad</TableHeader>
                <TableHeader>Åtgärd</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reports.map((report) => (
                <tr key={report.id}>
                  <TableCell>{report.reportYear}</TableCell>
                  <TableCell>{report.scopeSummary}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-950">
                      {report.signerName}
                    </div>
                    <div className="text-xs text-slate-600">{report.signerRole}</div>
                  </TableCell>
                  <TableCell>{formatDate(report.signingDate)}</TableCell>
                  <TableCell>
                    <div>{qualityStatusLabel(report.readinessStatus as NonNullable<ReportData["qualitySummary"]>["status"]).replace("Rapportstatus: ", "")}</div>
                    <div className="text-xs text-slate-600">
                      {report.blockingIssueCount} kräver komplettering,{" "}
                      {report.reviewWarningCount} bör granskas
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(report.createdAt)}</TableCell>
                  <TableCell>
                    <a
                      className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      href={report.regenerateHref}
                    >
                      Återskapa PDF
                    </a>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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

function getPreviewMetrics(reportType: ReportType, reportData: ReportData) {
  const metrics = reportData.metrics

  switch (reportType) {
    case "climate":
      return [
        { label: "Installerad CO₂e", value: formatTotalCo2eTon(metrics) },
        { label: "Läckagehändelser i år", value: metrics.leakageEvents },
        {
          label: "Påfylld mängd i år",
          value: `${formatNumber(metrics.refilledAmountKg)} kg`,
        },
        {
          label: "Okända CO₂e-värden",
          value: metrics.unknownCo2eInstallations,
        },
      ]
    case "compliance":
      return [
        { label: "Kontrollpliktiga aggregat", value: metrics.requiringInspection },
        { label: "Utförda kontroller i år", value: metrics.inspectionsPerformed },
        { label: "Servicehändelser i år", value: metrics.serviceEvents },
      ]
    case "risk":
      return [
        { label: "Aggregat i urvalet", value: metrics.totalInstallations },
        { label: "Kontrollpliktiga aggregat", value: metrics.requiringInspection },
        {
          label: "Läckagehändelser i år",
          value: metrics.leakageEvents,
        },
      ]
    case "refrigerants":
      return [
        { label: "Köldmedier i urvalet", value: reportData.refrigerants.length },
        {
          label: "Total köldmediemängd",
          value: `${formatNumber(metrics.totalRefrigerantAmountKg)} kg`,
        },
        { label: "Installerad CO₂e", value: formatTotalCo2eTon(metrics) },
      ]
    case "annual":
    default:
      return []
  }
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
function buildSignedAnnualPdfHref({
  baseHref,
  signingForm,
}: {
  baseHref: string
  signingForm: SigningFormState
}) {
  const params = new URLSearchParams(baseHref.split("?")[1] ?? "")

  params.set("signed", "1")
  params.set("signerName", signingForm.signerName.trim())
  params.set("signerRole", signingForm.signerRole.trim())
  params.set("signingDate", signingForm.signingDate)
  if (signingForm.comment.trim()) {
    params.set("signingComment", signingForm.comment.trim())
  } else {
    params.delete("signingComment")
  }

  return `/api/reports/annual-fgas?${params.toString()}`
}

function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseInitialReportYear(value: string | null, currentYear: number) {
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return currentYear
  }

  return year
}

function buildClientQualitySummary(warnings: NonNullable<ReportData["warnings"]>) {
  const blockingIssueCount = warnings.filter(
    (warning) => warning.severity === "blocking"
  ).length
  const warningCount = warnings.length - blockingIssueCount

  return {
    status:
      blockingIssueCount > 0
        ? "MISSING_REQUIRED_DATA"
        : warningCount > 0
          ? "HAS_WARNINGS"
          : "READY",
    blockingIssueCount,
    warningCount,
    totalIssueCount: warnings.length,
  } satisfies NonNullable<ReportData["qualitySummary"]>
}

function qualityStatusLabel(
  status: NonNullable<ReportData["qualitySummary"]>["status"]
) {
  return {
    READY: "Rapportstatus: Redo",
    HAS_WARNINGS: "Rapportstatus: Bör granskas",
    MISSING_REQUIRED_DATA: "Rapportstatus: Kräver komplettering",
  }[status]
}

function qualityStatusDescription(
  status: NonNullable<ReportData["qualitySummary"]>["status"]
) {
  return {
    READY: "Inga kända kompletteringspunkter finns i rapportunderlaget.",
    HAS_WARNINGS:
      "Rapporten kan skapas, men uppgifterna bör kontrolleras innan den skickas till tillsynsmyndigheten.",
    MISSING_REQUIRED_DATA:
      "Rapporten kan skapas, men vissa uppgifter bör kompletteras innan den skickas till kommunen.",
  }[status]
}
