"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Badge, Card, EmptyState as UiEmptyState, PageHeader, SectionHeader, Toast } from "@/components/ui"
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
  annualReportOverview?: {
    year: number
    properties: Array<{
      id: string
      name: string
      municipality: string | null
      installedCo2eTon: number | null
      annualReportRequirement: "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
      signedStatus: "SIGNED" | "NOT_SIGNED"
      signedAt: string | null
      blockingIssueCount: number
      reviewWarningCount: number
    }>
  }
}
type AnnualReportOverview = NonNullable<ReportData["annualReportOverview"]>
type AnnualOverviewProperty = AnnualReportOverview["properties"][number]
type SortDirection = "asc" | "desc"
type AnnualOverviewSortKey =
  | "property"
  | "municipality"
  | "co2e"
  | "requirement"
  | "signing"
  | "status"

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

type ExportFeedback = {
  type: "success" | "error"
  title: string
  message: string
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
  const annualReportOverviewRef = useRef<AnnualReportOverview | null>(null)
  const propertiesRef = useRef<PropertyOption[]>([])
  const hasLoadedPropertiesRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [reportNotes, setReportNotes] = useState("")
  const [isAnnualExportModalOpen, setIsAnnualExportModalOpen] = useState(false)
  const [isAnnualPdfExporting, setIsAnnualPdfExporting] = useState(false)
  const [annualPdfExportMode, setAnnualPdfExportMode] = useState<"signed" | "unsigned" | null>(null)
  const [annualPdfExportError, setAnnualPdfExportError] = useState("")
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | null>(null)
  const router = useRouter()
  const isAnnualReport = selectedReportType === "annual"
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

    if (selectedMunicipality && !isAnnualReport) {
      params.set("municipality", selectedMunicipality)
    }
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId)

    return params.toString()
  }, [isAnnualReport, selectedMunicipality, selectedPropertyId, selectedReportType, selectedYear])
  const pdfExportHref = useMemo(() => {
    if (!isReportExportAvailable(selectedReportType)) {
      return null
    }

    if (!isAnnualReport) {
      return `/api/reports/fgas/export?${reportQuery}&format=pdf`
    }

    if (!selectedPropertyId) return null

    const params = new URLSearchParams({
      year: String(selectedYear),
    })

    if (selectedPropertyId) params.set("propertyId", selectedPropertyId)
    return `/api/reports/annual-fgas?${params.toString()}`
  }, [isAnnualReport, reportQuery, selectedPropertyId, selectedReportType, selectedYear])
  const selectedReport = useMemo(
    () => getReportTypeMetadata(selectedReportType),
    [selectedReportType]
  )
  const canExportSelectedReport =
    isReportExportAvailable(selectedReportType) &&
    (!isAnnualReport || Boolean(selectedPropertyId))
  const shouldShowReportDetails = !isAnnualReport || Boolean(selectedPropertyId)
  function dismissExportFeedback() {
    setExportFeedback(null)
  }

  async function refreshSignedReportsHistory() {
    const response = await fetch(`/api/reports/annual-fgas/history?${reportQuery}`, {
      credentials: "include",
    })

    if (response.ok) {
      const signedReportsData: SignedReportHistoryItem[] = await response.json()
      setSignedReports(signedReportsData)
    }
  }

  async function handleAnnualPdfExport(signed: boolean) {
    if (!pdfExportHref || isAnnualPdfExporting) return

    setAnnualPdfExportError("")
    setAnnualPdfExportMode(signed ? "signed" : "unsigned")
    setIsAnnualPdfExporting(true)

    try {
      const exportHref = buildAnnualPdfExportHref({
        baseHref: pdfExportHref,
        reportNotes,
        signed,
      })
      const response = await fetch(exportHref, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        throw new Error("PDF export failed")
      }

      const blob = await response.blob()
      downloadBlob(blob, getFilenameFromContentDisposition(response.headers.get("Content-Disposition")) ?? `fgas-arsrapport-${selectedYear}.pdf`)

      setIsAnnualExportModalOpen(false)
      setExportFeedback({
        type: "success",
        title: "Klart",
        message: signed ? "Signerad PDF-export är klar." : "PDF-exporten är klar.",
      })

      if (signed) {
        void refreshSignedReportsHistory()
      }
    } catch (error) {
      console.error("Annual PDF export error:", error)
      setAnnualPdfExportError("Kunde inte exportera PDF. Försök igen.")
      setExportFeedback({
        type: "error",
        title: "Kunde inte exportera PDF",
        message: "Kunde inte exportera PDF. Försök igen.",
      })
    } finally {
      setIsAnnualPdfExporting(false)
      setAnnualPdfExportMode(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function fetchReport() {
      const canReuseAnnualOverview =
        isAnnualReport && selectedPropertyId && annualReportOverviewRef.current
      const requestParams = new URLSearchParams(reportQuery)
      const shouldFetchProperties = !hasLoadedPropertiesRef.current

      if (canReuseAnnualOverview) {
        requestParams.set("includeAnnualOverview", "0")
        setIsDetailLoading(true)
      } else {
        setIsLoading(true)
      }
      setError("")

      const [response, propertiesResponse, signedReportsResponse] = await Promise.all([
        fetch(`/api/reports/fgas?${requestParams.toString()}`, {
          credentials: "include",
        }),
        shouldFetchProperties
          ? fetch("/api/properties", {
              credentials: "include",
            })
          : Promise.resolve(null),
        fetch(`/api/reports/annual-fgas/history?${reportQuery}`, {
          credentials: "include",
        }),
      ])

      if (
        response.status === 401 ||
        propertiesResponse?.status === 401 ||
        signedReportsResponse.status === 401
      ) {
        router.push("/login")
        return
      }

      if (!response.ok || propertiesResponse?.ok === false || !signedReportsResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta årsrapporten")
        setIsLoading(false)
        setIsDetailLoading(false)
        return
      }

      const data: ReportData = await response.json()
      const propertiesData: PropertyOption[] = propertiesResponse
        ? await propertiesResponse.json()
        : propertiesRef.current
      const signedReportsData: SignedReportHistoryItem[] =
        await signedReportsResponse.json()

      if (!isMounted) return

      if (data.annualReportOverview) {
        annualReportOverviewRef.current = data.annualReportOverview
      } else if (annualReportOverviewRef.current) {
        data.annualReportOverview = annualReportOverviewRef.current
      }
      setReportData(data)
      if (propertiesResponse) {
        propertiesRef.current = propertiesData
        hasLoadedPropertiesRef.current = true
        setProperties(propertiesData)
      }
      setSignedReports(signedReportsData)
      setIsLoading(false)
      setIsDetailLoading(false)
    }

    void fetchReport()

    return () => {
      isMounted = false
    }
  }, [isAnnualReport, reportQuery, router, selectedPropertyId])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-neutral-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          <div className="flex flex-col gap-3">
            <div className={`grid gap-3 sm:grid-cols-2 ${
              isAnnualReport
                ? "xl:grid-cols-[minmax(320px,2fr)_96px_minmax(220px,1fr)]"
                : "xl:grid-cols-[minmax(320px,2fr)_96px_minmax(160px,1fr)_minmax(160px,1fr)]"
            }`}>
              <label className={`${filterLabelClassName} min-w-0`}>
                Rapporttyp
                <select
                  className={filterSelectClassName}
                  onChange={(event) => {
                    const nextReportType = event.target.value as ReportType
                    setSelectedReportType(nextReportType)
                    if (nextReportType === "annual") {
                      setSelectedMunicipality("")
                    }
                  }}
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
              {!isAnnualReport && (
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
              )}
              <label className={`${filterLabelClassName} min-w-0`}>
                Fastighet
                <select
                  className={filterSelectClassName}
                  onChange={(event) => setSelectedPropertyId(event.target.value)}
                  value={selectedPropertyId}
                >
                  {isAnnualReport ? (
                    <option value="">Välj fastighet</option>
                  ) : (
                    <option value="">Alla fastigheter</option>
                  )}
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
              {isReportExportAvailable(selectedReportType) ? (
                <>
                  {!isAnnualReport && (
                    <a
                      className={exportButtonClassName}
                      href={`/api/reports/fgas/export?${reportQuery}&format=csv`}
                    >
                      Exportera Excel
                    </a>
                  )}
                  {isAnnualReport ? (
                    <button
                      className={`${exportButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={!canExportSelectedReport}
                      onClick={() => setIsAnnualExportModalOpen(true)}
                      type="button"
                    >
                      Exportera PDF
                    </button>
                  ) : (
                    <a
                      className={exportButtonClassName}
                      href={pdfExportHref ?? ""}
                    >
                      Exportera PDF
                    </a>
                  )}
                  {isAnnualReport && !selectedPropertyId && (
                    <span className="self-center text-xs font-medium text-slate-600">
                      Välj en fastighet för att exportera årsrapport.
                    </span>
                  )}
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
      {selectedReportType !== "annual" && (
        <ReportModuleStatusPanel report={selectedReport} />
      )}

      {isLoading && <ReportsLoadingSkeleton isAnnualReport={isAnnualReport} />}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {reportData && !isLoading && (
        <>
          {selectedReportType === "annual" && (
            <>
              {reportData.annualReportOverview && (
                <AnnualReportPropertyOverview
                  overview={reportData.annualReportOverview}
                  selectedPropertyId={selectedPropertyId}
                  onSelectProperty={setSelectedPropertyId}
                />
              )}
              {selectedPropertyId ? (
                <>
                  {isDetailLoading && (
                    <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-900">
                      Laddar rapportstatus för vald fastighet...
                    </section>
                  )}
                  <ReportQualityPanel reportData={reportData} />
                </>
              ) : (
                <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
                  Välj en fastighet i översikten för att se rapportstatus och exportera årsrapport.
                </section>
              )}
            </>
          )}
          {selectedReportType !== "annual" && (
            <PlannedReportPreview
              report={selectedReport}
              reportData={reportData}
            />
          )}

          {shouldShowReportDetails && (
            <>
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
              subtitle="Summerat per köldmedium för kontrollpliktiga aggregat."
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

            <ReportEventsPreview key={reportQuery} events={reportData.events} />
          </section>
            </>
          )}

          {selectedReportType === "annual" && (
            <SignedReportsHistory key={reportQuery} reports={signedReports} />
          )}
        </>
      )}
      {isAnnualExportModalOpen && selectedReportType === "annual" && (
        <AnnualPdfExportModal
          error={annualPdfExportError}
          exportMode={annualPdfExportMode}
          isExporting={isAnnualPdfExporting}
          onClose={() => {
            if (!isAnnualPdfExporting) setIsAnnualExportModalOpen(false)
          }}
          onExport={handleAnnualPdfExport}
          onReportNotesChange={setReportNotes}
          reportNotes={reportNotes}
          status={reportData?.qualitySummary?.status}
        />
      )}
      {exportFeedback && (
        <Toast onClose={dismissExportFeedback} toast={exportFeedback} />
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

function ReportsLoadingSkeleton({ isAnnualReport }: { isAnnualReport: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-8">
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Laddar rapport...</p>
        <p className="mt-1 text-sm text-slate-600">
          Hämtar underlag och sammanställer rapportstatus.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock className="h-28 rounded-xl" key={index} />
          ))}
        </div>
      </Card>

      {isAnnualReport ? (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <SkeletonBlock className="h-6 w-48" />
              <SkeletonBlock className="mt-2 h-4 w-72 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-28 rounded-full" />
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.7fr)_minmax(8rem,0.8fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)] gap-0 bg-slate-50 px-4 py-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock className="h-3 w-4/5" key={index} />
              ))}
            </div>
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div
                  className="grid grid-cols-[minmax(14rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.7fr)_minmax(8rem,0.8fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)] gap-0 px-4 py-3"
                  key={rowIndex}
                >
                  {Array.from({ length: 6 }).map((__, cellIndex) => (
                    <SkeletonBlock className="h-4 w-4/5" key={cellIndex} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <SkeletonBlock className="h-6 w-56" />
          <SkeletonBlock className="mt-2 h-4 w-96 max-w-full" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock className="h-28 rounded-xl" key={index} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SkeletonBlock className="h-6 w-56" />
        <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="divide-y divide-slate-200">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="grid grid-cols-4 gap-4 px-4 py-3" key={index}>
                <SkeletonBlock className="h-4 w-4/5" />
                <SkeletonBlock className="h-4 w-3/5" />
                <SkeletonBlock className="h-4 w-3/5" />
                <SkeletonBlock className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded bg-slate-200/80 ${className}`}
    />
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
    <Card className={`relative p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-medium text-neutral-600">{label}</div>
        <span className="group/help relative inline-flex">
          <button
            aria-describedby={tooltipId}
            aria-label={`Visa hjälptext för ${label}`}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            type="button"
          >
            i
          </button>
          <span
            className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus-within/help:opacity-100"
            id={tooltipId}
            role="tooltip"
          >
            {description}
          </span>
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-neutral-950">{value}</div>
    </Card>
  )
}

function AnnualReportPropertyOverview({
  onSelectProperty,
  overview,
  selectedPropertyId,
}: {
  onSelectProperty: (propertyId: string) => void
  overview: NonNullable<ReportData["annualReportOverview"]>
  selectedPropertyId: string
}) {
  const [sort, setSort] = useState<{
    key: AnnualOverviewSortKey | ""
    direction: SortDirection | ""
  }>({ key: "", direction: "" })
  const [showAllRows, setShowAllRows] = useState(false)
  const sortedProperties = useMemo(
    () => sortAnnualOverviewProperties(overview.properties, sort.key, sort.direction),
    [overview.properties, sort.direction, sort.key]
  )
  const visibleProperties = showAllRows
    ? sortedProperties
    : sortedProperties.slice(0, 5)

  function updateSort(sortKey: AnnualOverviewSortKey) {
    setSort((current) => {
      if (current.key !== sortKey || !current.direction) {
        return { key: sortKey, direction: "asc" }
      }
      if (current.direction === "asc") {
        return { key: sortKey, direction: "desc" }
      }
      return { key: "", direction: "" }
    })
  }

  if (overview.properties.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-950">
          Årsrapportering {overview.year}
        </h2>
        <EmptyState text="Inga fastigheter med aggregat finns för valt år." />
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Årsrapportering {overview.year}
          </h2>
          <p className="text-sm text-slate-600">
            Välj fastighet för export och signering av årsrapport.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {overview.properties.length} fastigheter
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="property"
              >
                Fastighet
              </SortableReportTableHeader>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="municipality"
              >
                Kommun
              </SortableReportTableHeader>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="co2e"
              >
                Installerad CO₂e
              </SortableReportTableHeader>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="requirement"
              >
                Årsrapport
              </SortableReportTableHeader>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="signing"
              >
                Signering
              </SortableReportTableHeader>
              <SortableReportTableHeader
                activeSortKey={sort.key}
                direction={sort.direction}
                onSort={updateSort}
                sortKey="status"
              >
                Status
              </SortableReportTableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {visibleProperties.map((property) => (
              <tr
                className={property.id === selectedPropertyId ? "bg-blue-50/60" : undefined}
                key={property.id}
              >
                <TableCell>
                  <button
                    className="text-left font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={() => onSelectProperty(property.id)}
                    type="button"
                  >
                    {property.name}
                  </button>
                  {property.id === selectedPropertyId && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      Vald
                    </span>
                  )}
                </TableCell>
                <TableCell>{property.municipality || "-"}</TableCell>
                <TableCell>{formatWholeCo2eTon(property.installedCo2eTon)}</TableCell>
                <TableCell>
                  <AnnualRequirementBadge status={property.annualReportRequirement} />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-slate-800">
                    {property.signedStatus === "SIGNED" ? "Signerad" : "Ej signerad"}
                  </div>
                  {property.signedAt && (
                    <div className="text-xs text-slate-500">
                      {formatDate(property.signedAt)}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs font-semibold text-slate-700">
                    {property.blockingIssueCount} kräver komplettering,{" "}
                    {property.reviewWarningCount} bör granskas
                  </span>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedProperties.length > 5 && (
        <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Visar {visibleProperties.length} av {sortedProperties.length} fastigheter.
          </span>
          <button
            className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            type="button"
            onClick={() => setShowAllRows((current) => !current)}
          >
            {showAllRows ? "Visa färre" : "Visa fler"}
          </button>
        </div>
      )}
    </section>
  )
}

function AnnualRequirementBadge({
  status,
}: {
  status: NonNullable<ReportData["annualReportOverview"]>["properties"][number]["annualReportRequirement"]
}) {
  if (status === "REQUIRED") {
    return <Badge variant="warning">Krävs</Badge>
  }
  if (status === "UNCERTAIN") {
    return <Badge variant="warning">Osäkert</Badge>
  }

  return <Badge variant="neutral">Krävs inte</Badge>
}

function SortableReportTableHeader({
  activeSortKey,
  children,
  direction,
  onSort,
  sortKey,
}: {
  activeSortKey: AnnualOverviewSortKey | ""
  children: React.ReactNode
  direction: SortDirection | ""
  onSort: (sortKey: AnnualOverviewSortKey) => void
  sortKey: AnnualOverviewSortKey
}) {
  const isActive = activeSortKey === sortKey

  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
      <button
        className="inline-flex items-center gap-1 rounded-sm text-left hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
        type="button"
        onClick={() => onSort(sortKey)}
      >
        <span>{children}</span>
        {isActive && direction && (
          <span aria-hidden="true" className="text-neutral-900">
            {direction === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </th>
  )
}

function sortAnnualOverviewProperties(
  properties: AnnualOverviewProperty[],
  sortKey: AnnualOverviewSortKey | "",
  direction: SortDirection | ""
) {
  if (!sortKey || !direction) return properties

  const multiplier = direction === "asc" ? 1 : -1

  return [...properties].sort((first, second) => {
    const firstValue = getAnnualOverviewSortValue(first, sortKey)
    const secondValue = getAnnualOverviewSortValue(second, sortKey)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier
    }

    return (
      String(firstValue).localeCompare(String(secondValue), "sv", {
        numeric: true,
        sensitivity: "base",
      }) * multiplier
    )
  })
}

function getAnnualOverviewSortValue(
  property: AnnualOverviewProperty,
  sortKey: AnnualOverviewSortKey
) {
  switch (sortKey) {
    case "property":
      return property.name
    case "municipality":
      return property.municipality || ""
    case "co2e":
      return property.installedCo2eTon
    case "requirement":
      return annualRequirementSortRank[property.annualReportRequirement]
    case "signing":
      return property.signedStatus === "SIGNED" ? 1 : 0
    case "status":
      return property.blockingIssueCount * 1000 + property.reviewWarningCount
  }
}

const annualRequirementSortRank: Record<
  AnnualOverviewProperty["annualReportRequirement"],
  number
> = {
  NOT_REQUIRED: 0,
  UNCERTAIN: 1,
  REQUIRED: 2,
}

function ReportQualityPanel({ reportData }: { reportData: ReportData }) {
  const [showAllWarnings, setShowAllWarnings] = useState(false)
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
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, 5)
  const hiddenWarningCount = warnings.length - visibleWarnings.length

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
            {visibleWarnings.map((warning) => (
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
            <button
              className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white/80 px-3 text-xs font-semibold text-slate-800 hover:bg-white"
              onClick={() => setShowAllWarnings((current) => !current)}
              type="button"
            >
              {showAllWarnings ? "Visa färre" : `Visa fler (${hiddenWarningCount} till)`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function AnnualPdfExportModal({
  error,
  exportMode,
  isExporting,
  onClose,
  onExport,
  onReportNotesChange,
  reportNotes,
  status,
}: {
  error: string
  exportMode: "signed" | "unsigned" | null
  isExporting: boolean
  onClose: () => void
  onExport: (signed: boolean) => void
  onReportNotesChange: (value: string) => void
  reportNotes: string
  status?: NonNullable<ReportData["qualitySummary"]>["status"]
}) {
  const hasQualityIssues =
    status === "MISSING_REQUIRED_DATA" || status === "HAS_WARNINGS"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div
        aria-modal="true"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-900 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Exportera årsrapport
            </h2>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isExporting}
            onClick={onClose}
            type="button"
          >
            Stäng
          </button>
        </div>

        {hasQualityIssues && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            Rapporten innehåller uppgifter som bör kompletteras eller granskas innan den skickas till kommunen.
          </p>
        )}
        {isExporting && (
          <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
            Rapporten genereras. Det kan ta några sekunder.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-left font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isExporting}
            onClick={() => onExport(false)}
            type="button"
          >
            {isExporting && exportMode === "unsigned" ? "Genererar..." : "Exportera utan signatur"}
            <span className="mt-1 block text-xs font-normal text-slate-600">
              PDF utan signatursektion eller signeringsmetadata.
            </span>
          </button>
          <button
            className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-3 text-left font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            disabled={isExporting}
            onClick={() => onExport(true)}
            type="button"
          >
            {isExporting && exportMode === "signed" ? "Genererar..." : "Signera och exportera PDF"}
            <span className="mt-1 block text-xs font-normal text-blue-100">
              Signeras med namn, e-post och tidpunkt från din inloggade användare.
            </span>
          </button>
        </div>

        <label className={`${filterLabelClassName} mt-4`}>
          Övriga anteckningar till årsrapporten
          <span className="text-xs font-normal text-slate-600">
            Valfritt fält för kompletterande information till tillsynsmyndigheten.
          </span>
          <textarea
            className={`${signingTextareaClassName} disabled:cursor-not-allowed disabled:bg-slate-50`}
            disabled={isExporting}
            maxLength={2000}
            onChange={(event) => onReportNotesChange(event.target.value)}
            value={reportNotes}
          />
        </label>
      </div>
    </div>
  )
}

function ReportEventsPreview({ events }: { events: ReportData["events"] }) {
  const [showAllEvents, setShowAllEvents] = useState(false)
  const visibleEvents = showAllEvents ? events : events.slice(0, 5)
  const hiddenEventCount = events.length - visibleEvents.length

  if (events.length === 0) {
    return <EmptyState text="Inga händelser registrerade för valt år." />
  }

  return (
    <>
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
            {visibleEvents.map((event) => (
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
      {events.length > 5 && (
        <button
          className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => setShowAllEvents((current) => !current)}
          type="button"
        >
          {showAllEvents
            ? "Visa mindre"
            : `Visa mer (${hiddenEventCount} till)`}
        </button>
      )}
    </>
  )
}

function SignedReportsHistory({
  reports,
}: {
  reports: SignedReportHistoryItem[]
}) {
  const [showAllReports, setShowAllReports] = useState(false)
  const visibleReports = showAllReports ? reports : reports.slice(0, 3)
  const hiddenReportCount = reports.length - visibleReports.length

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-900">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold">Signerade rapporter</h2>
          <p className="text-slate-600">
            Signeringsinformation finns sparad, men signerad PDF sparas inte historiskt ännu.
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
                <TableHeader>Information</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleReports.map((report) => (
                <tr key={report.id}>
                  <TableCell>{report.reportYear}</TableCell>
                  <TableCell>{report.scopeSummary}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-950">
                      {report.signerName}
                    </div>
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
                    <span className="text-xs text-slate-600">
                      Signerad PDF sparas inte historiskt ännu.
                    </span>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reports.length > 3 && (
        <button
          className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          onClick={() => setShowAllReports((current) => !current)}
          type="button"
        >
          {showAllReports
            ? "Visa mindre"
            : `Visa mer (${hiddenReportCount} till)`}
        </button>
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

function formatWholeCo2eTon(value: number | null) {
  return value === null
    ? "Okänt"
    : `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(value)} t`
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
function buildAnnualPdfExportHref({
  baseHref,
  reportNotes,
  signed,
}: {
  baseHref: string
  reportNotes: string
  signed: boolean
}) {
  const params = new URLSearchParams(baseHref.split("?")[1] ?? "")

  if (signed) {
    params.set("signed", "1")
  } else {
    params.delete("signed")
  }

  if (reportNotes.trim()) {
    params.set("reportNotes", reportNotes.trim())
  } else {
    params.delete("reportNotes")
  }

  return `/api/reports/annual-fgas?${params.toString()}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function getFilenameFromContentDisposition(contentDisposition: string | null) {
  if (!contentDisposition) return null

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""))
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return filenameMatch?.[1] ?? null
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
    READY: "Rapportstatus: Ok",
    HAS_WARNINGS: "Rapportstatus: Bör granskas",
    MISSING_REQUIRED_DATA: "Rapportstatus: Kräver komplettering",
  }[status]
}

function qualityStatusDescription(
  status: NonNullable<ReportData["qualitySummary"]>["status"]
) {
  return {
    READY: "Inga kompletteringar krävs.",
    HAS_WARNINGS:
      "Rapporten kan skapas, men uppgifterna bör kontrolleras innan den skickas till tillsynsmyndigheten.",
    MISSING_REQUIRED_DATA:
      "Rapporten kan skapas, men vissa uppgifter bör kompletteras innan den skickas till kommunen.",
  }[status]
}
