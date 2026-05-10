"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, Card, PageHeader } from "@/components/ui"
import {
  filterDashboardActions,
  type ActionFilter,
} from "@/lib/actions/action-filters"
import type {
  DashboardActionSeverity,
  DashboardActionType,
} from "@/lib/actions/generate-actions"

type ActionItem = {
  id: string
  type: DashboardActionType
  severity: DashboardActionSeverity
  priority: DashboardActionSeverity
  title: string
  description: string
  installationId: string
  installationName: string
  equipmentId: string | null
  propertyName: string | null
  href: string
  dueDate?: string | null
  createdAt?: string | null
  createdFrom: "inspection" | "risk" | "service_contact" | "leakage"
  source: "inspection" | "risk" | "service_contact" | "leakage"
  sortPriority: number
}

type ActionsResponse = {
  actions: ActionItem[]
}

const FILTERS: Array<{ label: string; value: ActionFilter }> = [
  { label: "Alla", value: "ALL" },
  { label: "Försenade kontroller", value: "OVERDUE_INSPECTIONS" },
  { label: "Kommande kontroller", value: "UPCOMING_INSPECTIONS" },
  { label: "Läckage", value: "LEAKAGE" },
  { label: "Hög risk", value: "HIGH_RISK" },
  { label: "Saknar servicekontakt", value: "NO_SERVICE_PARTNER" },
]

const SEVERITY_LABELS: Record<DashboardActionSeverity, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const STATUS_LABELS: Record<DashboardActionType, string> = {
  OVERDUE_INSPECTION: "Försenad",
  DUE_SOON_INSPECTION: "Kommande",
  NOT_INSPECTED: "Saknar kontroll",
  HIGH_RISK: "Hög risk",
  NO_SERVICE_PARTNER: "Servicekontakt saknas",
  RECENT_LEAKAGE: "Läckage",
}

export default function ActionsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [actions, setActions] = useState<ActionItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const activeFilter = getActionFilter(searchParams.get("filter"))

  useEffect(() => {
    let isMounted = true

    async function fetchActions() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/dashboard/actions", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta åtgärder")
        setIsLoading(false)
        return
      }

      const data: ActionsResponse = await response.json()
      if (!isMounted) return

      setActions(data.actions)
      setIsLoading(false)
    }

    void fetchActions()

    return () => {
      isMounted = false
    }
  }, [router])

  const visibleActions = useMemo(
    () => filterDashboardActions(actions, activeFilter),
    [actions, activeFilter]
  )

  function updateFilter(filter: ActionFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === "ALL") {
      params.delete("filter")
    } else {
      params.set("filter", filter)
    }

    const queryString = params.toString()
    router.replace(queryString ? `/dashboard/actions?${queryString}` : "/dashboard/actions")
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="Åtgärder"
          subtitle="Operativ översikt över aggregat som kräver uppföljning."
        />
      </section>

      <div className="mx-auto mt-6 max-w-7xl">
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  activeFilter === filter.value
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={filter.value}
                type="button"
                onClick={() => updateFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </Card>

        {isLoading && <p className="mt-6 text-slate-700">Laddar åtgärder...</p>}
        {error && <p className="mt-6 font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && (
          <Card className="mt-4 overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                {visibleActions.length} åtgärder
              </p>
            </div>
            {visibleActions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-600">
                Inga åtgärder matchar filtret.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {visibleActions.map((action) => (
                  <ActionRow action={action} key={action.id} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  )
}

function ActionRow({ action }: { action: ActionItem }) {
  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={action.severity} />
          <Badge variant="neutral">{STATUS_LABELS[action.type]}</Badge>
          <h2 className="text-sm font-semibold text-slate-950">{action.title}</h2>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {action.installationName}
          {action.equipmentId ? (
            <span className="font-normal text-slate-600"> · {action.equipmentId}</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-slate-600">{action.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Fastighet: {action.propertyName || "-"}</span>
          <span>Datum: {formatActionDate(action)}</span>
        </div>
      </div>
      <Link
        className="inline-flex justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        href={action.href}
      >
        Öppna aggregat
      </Link>
    </article>
  )
}

function SeverityBadge({ severity }: { severity: DashboardActionSeverity }) {
  const variant = severity === "HIGH" ? "danger" : severity === "MEDIUM" ? "warning" : "neutral"

  return <Badge variant={variant}>{SEVERITY_LABELS[severity]}</Badge>
}

function formatActionDate(action: ActionItem) {
  const date = action.dueDate ?? action.createdAt
  if (!date) return "-"

  return new Intl.DateTimeFormat("sv-SE").format(new Date(date))
}

function getActionFilter(value: string | null): ActionFilter {
  return FILTERS.some((filter) => filter.value === value)
    ? (value as ActionFilter)
    : "ALL"
}
