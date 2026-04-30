"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, buttonClassName, Card, PageHeader } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import type { ComplianceStatus } from "@/lib/fgas-calculations"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

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
  title: string
  description: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  installationId?: string
  href: string
  dueDate?: string | null
  createdAt?: string | null
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
    totalRefrigerantAmount: number
    requiringInspection: number
    leakageInstallationCount: number
    leakageEvents: number
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

const secondaryButtonClassName = buttonClassName({ variant: "secondary" })

const ACTION_TYPE_ORDER: Record<ActionItem["type"], number> = {
  OVERDUE_INSPECTION: 1,
  NOT_INSPECTED: 2,
  RECENT_LEAKAGE: 3,
  HIGH_RISK: 4,
  NO_SERVICE_PARTNER: 5,
  DUE_SOON_INSPECTION: 6,
}

const PRIORITY_ORDER: Record<ActionItem["priority"], number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    async function fetchDashboardData() {
      setIsLoading(true)
      setError("")

      const [response, userResponse] = await Promise.all([
        fetch("/api/dashboard/compliance", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (response.status === 401 || userResponse.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok || !userResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta dashboarden")
        setIsLoading(false)
        return
      }

      const data: DashboardData = await response.json()
      const userData: CurrentUser = await userResponse.json()

      if (!isMounted) return

      setDashboardData(data)
      setCurrentUser(userData)
      setIsLoading(false)
    }

    void fetchDashboardData()

    return () => {
      isMounted = false
    }
  }, [router])

  const canManage = currentUser?.role === "ADMIN"
  const topActionItems = useMemo(
    () => [...(dashboardData?.actionItems ?? [])].sort(compareActionItems).slice(0, 5),
    [dashboardData?.actionItems]
  )

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          actions={
            <>
              {canManage && (
                <Link
                  className={buttonClassName({ variant: "primary" })}
                  href="/dashboard/installations"
                >
                  + LÃ¤gg till aggregat
                </Link>
              )}
              <Link className={secondaryButtonClassName} href="/dashboard/installations">
                Hantera aggregat
              </Link>
              <Link className={secondaryButtonClassName} href="/dashboard/reports">
                Rapporter
              </Link>
              {canManage && (
                <Link className={secondaryButtonClassName} href="/dashboard/installations/import">
                  Import Excel
                </Link>
              )}
            </>
          }
          eyebrow="Compliance dashboard"
          title="F-gasÃ¶versikt"
          subtitle="Se compliance-lÃ¤get, prioriterade Ã¥tgÃ¤rder och risker fÃ¶r era kÃ¶ldmedieaggregat."
        />
        <Card className="hidden px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Compliance dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              F-gasöversikt
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              Se compliance-läget, prioriterade åtgärder och risker för era
              köldmedieaggregat.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Link
                className={buttonClassName({ variant: "primary" })}
                href="/dashboard/installations"
              >
                + Lägg till aggregat
              </Link>
            )}
            <Link className={secondaryButtonClassName} href="/dashboard/installations">
              Hantera aggregat
            </Link>
            <Link className={secondaryButtonClassName} href="/dashboard/reports">
              Rapporter
            </Link>
            {canManage && (
              <Link className={secondaryButtonClassName} href="/dashboard/installations/import">
                Import Excel
              </Link>
            )}
          </div>
        </div>
        </Card>
      </section>

      {isLoading && <p className="mx-auto mt-8 max-w-7xl text-slate-700">Laddar...</p>}
      {error && <p className="mx-auto mt-8 max-w-7xl text-red-700">{error}</p>}

      {dashboardData && (
        <div className="mx-auto max-w-7xl">
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <MetricCard label="Totalt" value={dashboardData.metrics.totalInstallations} />
            <MetricCard label="OK" value={dashboardData.metrics.ok} tone="emerald" />
            <MetricCard label="Försenade" value={dashboardData.metrics.overdue} tone="red" />
            <MetricCard label="Inom 30 dagar" value={dashboardData.metrics.dueSoon} tone="amber" />
            <MetricCard label="Ej kontrollerade" value={dashboardData.metrics.notInspected} tone="sky" />
            <MetricCard label="Ej kontrollpliktiga" value={dashboardData.metrics.notRequired} />
            <MetricCard label="Läckage" value={dashboardData.environmental.leakageEvents} tone="red" />
            <MetricCard label="Total CO₂e" value={`${formatNumber(dashboardData.environmental.totalCo2eTon)} t`} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Prioritering
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">Att göra</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    De fem viktigaste åtgärderna just nu.
                  </p>
                </div>
                <Link
                  className={secondaryButtonClassName}
                  href="/dashboard/installations?status=overdue"
                >
                  Visa alla åtgärder
                </Link>
              </div>

              {topActionItems.length === 0 ? (
                <p className="mt-5 text-sm text-slate-700">
                  Inga prioriterade åtgärder just nu.
                </p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {topActionItems.map((item) => (
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

          <div className="mt-6 flex justify-end">
            <Link
              className={secondaryButtonClassName}
              href="/dashboard/installations"
            >
              Visa alla aggregat
            </Link>
          </div>
        </div>
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
    <div className={`min-h-24 rounded-xl border border-slate-200 border-l-4 bg-white px-3 py-3 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950">{value}</div>
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
  const installationName = extractInstallationName(item.description)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={item.priority} />
          <h3 className="font-semibold text-slate-950">{item.title}</h3>
        </div>
        {installationName && (
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {installationName}
          </p>
        )}
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

function compareActionItems(first: ActionItem, second: ActionItem) {
  const typeDiff = ACTION_TYPE_ORDER[first.type] - ACTION_TYPE_ORDER[second.type]
  if (typeDiff !== 0) return typeDiff

  const priorityDiff =
    PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority]
  if (priorityDiff !== 0) return priorityDiff

  return compareOptionalDates(first.dueDate ?? first.createdAt, second.dueDate ?? second.createdAt)
}

function compareOptionalDates(firstDate?: string | null, secondDate?: string | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return new Date(firstDate).getTime() - new Date(secondDate).getTime()
}

function extractInstallationName(description: string) {
  return description.split(" skulle ")[0]
    .split(" ska ")[0]
    .split(" saknar ")[0]
    .split(" har ")[0]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
