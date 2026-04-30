"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import CreateInstallationForm from "@/components/installations/create-installation-form"
import type { UserRole } from "@/lib/auth"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import type { InstallationRiskLevel } from "@/lib/risk-classification"

type Installation = {
  id: string
  name: string
  location: string
  refrigerantType: string
  refrigerantAmount: number
  gwp: number
  co2eTon: number
  baseInspectionInterval: number | null
  inspectionInterval: number | null
  hasAdjustedInspectionInterval: boolean
  complianceStatus: ComplianceStatus
  daysUntilDue: number | null
  nextInspection?: string | null
  risk: {
    level: InstallationRiskLevel
    score: number
  }
}

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

type AttentionItem = {
  id: string
  installationId: string
  installationName: string
  location: string
  type: ComplianceStatus | "LEAK"
  label: string
  date: string | null
  daysUntilDue: number | null
  notes: string | null
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
  installations: Installation[]
  attentionItems: AttentionItem[]
  actionItems: ActionItem[]
}

type ComplianceFilter = "ALL" | ComplianceStatus

const FILTERS: Array<{ label: string; value: ComplianceFilter }> = [
  { label: "Alla", value: "ALL" },
  { label: "Försenade", value: "OVERDUE" },
  { label: "Inom 30 dagar", value: "DUE_SOON" },
  { label: "Ej kontrollerade", value: "NOT_INSPECTED" },
  { label: "OK", value: "OK" },
  { label: "Ej kontrollpliktiga", value: "NOT_REQUIRED" },
]

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Kontroller inom 30 dagar",
  OVERDUE: "Försenade kontroller",
  NOT_REQUIRED: "Ej kontrollpliktiga",
  NOT_INSPECTED: "Ej kontrollerade",
}

const STATUS_TONE: Record<ComplianceStatus | "LEAK", string> = {
  OK: "border-emerald-300 bg-emerald-50 text-emerald-900",
  DUE_SOON: "border-amber-300 bg-amber-50 text-amber-900",
  OVERDUE: "border-red-300 bg-red-50 text-red-900",
  NOT_REQUIRED: "border-slate-300 bg-slate-50 text-slate-800",
  NOT_INSPECTED: "border-sky-300 bg-sky-50 text-sky-900",
  LEAK: "border-rose-300 bg-rose-50 text-rose-900",
}

const STATUS_BAR_TONE: Record<ComplianceStatus, string> = {
  OK: "bg-emerald-500",
  DUE_SOON: "bg-amber-500",
  OVERDUE: "bg-red-500",
  NOT_REQUIRED: "bg-slate-500",
  NOT_INSPECTED: "bg-sky-500",
}

const RISK_LABELS: Record<InstallationRiskLevel, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const RISK_TONE: Record<InstallationRiskLevel, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
}

const RISK_SORT_ORDER: Record<InstallationRiskLevel, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const ACTION_PRIORITY_LABELS: Record<ActionItem["priority"], string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const ACTION_PRIORITY_TONE: Record<ActionItem["priority"], string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-slate-100 text-slate-700",
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [activeFilter, setActiveFilter] = useState<ComplianceFilter>("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
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
        setError("Kunde inte hämta compliance-dashboarden")
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
  }, [refreshKey, router])

  const canManage = currentUser?.role === "ADMIN"
  const installations = dashboardData?.installations ?? []
  const filteredInstallations =
    activeFilter === "ALL"
      ? installations
      : installations.filter((item) => item.complianceStatus === activeFilter)
  const highestRiskInstallations = [...installations]
    .sort(compareRiskInstallations)
    .slice(0, 8)

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Compliance dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            F-gasöversikt
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Samlad kontroll över aggregat, kontrollintervall, CO₂e och
            läckagehändelser.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/reports">
            Rapporter
          </Link>
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/leakage">
            Läckageanalys
          </Link>
          {currentUser?.role === "CONTRACTOR" && (
            <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/service">
              Serviceuppdrag
            </Link>
          )}
          {canManage && (
            <>
              <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/installations">
                Hantera aggregat
              </Link>
              <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/company">
                Företagsinställningar
              </Link>
              <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/installations/import">
                Import Excel
              </Link>
              <Link className="rounded-md border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white" href="/api/installations/export">
                Export CSV
              </Link>
              <Link className="rounded-md border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-900 hover:text-white" href="/api/installations/export/pdf">
                Export PDF
              </Link>
            </>
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-8">
          <CreateInstallationForm onInstallationCreated={() => setRefreshKey((current) => current + 1)} />
        </div>
      )}

      {isLoading && <p className="mt-8 text-slate-700">Laddar...</p>}
      {error && <p className="mt-8 text-red-700">{error}</p>}

      {dashboardData && (
        <>
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Att göra</h2>
              <p className="mt-1 text-sm text-slate-700">
                Prioriterade åtgärder för att minska compliance-risk.
              </p>
            </div>

            {dashboardData.actionItems.length === 0 ? (
              <p className="mt-5 text-sm text-slate-700">
                Inga prioriterade åtgärder just nu.
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {dashboardData.actionItems.map((item) => (
                  <div
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={item.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={item.priority} />
                        <h3 className="font-semibold text-slate-950">{item.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{item.description}</p>
                    </div>
                    <Link
                      className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-slate-700"
                      href={item.href}
                    >
                      Visa aggregat
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <MetricCard label="Totalt antal aggregat" value={dashboardData.metrics.totalInstallations} />
            <MetricCard label="OK" value={dashboardData.metrics.ok} tone="emerald" />
            <MetricCard label="Försenade kontroller" value={dashboardData.metrics.overdue} tone="red" />
            <MetricCard label="Kontroller inom 30 dagar" value={dashboardData.metrics.dueSoon} tone="amber" />
            <MetricCard label="Ej kontrollerade" value={dashboardData.metrics.notInspected} tone="sky" />
            <MetricCard label="Ej kontrollpliktiga" value={dashboardData.metrics.notRequired} />
          </section>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total CO₂e" value={`${formatNumber(dashboardData.environmental.totalCo2eTon)} ton`} />
            <MetricCard label="Köldmediemängd" value={`${formatNumber(dashboardData.environmental.totalRefrigerantAmount)} kg`} />
            <MetricCard label="Kontrollpliktiga aggregat" value={dashboardData.environmental.requiringInspection} />
            <MetricCard label="Läckagehändelser" value={dashboardData.environmental.leakageEvents} tone="red" />
          </section>

          <section className="mt-10">
            <div>
              <h2 className="text-xl font-semibold">Riskklassning</h2>
              <p className="mt-1 text-sm text-slate-700">
                Klimat- och compliance-risk baserat på CO₂e, mängd köldmedium
                och registrerade läckagehändelser.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MetricCard label="Hög risk" value={dashboardData.riskSummary.high} tone="red" />
              <MetricCard label="Medel risk" value={dashboardData.riskSummary.medium} tone="amber" />
              <MetricCard label="Låg risk" value={dashboardData.riskSummary.low} tone="emerald" />
            </div>

            {highestRiskInstallations.length === 0 ? (
              <p className="mt-5 text-sm text-slate-700">
                Inga aggregat finns att riskklassa.
              </p>
            ) : (
              <RiskTable installations={highestRiskInstallations} />
            )}
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Behöver åtgärd</h2>
                  <p className="mt-1 text-sm text-slate-700">
                    Prioriterat efter försenade kontroller, kommande kontroller,
                    ej kontrollerade aggregat och senaste läckage.
                  </p>
                </div>
              </div>

              {dashboardData.attentionItems.length === 0 ? (
                <p className="mt-5 text-sm text-slate-700">
                  Inga aggregat kräver åtgärd just nu.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-slate-200">
                  {dashboardData.attentionItems.map((item) => (
                    <Link
                      className="flex flex-col gap-2 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      href={`/dashboard/installations/${item.installationId}`}
                      key={item.id}
                    >
                      <div>
                        <div className="font-semibold text-slate-950">
                          {item.installationName}
                        </div>
                        <div className="text-sm text-slate-700">
                          {item.location}
                          {item.date ? ` · ${formatDate(item.date)}` : ""}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </div>
                      </div>
                      <StatusBadge
                        daysUntilDue={item.daysUntilDue}
                        label={item.label}
                        status={item.type}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
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
                  items={dashboardData.refrigerantDistribution.map((item) => ({
                    label: item.label,
                    value: item.count,
                  }))}
                />
              </VisualCard>

              <VisualCard title="CO₂e per köldmedium">
                <DistributionBars
                  items={dashboardData.refrigerantDistribution.map((item) => ({
                    label: item.label,
                    value: item.co2eTon,
                    suffix: "ton",
                  }))}
                />
              </VisualCard>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Registrerade aggregat</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Filtrera listan utifrån aktuell kontrollstatus.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                      activeFilter === filter.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {installations.length === 0 ? (
              <p className="mt-5 text-sm text-slate-700">
                Inga aggregat registrerade ännu.
              </p>
            ) : filteredInstallations.length === 0 ? (
              <p className="mt-5 text-sm text-slate-700">
                Inga aggregat matchar filtret.
              </p>
            ) : (
              <InstallationTable installations={filteredInstallations} />
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
  tone?: "neutral" | "emerald" | "red" | "amber" | "sky"
}) {
  const toneClass = {
    neutral: "border-slate-200 bg-white",
    emerald: "border-emerald-300 bg-emerald-50",
    red: "border-red-300 bg-red-50",
    amber: "border-amber-300 bg-amber-50",
    sky: "border-sky-300 bg-sky-50",
  }[tone]

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <div className="mt-2 break-words text-2xl font-bold text-slate-950">{value}</div>
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
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-800">{item.label}</span>
            <span className="text-slate-700">
              {formatNumber(item.value)} {item.suffix ?? ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function InstallationTable({ installations }: { installations: Installation[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <TableHeader>Aggregat</TableHeader>
            <TableHeader>Plats</TableHeader>
            <TableHeader>Köldmedium</TableHeader>
            <TableHeader>Mängd</TableHeader>
            <TableHeader>GWP</TableHeader>
            <TableHeader>CO₂e</TableHeader>
            <TableHeader>Kontrollintervall</TableHeader>
            <TableHeader>Nästa kontroll</TableHeader>
            <TableHeader>Status</TableHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {installations.map((item) => (
            <tr className="hover:bg-slate-50" key={item.id}>
              <TableCell>
                <Link className="font-semibold text-slate-950 underline-offset-4 hover:underline" href={`/dashboard/installations/${item.id}`}>
                  {item.name}
                </Link>
              </TableCell>
              <TableCell>{item.location}</TableCell>
              <TableCell>{item.refrigerantType}</TableCell>
              <TableCell>{formatNumber(item.refrigerantAmount)} kg</TableCell>
              <TableCell>{item.gwp}</TableCell>
              <TableCell>{formatNumber(item.co2eTon)} ton</TableCell>
              <TableCell>{formatInspectionInterval(item)}</TableCell>
              <TableCell>{formatOptionalDate(item.nextInspection)}</TableCell>
              <TableCell>
                <StatusBadge
                  daysUntilDue={item.daysUntilDue}
                  status={item.complianceStatus}
                />
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RiskTable({ installations }: { installations: Installation[] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <TableHeader>Aggregat</TableHeader>
            <TableHeader>Plats</TableHeader>
            <TableHeader>Köldmedium</TableHeader>
            <TableHeader>Mängd kg</TableHeader>
            <TableHeader>CO₂e ton</TableHeader>
            <TableHeader>Risknivå</TableHeader>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {installations.map((item) => (
            <tr className="hover:bg-slate-50" key={item.id}>
              <TableCell>
                <Link className="font-semibold text-slate-950 underline-offset-4 hover:underline" href={`/dashboard/installations/${item.id}`}>
                  {item.name}
                </Link>
              </TableCell>
              <TableCell>{item.location}</TableCell>
              <TableCell>{item.refrigerantType}</TableCell>
              <TableCell>{formatNumber(item.refrigerantAmount)}</TableCell>
              <TableCell>{formatNumber(item.co2eTon)}</TableCell>
              <TableCell>
                <RiskBadge level={item.risk.level} />
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
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
  return <td className="whitespace-nowrap px-4 py-3 text-slate-800">{children}</td>
}

function StatusBadge({
  status,
  daysUntilDue,
  label,
}: {
  status: ComplianceStatus | "LEAK"
  daysUntilDue?: number | null
  label?: string
}) {
  const badgeLabel =
    label ??
    (status === "DUE_SOON" ? formatDueSoonLabel(daysUntilDue ?? null) : STATUS_LABELS[status as ComplianceStatus])

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {badgeLabel}
    </span>
  )
}

function RiskBadge({ level }: { level: InstallationRiskLevel }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${RISK_TONE[level]}`}>
      {RISK_LABELS[level]}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: ActionItem["priority"] }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ACTION_PRIORITY_TONE[priority]}`}>
      {ACTION_PRIORITY_LABELS[priority]}
    </span>
  )
}

function compareRiskInstallations(first: Installation, second: Installation) {
  const levelDiff =
    RISK_SORT_ORDER[first.risk.level] - RISK_SORT_ORDER[second.risk.level]

  if (levelDiff !== 0) return levelDiff
  if (second.risk.score !== first.risk.score) {
    return second.risk.score - first.risk.score
  }

  return second.co2eTon - first.co2eTon
}

function formatDueSoonLabel(daysUntilDue: number | null) {
  if (daysUntilDue === null) return "Kontroll inom 30 dagar"
  if (daysUntilDue === 0) return "Förfaller idag"
  return `Förfaller om ${daysUntilDue} dagar`
}

function formatInspectionInterval(installation: Installation) {
  if (!installation.inspectionInterval) return "Ingen kontrollplikt"

  if (!installation.hasAdjustedInspectionInterval) {
    return `Var ${installation.inspectionInterval}:e månad`
  }

  return `Var ${installation.inspectionInterval}:e månad (bas ${installation.baseInspectionInterval}:e månad, läckagevarning)`
}

function formatOptionalDate(value?: string | null) {
  return value ? formatDate(value) : "-"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE").format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
