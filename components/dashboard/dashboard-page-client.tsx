"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { Badge, Card, PageHeader } from "@/components/ui"
import type { ComplianceStatus } from "@/lib/fgas-calculations"

type DistributionItem = {
  label: string
  count: number
  co2eTon: number
  refrigerantAmount: number
}

type ActionItem = {
  id: string
  type:
    | "OVERDUE_INSPECTION"
    | "DUE_SOON_INSPECTION"
    | "NOT_INSPECTED"
    | "HIGH_RISK"
    | "NO_SERVICE_PARTNER"
    | "RECENT_LEAKAGE"
    | "REFRIGERANT_REVIEW"
  severity: "HIGH" | "MEDIUM" | "LOW"
  title: string
  description: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  installationId: string
  installationName: string
  equipmentId: string | null
  propertyName: string | null
  href: string
  dueDate?: string | null
  createdAt?: string | null
  createdFrom: "inspection" | "risk" | "service_contact" | "leakage" | "refrigerant"
  source: "inspection" | "risk" | "service_contact" | "leakage" | "refrigerant"
  sortPriority: number
}

type DashboardData = {
  metrics: {
    totalInstallations: number
    ok: number
    overdue: number
    dueSoon: number
    notInspected: number
    notRequired: number
  }
  environmental: {
    totalCo2eTon: number
    co2eIsComplete: boolean
    unknownCo2eInstallations: number
    totalRefrigerantAmount: number
    requiringInspection: number
    leakageInstallationCount: number
    leakageEvents: number
    leakageYear: number
    leakageCo2eTon: number
    leakageCo2eIsComplete: boolean
    unknownLeakageCo2eEvents: number
  }
  annualReportStatus: {
    year: number
    requiredReports: number
    signedRequiredReports: number
    remainingRequiredReports: number
    uncertainProperties: number
    requiredReportsWithWarnings: number
    requiredReportsRequiringCompletion: number
    properties: Array<{
      id: string
      name: string
      municipality: string | null
      installedCo2eTon: number
      co2eIsComplete: boolean
      requirementStatus: "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
      signedStatus: "SIGNED" | "NOT_SIGNED" | "HAS_WARNINGS" | "MISSING_REQUIRED_DATA" | null
      signedAt: string | null
      blockingIssueCount: number
      reviewWarningCount: number
      href: string
    }>
  }
  refrigerantRegulatorySummary: {
    OK: number
    REVIEW: number
    RESTRICTED: number
    PHASE_OUT_RISK: number
    UNKNOWN: number
    followUp: number
  }
  riskSummary: {
    high: number
    medium: number
    low: number
  }
  statusDistribution: Record<ComplianceStatus, number>
  refrigerantDistribution: DistributionItem[]
  actionItems: ActionItem[]
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Inom 30 dagar",
  OVERDUE: "Försenade",
  NOT_REQUIRED: "Ej kontrollpliktiga",
  NOT_INSPECTED: "Ej kontrollerade",
}

const STATUS_BAR_TONE: Record<ComplianceStatus, string> = {
  OK: "bg-emerald-500",
  DUE_SOON: "bg-amber-500",
  OVERDUE: "bg-red-500",
  NOT_REQUIRED: "bg-slate-500",
  NOT_INSPECTED: "bg-sky-500",
}

const ACTION_PRIORITY_LABELS: Record<ActionItem["priority"], string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const ACTION_PREVIEW_LIMIT = 3

const KPI_CARDS = [
  {
    key: "total",
    label: "Totalt",
    description: "Aktiva aggregat i företaget",
    tooltip:
      "Antal aktiva aggregat som ingår i företagets F-gasregister.",
    tone: "neutral",
  },
  {
    key: "ok",
    label: "OK",
    description: "Har aktuell kontrollstatus",
    tooltip:
      "Aggregat där kontrollstatusen är aktuell enligt registrerade intervall.",
    tone: "emerald",
  },
  {
    key: "overdue",
    label: "Försenade",
    description: "Kontroller passerade deadline",
    tooltip:
      "Aggregat där nästa kontroll har passerat planerat datum.",
    tone: "red",
  },
  {
    key: "dueSoon",
    label: "Inom 30 dagar",
    description: "Kommande kontroller",
    tooltip:
      "Aggregat med kontroll som behöver genomföras inom 30 dagar.",
    tone: "amber",
  },
  {
    key: "leakage",
    label: "Läckage CO₂e i år",
    description: "Klimatpåverkan från registrerade läckage",
    tooltip:
      "Beräknad klimatpåverkan från årets registrerade läckagehändelser. Händelser med okänd mängd eller okänt GWP räknas inte som noll.",
    tone: "red",
  },
  {
    key: "co2e",
    label: "Installerad CO₂e",
    description: "Total köldmediemängd",
    tooltip:
      "Installerad köldmediemängd omräknad till CO₂e utifrån registrerat köldmedium och fyllnadsmängd.",
    tone: "neutral",
  },
] satisfies Array<{
  key: "total" | "ok" | "overdue" | "dueSoon" | "leakage" | "co2e"
  label: string
  description: string
  tooltip: string
  tone: "neutral" | "emerald" | "red" | "amber" | "sky"
}>

const PRIMARY_KPI_KEYS = ["overdue", "dueSoon", "leakage"] as const
const SECONDARY_KPI_KEYS = ["total", "ok", "co2e"] as const

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function fetchDashboardData() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/dashboard/compliance", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta dashboarden")
        setIsLoading(false)
        return
      }

      const data: DashboardData = await response.json()

      if (!isMounted) return

      setDashboardData(data)
      setIsLoading(false)
    }

    void fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [router])

  const sortedActionItems = dashboardData?.actionItems ?? []
  const visibleActionItems = sortedActionItems.slice(0, ACTION_PREVIEW_LIMIT)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="F-gasöversikt"
          subtitle="Se efterlevnadsläget, prioriterade åtgärder och risker för era köldmedieaggregat."
        />

      </section>

      {isLoading && <p className="mx-auto mt-8 max-w-7xl text-slate-700">Laddar...</p>}
      {error && <p className="mx-auto mt-8 max-w-7xl text-red-700">{error}</p>}

      {dashboardData && (
        <div className="mx-auto max-w-7xl">
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PRIMARY_KPI_KEYS.map((key) => {
              const card = getKpiCard(key)
              return (
                <MetricCard
                  description={getKpiDescription(card.key, dashboardData, card.description)}
                  key={card.key}
                  label={card.label}
                  tone={card.tone}
                  tooltip={card.tooltip}
                  value={getKpiValue(card.key, dashboardData)}
                />
              )
            })}
            <MetricCard
              description="Signerade årsrapporter som saknas för kravställda fastigheter"
              label="Årsrapporter återstår"
              tone={dashboardData.annualReportStatus.remainingRequiredReports > 0 ? "amber" : "emerald"}
              tooltip="Antal fastigheter där årsrapport bedöms krävas men signerad rapport saknas i FgasPortal."
              value={dashboardData.annualReportStatus.remainingRequiredReports}
            />
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-3">
            {SECONDARY_KPI_KEYS.map((key) => {
              const card = getKpiCard(key)
              return (
                <SecondaryMetric
                  description={getKpiDescription(card.key, dashboardData, card.description)}
                  key={card.key}
                  label={card.label}
                  value={getKpiValue(card.key, dashboardData)}
                />
              )
            })}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card className="border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Operativt fokus
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Att göra</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    Prioriterade statusproblem och uppföljningspunkter.
                  </p>
                </div>
                <Link
                  className="rounded-lg border border-blue-200 bg-blue-600 px-3.5 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  href="/dashboard/actions"
                >
                  Visa alla åtgärder
                </Link>
              </div>

              {visibleActionItems.length === 0 ? (
                <p className="mt-5 text-sm text-slate-700">
                  Inga prioriterade åtgärder just nu.
                </p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {visibleActionItems.map((item) => (
                    <ActionRow item={item} key={item.id} />
                  ))}
                </div>
              )}
              {visibleActionItems.length > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  Visar upp till tre prioriterade åtgärder.
                </p>
              )}
            </Card>

            <AnnualReportsOverview
              className="xl:mt-0"
              status={dashboardData.annualReportStatus}
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <VisualCard
              title="Aggregat per riskklass"
              description="Fördelning av aggregat utifrån aktuell riskklassning."
              tooltip="Riskklassning baseras på köldmediemängd, GWP/CO₂e, läckagehistorik och om läckagevarningssystem finns."
            >
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Hög" value={dashboardData.riskSummary.high} tone="red" />
                <MiniMetric label="Medel" value={dashboardData.riskSummary.medium} tone="amber" />
                <MiniMetric label="Låg" value={dashboardData.riskSummary.low} tone="emerald" />
              </div>
            </VisualCard>

            <VisualCard
              title="Kontrollstatus"
              description="Fördelning av aggregat utifrån kontrollplikt och kontrollstatus."
            >
              <SegmentedStatusBar
                distribution={dashboardData.statusDistribution}
                total={dashboardData.metrics.totalInstallations}
              />
              <DistributionList
                items={Object.entries(dashboardData.statusDistribution).map(
                  ([status, count]) => ({
                    label: STATUS_LABELS[status as ComplianceStatus],
                    value: count,
                  })
                )}
              />
            </VisualCard>
          </section>

          <section className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Portföljanalys
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Köldmedier och klimatpåverkan
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Fördjupande översikt för planering, rapportunderlag och långsiktig uppföljning.
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <VisualCard title="Köldmedier" subdued>
                <DistributionBars
                  items={dashboardData.refrigerantDistribution.slice(0, 5).map((item) => ({
                    label: item.label,
                    value: item.count,
                  }))}
                />
              </VisualCard>

              <VisualCard
                title="Köldmediestatus"
                description="Operativa signaler för köldmedier som kan behöva följas upp."
                tooltip="Visar aggregat med köldmedier som kan behöva kontrolleras mot gällande eller kommande F-gaskrav. Bedömningen är en operativ signal, inte ett juridiskt beslut."
                subdued
              >
                <RefrigerantStatusSummary summary={dashboardData.refrigerantRegulatorySummary} />
              </VisualCard>

              <VisualCard title="CO₂e per köldmedium" subdued>
                <DistributionBars
                  items={dashboardData.refrigerantDistribution.slice(0, 5).map((item) => ({
                    label: item.label,
                    value: item.co2eTon,
                    displayValue: Math.round(item.co2eTon),
                    suffix: "t",
                  }))}
                />
              </VisualCard>
            </div>
          </section>


          {!dashboardData.environmental.co2eIsComplete && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {"Installerad CO\u2082e \u00e4r ofullst\u00e4ndig eftersom "}
              {dashboardData.environmental.unknownCo2eInstallations}
              {" aggregat saknar k\u00e4nt GWP-v\u00e4rde."}
            </p>
          )}
          {!dashboardData.environmental.leakageCo2eIsComplete && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {"L\u00e4ckage-CO\u2082e f\u00f6r "}
              {dashboardData.environmental.leakageYear}
              {" \u00e4r ofullst\u00e4ndig eftersom "}
              {dashboardData.environmental.unknownLeakageCo2eEvents}
              {" l\u00e4ckageh\u00e4ndelser saknar m\u00e4ngd eller k\u00e4nt GWP-v\u00e4rde."}
            </p>
          )}

        </div>
      )}
    </main>
  )
}

function MetricCard({
  description,
  label,
  tooltip,
  value,
  tone = "neutral",
}: {
  description: string
  label: string
  tooltip: string
  value: number | string
  tone?: "neutral" | "emerald" | "red" | "amber" | "sky"
}) {
  const tooltipId = useId()
  const toneClass = {
    neutral: "border-l-slate-300",
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    sky: "border-l-sky-500",
  }[tone]

  return (
    <div
      aria-describedby={tooltipId}
      className={`group relative min-h-28 rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-3 shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${toneClass}`}
      tabIndex={0}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div
        className="pointer-events-none absolute left-3 right-3 top-full z-20 mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {tooltip}
      </div>
    </div>
  )
}

function SecondaryMetric({
  description,
  label,
  value,
}: {
  description: string
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2.5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span className="text-base font-semibold text-slate-950">{value}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
}

function AnnualReportsOverview({
  className = "",
  status,
}: {
  className?: string
  status: DashboardData["annualReportStatus"]
}) {
  const visibleProperties = status.properties.slice(0, 4)
  const hasMoreProperties = status.properties.length > visibleProperties.length

  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rapportering {status.year}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Årsrapporter</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Kravbedömning per registrerad fastighet baserat på stationära aggregat och installerad CO₂e. FgasPortal spårar signering, inte inskick till kommunen.
          </p>
        </div>
        <Link
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          href={`/dashboard/reports?year=${status.year}`}
        >
          Öppna rapporter
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniSummary label="Årsrapport krävs" value={status.requiredReports} />
        <MiniSummary label="Signerade" value={status.signedRequiredReports} tone="emerald" />
        <MiniSummary label="Återstår" value={status.remainingRequiredReports} tone="amber" />
        <MiniSummary
          label="Kräver kontroll"
          value={status.uncertainProperties}
          tone={status.uncertainProperties > 0 ? "red" : "neutral"}
        />
      </div>

      {status.properties.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600">
          Inga registrerade fastigheter med aktiva aggregat hittades.
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {visibleProperties.map((property) => (
            <Link
              className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm hover:bg-white sm:flex-row sm:items-center sm:justify-between"
              href={`${property.href}&year=${status.year}`}
              key={property.id}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-950">
                  {property.name}
                </span>
                <span className="text-xs text-slate-600">
                  {property.municipality || "Kommun saknas"} ·{" "}
                  {formatWholeNumber(property.installedCo2eTon)} t installerad CO₂e
                </span>
              </span>
              <span className="flex flex-col gap-1 text-left sm:items-end sm:text-right">
                <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <AnnualReportRequirementBadge status={property.requirementStatus} />
                  {property.signedStatus ? (
                    <AnnualReportSignedStatusText status={property.signedStatus} />
                  ) : null}
                </span>
                {property.signedStatus &&
                property.blockingIssueCount + property.reviewWarningCount > 0 ? (
                  <span className="text-xs font-medium text-slate-600">
                    {property.blockingIssueCount} kräver komplettering,{" "}
                    {property.reviewWarningCount} bör granskas
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
          {hasMoreProperties ? (
            <p className="text-xs text-slate-500">
              +{status.properties.length - visibleProperties.length} fler fastigheter visas på rapportsidan.
            </p>
          ) : null}
        </div>
      )}
    </Card>
  )
}

function MiniSummary({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: "neutral" | "emerald" | "amber" | "red"
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-slate-50 text-slate-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  }[tone]

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  )
}

function AnnualReportRequirementBadge({
  status,
}: {
  status: DashboardData["annualReportStatus"]["properties"][number]["requirementStatus"]
}) {
  const labels = {
    REQUIRED: "Årsrapport krävs",
    NOT_REQUIRED: "Årsrapport krävs inte",
    UNCERTAIN: "Kräver kontroll av underlag",
  } satisfies Record<typeof status, string>
  const variants = {
    REQUIRED: "warning",
    NOT_REQUIRED: "success",
    UNCERTAIN: "danger",
  } satisfies Record<typeof status, React.ComponentProps<typeof Badge>["variant"]>

  return <Badge variant={variants[status]}>{labels[status]}</Badge>
}

function AnnualReportSignedStatusText({
  status,
}: {
  status: NonNullable<DashboardData["annualReportStatus"]["properties"][number]["signedStatus"]>
}) {
  const labels = {
    SIGNED: "Signerad",
    NOT_SIGNED: "Ej signerad",
    HAS_WARNINGS: "Signerad - bör granskas",
    MISSING_REQUIRED_DATA: "Signerad - kräver komplettering",
  } satisfies Record<typeof status, string>
  const toneClass = {
    SIGNED: "text-emerald-700",
    NOT_SIGNED: "text-slate-600",
    HAS_WARNINGS: "text-amber-700",
    MISSING_REQUIRED_DATA: "text-red-700",
  } satisfies Record<typeof status, string>

  return <span className={`text-xs font-semibold ${toneClass[status]}`}>{labels[status]}</span>
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "emerald" | "red" | "amber"
}) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone]

  return (
    <div className={`rounded-xl border p-3 text-center ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  )
}

function RefrigerantStatusSummary({
  summary,
}: {
  summary: DashboardData["refrigerantRegulatorySummary"]
}) {
  const items = [
    {
      label: "Kan omfattas av begränsningar",
      value: summary.RESTRICTED,
      badge: "Begränsning",
      variant: "warning",
      barClass: "bg-amber-500",
    },
    {
      label: "Bör planeras för utfasning",
      value: summary.PHASE_OUT_RISK,
      badge: "Utfasning",
      variant: "info",
      barClass: "bg-sky-500",
    },
    {
      label: "Okänt köldmedium",
      value: summary.UNKNOWN,
      badge: "Okänt",
      variant: "neutral",
      barClass: "bg-slate-400",
    },
  ] satisfies Array<{
    label: string
    value: number
    badge: string
    variant: React.ComponentProps<typeof Badge>["variant"]
    barClass: string
  }>
  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <span className="text-sm font-semibold text-slate-800">Att följa upp</span>
        <span className="text-lg font-bold text-slate-950">{summary.followUp}</span>
      </div>
      {items.map((item) => (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5" key={item.label}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
              <Badge className="mt-1" variant={item.variant}>
                {item.badge}
              </Badge>
            </div>
            <span className="shrink-0 text-lg font-bold text-slate-950">{item.value}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${item.barClass}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionRow({ item }: { item: ActionItem }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={item.severity} />
          <h3 className="font-semibold text-slate-950">{item.title}</h3>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {item.installationName}
          {item.equipmentId ? (
            <span className="font-normal text-slate-600"> · {item.equipmentId}</span>
          ) : null}
          {item.propertyName ? (
            <span className="font-normal text-slate-600"> - {item.propertyName}</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-slate-700">{item.description}</p>
      </div>
      <Link
        className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        href={item.href}
      >
        Visa
      </Link>
    </div>
  )
}

function VisualCard({
  title,
  description,
  tooltip,
  subdued = false,
  children,
}: {
  title: string
  description?: string
  tooltip?: string
  subdued?: boolean
  children: React.ReactNode
}) {
  const tooltipId = useId()
  const cardClass = subdued
    ? "relative border-slate-200 bg-white/70 p-4 shadow-none"
    : "relative p-4"

  return (
    <Card className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {tooltip ? (
          <span className="group/help relative mt-0.5 inline-flex">
            <button
              aria-describedby={tooltipId}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              type="button"
            >
              i
            </button>
            <span
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus-within/help:opacity-100"
              id={tooltipId}
              role="tooltip"
            >
              {tooltip}
            </span>
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function SegmentedStatusBar({
  distribution,
  total,
}: {
  distribution: Record<ComplianceStatus, number>
  total: number
}) {
  if (total === 0) {
    return <div className="h-3 rounded-full bg-slate-100" />
  }

  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
      {(Object.keys(STATUS_LABELS) as ComplianceStatus[]).map((status) => {
        const count = distribution[status]
        if (count === 0) return null

        return (
          <div
            className={STATUS_BAR_TONE[status]}
            key={status}
            style={{ width: `${(count / total) * 100}%` }}
          />
        )
      })}
    </div>
  )
}

function DistributionList({
  items,
}: {
  items: Array<{ label: string; value: number }>
}) {
  return (
    <div className="mt-4 grid gap-2">
      {items.map((item) => (
        <div className="flex items-center justify-between text-sm" key={item.label}>
          <span className="text-slate-700">{item.label}</span>
          <span className="font-semibold text-slate-950">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function DistributionBars({
  items,
}: {
  items: Array<{ label: string; value: number; displayValue?: number; suffix?: string }>
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  if (items.length === 0 || maxValue === 0) {
    return <p className="text-sm text-slate-700">Ingen data att visa.</p>
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-slate-800">{item.label}</span>
            <span className="shrink-0 text-slate-700">
              {formatNumber(item.displayValue ?? item.value)} {item.suffix ?? ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: ActionItem["priority"] }) {
  const variant = priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "neutral"

  return (
    <Badge variant={variant}>
      {ACTION_PRIORITY_LABELS[priority]}
    </Badge>
  )
}

type KpiCardConfig = (typeof KPI_CARDS)[number]

function getKpiCard(key: KpiCardConfig["key"]): KpiCardConfig {
  const card = KPI_CARDS.find((item) => item.key === key)
  if (!card) {
    throw new Error(`Unknown dashboard KPI: ${key}`)
  }

  return card
}

function getKpiValue(
  key: (typeof KPI_CARDS)[number]["key"],
  dashboardData: DashboardData
) {
  if (key === "total") return dashboardData.metrics.totalInstallations
  if (key === "ok") return dashboardData.metrics.ok
  if (key === "overdue") return dashboardData.metrics.overdue
  if (key === "dueSoon") return dashboardData.metrics.dueSoon
  if (key === "leakage") {
    const prefix = dashboardData.environmental.leakageCo2eIsComplete ? "" : "Minst "
    return `${prefix}${formatWholeNumber(dashboardData.environmental.leakageCo2eTon)} t`
  }

  const prefix = dashboardData.environmental.co2eIsComplete ? "" : "Minst "
  return `${prefix}${formatWholeNumber(dashboardData.environmental.totalCo2eTon)} t`
}

function getKpiDescription(
  key: (typeof KPI_CARDS)[number]["key"],
  dashboardData: DashboardData,
  fallback: string
) {
  if (key !== "leakage") return fallback

  const eventCount = dashboardData.environmental.leakageEvents
  if (eventCount === 0) return "Inga registrerade läckage i år"
  if (eventCount === 1) return "1 registrerat läckage i år"

  return `${eventCount} registrerade läckage i år`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}
