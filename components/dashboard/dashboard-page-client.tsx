"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
  severity: "HIGH" | "MEDIUM" | "LOW"
  title: string
  description: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  installationId: string
  installationName: string
  propertyName: string | null
  href: string
  dueDate?: string | null
  createdAt?: string | null
  createdFrom: "inspection" | "risk" | "service_contact" | "leakage"
  source: "inspection" | "risk" | "service_contact" | "leakage"
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

const ACTION_PREVIEW_LIMIT = 5

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
    label: "Läckage",
    description: "Registrerade läckage i år",
    tooltip:
      "Antal registrerade läckagehändelser i det aktuella företaget.",
    tone: "red",
  },
  {
    key: "co2e",
    label: "Total CO₂e",
    description: "Beräknad klimatpåverkan",
    tooltip:
      "Beräknad klimatpåverkan baserat på köldmedium och fyllnadsmängd.",
    tone: "neutral",
  },
] satisfies Array<{
  key: "total" | "ok" | "overdue" | "dueSoon" | "leakage" | "co2e"
  label: string
  description: string
  tooltip: string
  tone: "neutral" | "emerald" | "red" | "amber" | "sky"
}>

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAllActions, setShowAllActions] = useState(false)
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
  const visibleActionItems = showAllActions
    ? sortedActionItems
    : sortedActionItems.slice(0, ACTION_PREVIEW_LIMIT)
  const hasMoreActions = sortedActionItems.length > ACTION_PREVIEW_LIMIT

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Compliance dashboard"
          title="F-gasöversikt"
          subtitle="Se compliance-läget, prioriterade åtgärder och risker för era köldmedieaggregat."
        />

      </section>

      {isLoading && <p className="mx-auto mt-8 max-w-7xl text-slate-700">Laddar...</p>}
      {error && <p className="mx-auto mt-8 max-w-7xl text-red-700">{error}</p>}

      {dashboardData && (
        <div className="mx-auto max-w-7xl">
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {KPI_CARDS.map((card) => (
              <MetricCard
                description={card.description}
                key={card.key}
                label={card.label}
                tone={card.tone}
                tooltip={card.tooltip}
                value={getKpiValue(card.key, dashboardData)}
              />
            ))}
          </section>
          {!dashboardData.environmental.co2eIsComplete && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {"Total CO\u2082e \u00e4r ofullst\u00e4ndig eftersom "}
              {dashboardData.environmental.unknownCo2eInstallations}
              {" aggregat saknar k\u00e4nt GWP-v\u00e4rde."}
            </p>
          )}

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Prioritering
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Att göra</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    Prioriterade statusproblem och uppföljningspunkter.
                  </p>
                </div>
                {hasMoreActions && (
                  <button
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                    type="button"
                    onClick={() => setShowAllActions((current) => !current)}
                  >
                    {showAllActions ? "Visa färre åtgärder" : "Visa fler åtgärder"}
                  </button>
                )}
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
            </Card>

            <div className="grid gap-4">
              <VisualCard title="Riskklassning">
                <div className="grid grid-cols-3 gap-2">
                  <MiniMetric label="Hög" value={dashboardData.riskSummary.high} tone="red" />
                  <MiniMetric label="Medel" value={dashboardData.riskSummary.medium} tone="amber" />
                  <MiniMetric label="Låg" value={dashboardData.riskSummary.low} tone="emerald" />
                </div>
              </VisualCard>

              <VisualCard title="Statusfördelning">
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

              <VisualCard title="Köldmedier">
                <DistributionBars
                  items={dashboardData.refrigerantDistribution.slice(0, 5).map((item) => ({
                    label: item.label,
                    value: item.count,
                  }))}
                />
              </VisualCard>

              <VisualCard title="CO₂e per köldmedium">
                <DistributionBars
                  items={dashboardData.refrigerantDistribution.slice(0, 5).map((item) => ({
                    label: item.label,
                    value: item.co2eTon,
                    suffix: "t",
                  }))}
                />
              </VisualCard>
            </div>
          </section>

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
  const toneClass = {
    neutral: "border-l-slate-300",
    emerald: "border-l-emerald-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    sky: "border-l-sky-500",
  }[tone]

  return (
    <div
      aria-label={`${label}: ${tooltip}`}
      className={`min-h-28 cursor-help rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-3 shadow-sm ${toneClass}`}
      title={tooltip}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
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
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
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
            title={`${STATUS_LABELS[status]}: ${count}`}
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
  items: Array<{ label: string; value: number; suffix?: string }>
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
              {formatNumber(item.value)} {item.suffix ?? ""}
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

function getKpiValue(
  key: (typeof KPI_CARDS)[number]["key"],
  dashboardData: DashboardData
) {
  if (key === "total") return dashboardData.metrics.totalInstallations
  if (key === "ok") return dashboardData.metrics.ok
  if (key === "overdue") return dashboardData.metrics.overdue
  if (key === "dueSoon") return dashboardData.metrics.dueSoon
  if (key === "leakage") return dashboardData.environmental.leakageEvents

  const prefix = dashboardData.environmental.co2eIsComplete ? "" : "Minst "
  return `${prefix}${formatNumber(dashboardData.environmental.totalCo2eTon)} t`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
