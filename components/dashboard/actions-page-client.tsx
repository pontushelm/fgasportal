"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, Card, PageHeader } from "@/components/ui"
import {
  ACTION_SAVED_FILTER_PAGE,
  filterActionWorkQueue,
  getActionStableKey,
  getActionSummaryCounts,
  sanitizeActionFilterQueryParams,
  type ActionDueDateFilter,
  type ActionFilter,
  type ActionSeverityFilter,
} from "@/lib/actions/action-filters"
import type {
  DashboardActionSeverity,
  DashboardActionSource,
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
  propertyId: string | null
  propertyName: string | null
  assignedServiceContactId: string | null
  assignedServiceContactName: string | null
  assignedServiceContactEmail: string | null
  href: string
  dueDate?: string | null
  createdAt?: string | null
  createdFrom: DashboardActionSource
  source: DashboardActionSource
  sortPriority: number
}

type ActionsResponse = {
  actions: ActionItem[]
}

type RegisteredProperty = {
  id: string
  name: string
}

type SavedActionView = {
  id: string
  name: string
  page: string
  queryParams: Record<string, string>
  createdAt: string
}

const CATEGORY_FILTERS: Array<{ label: string; value: ActionFilter }> = [
  { label: "Alla", value: "ALL" },
  { label: "Försenade kontroller", value: "OVERDUE_INSPECTIONS" },
  { label: "Kommande kontroller", value: "UPCOMING_INSPECTIONS" },
  { label: "Läckage", value: "LEAKAGE" },
  { label: "Hög risk", value: "HIGH_RISK" },
  { label: "Saknar servicekontakt", value: "NO_SERVICE_PARTNER" },
]

const SEVERITY_FILTERS: Array<{ label: string; value: ActionSeverityFilter }> = [
  { label: "Alla nivåer", value: "ALL" },
  { label: "Hög", value: "HIGH" },
  { label: "Medel", value: "MEDIUM" },
  { label: "Låg", value: "LOW" },
]

const DUE_DATE_FILTERS: Array<{ label: string; value: ActionDueDateFilter }> = [
  { label: "Alla datum", value: "ALL" },
  { label: "Försenade", value: "OVERDUE" },
  { label: "Nästa 30 dagar", value: "NEXT_30_DAYS" },
  { label: "Nästa 90 dagar", value: "NEXT_90_DAYS" },
  { label: "Utan förfallodatum", value: "NO_DUE_DATE" },
]

const SEVERITY_LABELS: Record<DashboardActionSeverity, string> = {
  HIGH: "Hög",
  MEDIUM: "Medel",
  LOW: "Låg",
}

const ACTION_TYPE_LABELS: Record<DashboardActionType, string> = {
  OVERDUE_INSPECTION: "Försenad kontroll",
  DUE_SOON_INSPECTION: "Kommande kontroll",
  NOT_INSPECTED: "Saknar kontroll",
  HIGH_RISK: "Hög risk",
  NO_SERVICE_PARTNER: "Servicekontakt saknas",
  RECENT_LEAKAGE: "Läckageuppföljning",
}

export default function ActionsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [actions, setActions] = useState<ActionItem[]>([])
  const [registeredProperties, setRegisteredProperties] = useState<RegisteredProperty[]>([])
  const [savedViews, setSavedViews] = useState<SavedActionView[]>([])
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("")
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState("")
  const [isSavingView, setIsSavingView] = useState(false)
  const [savedViewMessage, setSavedViewMessage] = useState("")
  const [savedViewError, setSavedViewError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const activeCategory = getActionFilter(searchParams.get("filter"))
  const activeSeverity = getSeverityFilter(searchParams.get("severity"))
  const activeDueDate = getDueDateFilter(searchParams.get("due"))
  const activeProperty = searchParams.get("property") ?? ""
  const activeServiceContact = searchParams.get("serviceContact") ?? ""
  const activeSearch = searchParams.get("q") ?? ""

  useEffect(() => {
    let isMounted = true

    async function fetchActions() {
      setIsLoading(true)
      setError("")

      const [actionsResponse, propertiesResponse, savedViewsResponse] = await Promise.all([
        fetch("/api/dashboard/actions", {
          credentials: "include",
        }),
        fetch("/api/properties", {
          credentials: "include",
        }),
        fetch(`/api/saved-filters?page=${ACTION_SAVED_FILTER_PAGE}`, {
          credentials: "include",
        }),
      ])

      if (
        actionsResponse.status === 401 ||
        propertiesResponse.status === 401 ||
        savedViewsResponse.status === 401
      ) {
        router.push("/login")
        return
      }

      if (!actionsResponse.ok || !propertiesResponse.ok || !savedViewsResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta åtgärder")
        setIsLoading(false)
        return
      }

      const data: ActionsResponse = await actionsResponse.json()
      const propertiesData: RegisteredProperty[] = await propertiesResponse.json()
      const savedViewsData: SavedActionView[] = await savedViewsResponse.json()
      if (!isMounted) return

      setActions(data.actions)
      setRegisteredProperties(propertiesData)
      setSavedViews(savedViewsData)
      setIsLoading(false)
    }

    void fetchActions()

    return () => {
      isMounted = false
    }
  }, [router])

  const summaryCounts = useMemo(() => getActionSummaryCounts(actions), [actions])
  const hasActionsWithoutRegisteredProperty = useMemo(
    () => actions.some((action) => !action.propertyId),
    [actions]
  )
  const serviceContactOptions = useMemo(() => getServiceContactOptions(actions), [actions])
  const visibleActions = useMemo(
    () =>
      filterActionWorkQueue(actions, {
        category: activeCategory,
        severity: activeSeverity,
        propertyId: activeProperty,
        serviceContactId: activeServiceContact,
        dueDate: activeDueDate,
        search: activeSearch,
      }),
    [
      actions,
      activeCategory,
      activeDueDate,
      activeProperty,
      activeSearch,
      activeServiceContact,
      activeSeverity,
    ]
  )

  function updateParam(key: string, value: string, emptyValue = "ALL") {
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedViewId("")
    setSavedViewMessage("")

    if (!value || value === emptyValue) {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    const queryString = params.toString()
    router.replace(queryString ? `/dashboard/actions?${queryString}` : "/dashboard/actions")
  }

  function clearFilters() {
    router.replace("/dashboard/actions")
    setSelectedSavedViewId("")
    setSavedViewMessage("")
  }

  function applySavedView(savedViewId: string) {
    setSelectedSavedViewId(savedViewId)
    setSavedViewMessage("")
    setSavedViewError("")

    if (!savedViewId) return

    const savedView = savedViews.find((view) => view.id === savedViewId)
    if (!savedView) return

    const params = new URLSearchParams(savedView.queryParams)
    router.replace(`/dashboard/actions${params.toString() ? `?${params.toString()}` : ""}`)
  }

  async function handleSaveView(event: React.FormEvent) {
    event.preventDefault()
    setSavedViewError("")
    setSavedViewMessage("")

    const trimmedName = saveViewName.trim()
    if (!trimmedName) {
      setSavedViewError("Ange ett namn fÃ¶r vyn")
      return
    }

    setIsSavingView(true)

    const response = await fetch("/api/saved-filters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: trimmedName,
        page: ACTION_SAVED_FILTER_PAGE,
        queryParams: sanitizeActionFilterQueryParams(searchParams),
      }),
    })
    const result: SavedActionView & { error?: string } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setSavedViewError(result.error || "Kunde inte spara vyn")
      setIsSavingView(false)
      return
    }

    setSavedViews((current) => [result, ...current])
    setSelectedSavedViewId(result.id)
    setSaveViewName("")
    setIsSaveViewOpen(false)
    setSavedViewMessage("Vyn har sparats")
    setIsSavingView(false)
  }

  async function handleDeleteSavedView() {
    if (!selectedSavedViewId) return

    setSavedViewError("")
    setSavedViewMessage("")

    const response = await fetch("/api/saved-filters", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: selectedSavedViewId,
      }),
    })
    const result: { error?: string } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setSavedViewError(result.error || "Kunde inte ta bort vyn")
      return
    }

    setSavedViews((current) => current.filter((view) => view.id !== selectedSavedViewId))
    setSelectedSavedViewId("")
    setSavedViewMessage("Vyn har tagits bort")
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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="Totalt" value={summaryCounts.total} />
          <SummaryCard label="Hög prio" value={summaryCounts.highSeverity} tone="red" />
          <SummaryCard label="Försenade" value={summaryCounts.overdue} tone="red" />
          <SummaryCard label="Kommande" value={summaryCounts.dueSoon} tone="amber" />
          <SummaryCard label="Läckage" value={summaryCounts.leakageFollowUp} tone="red" />
          <SummaryCard label="Saknar servicekontakt" value={summaryCounts.missingServiceContact} />
        </section>

        <Card className="mt-4 p-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  activeCategory === filter.value
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={filter.value}
                type="button"
                onClick={() => updateParam("filter", filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="Prioritet">
              <select
                className={filterControlClassName}
                value={activeSeverity}
                onChange={(event) => updateParam("severity", event.target.value)}
              >
                {SEVERITY_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Fastighet">
              <select
                className={filterControlClassName}
                value={activeProperty}
                onChange={(event) => updateParam("property", event.target.value, "")}
              >
                <option value="">Alla fastigheter</option>
                {registeredProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
                {hasActionsWithoutRegisteredProperty ? (
                  <option value="none">Ingen registrerad fastighet</option>
                ) : null}
              </select>
            </FilterField>

            <FilterField label="Servicekontakt">
              <select
                className={filterControlClassName}
                value={activeServiceContact}
                onChange={(event) => updateParam("serviceContact", event.target.value, "")}
              >
                <option value="">Alla servicekontakter</option>
                {serviceContactOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Förfallodatum">
              <select
                className={filterControlClassName}
                value={activeDueDate}
                onChange={(event) => updateParam("due", event.target.value)}
              >
                {DUE_DATE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label="Sök">
              <input
                className={filterControlClassName}
                placeholder="Aggregat, ID, fastighet..."
                type="search"
                value={activeSearch}
                onChange={(event) => updateParam("q", event.target.value, "")}
              />
            </FilterField>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:min-w-72">
                Sparade vyer
                <select
                  className={filterControlClassName}
                  value={selectedSavedViewId}
                  onChange={(event) => applySavedView(event.target.value)}
                >
                  <option value="">
                    {savedViews.length === 0 ? "Inga sparade vyer än" : "Välj sparad vy"}
                  </option>
                  {savedViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              </label>

              {isSaveViewOpen ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={handleSaveView}
                >
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Vynamn
                    <input
                      className={filterControlClassName}
                      placeholder="Ex. Akuta kontroller"
                      value={saveViewName}
                      onChange={(event) => setSaveViewName(event.target.value)}
                    />
                  </label>
                  <button
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                    disabled={isSavingView}
                    type="submit"
                  >
                    {isSavingView ? "Sparar..." : "Spara vy"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    disabled={isSavingView}
                    type="button"
                    onClick={() => {
                      setIsSaveViewOpen(false)
                      setSaveViewName("")
                      setSavedViewError("")
                    }}
                  >
                    Avbryt
                  </button>
                </form>
              ) : (
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  type="button"
                  onClick={() => {
                    setIsSaveViewOpen(true)
                    setSavedViewError("")
                    setSavedViewMessage("")
                  }}
                >
                  Spara aktuell vy
                </button>
              )}
            </div>

            <button
              className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
              disabled={!selectedSavedViewId}
              type="button"
              onClick={handleDeleteSavedView}
            >
              Ta bort vy
            </button>
          </div>

          {savedViewError ? (
            <p className="mt-3 text-sm font-semibold text-red-700">{savedViewError}</p>
          ) : null}
          {savedViewMessage ? (
            <p className="mt-3 text-sm font-semibold text-green-700">{savedViewMessage}</p>
          ) : null}

          <div className="mt-3 flex justify-end text-xs text-slate-500">
            <button
              className="font-semibold text-blue-700 underline-offset-4 hover:underline"
              type="button"
              onClick={clearFilters}
            >
              Rensa filter
            </button>
          </div>
        </Card>

        {isLoading && <p className="mt-6 text-slate-700">Laddar åtgärder...</p>}
        {error && <p className="mt-6 font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && (
          <Card className="mt-4 overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-950">
                {visibleActions.length} åtgärder
              </p>
              <p className="text-xs text-slate-500">Sorteras efter serverns prioritering.</p>
            </div>
            {visibleActions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-600">
                Inga åtgärder matchar filtret.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {visibleActions.map((action) => (
                  <ActionRow action={action} key={getActionStableKey(action)} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  )
}

const filterControlClassName =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

function SummaryCard({
  label,
  tone = "slate",
  value,
}: {
  label: string
  tone?: "slate" | "red" | "amber"
  value: number
}) {
  const toneClass = {
    slate: "border-l-slate-300",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  }[tone]

  return (
    <Card className={`border-l-4 px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </Card>
  )
}

function FilterField({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ActionRow({ action }: { action: ActionItem }) {
  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={action.severity} />
          <Badge variant="neutral">{ACTION_TYPE_LABELS[action.type]}</Badge>
          <h2 className="text-sm font-semibold text-slate-950">{action.title}</h2>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">
          {action.installationName}
          {action.equipmentId ? (
            <span className="font-normal text-slate-600"> · {action.equipmentId}</span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-slate-600">{action.description}</p>
        <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
          <span>Fastighet: {action.propertyName || "-"}</span>
          <span>Servicekontakt: {action.assignedServiceContactName || "-"}</span>
          <span>{getDateLabel(action)}: {formatActionDate(action)}</span>
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

function getDateLabel(action: ActionItem) {
  if (action.type === "RECENT_LEAKAGE") return "Händelsedatum"
  if (action.dueDate) return "Förfallodatum"
  return "Datum"
}

function formatActionDate(action: ActionItem) {
  const date = action.dueDate ?? action.createdAt
  if (!date) return "-"

  return new Intl.DateTimeFormat("sv-SE").format(new Date(date))
}

function getServiceContactOptions(actions: ActionItem[]) {
  const contacts = new Map<string, { id: string; name: string }>()

  actions.forEach((action) => {
    if (!action.assignedServiceContactId || !action.assignedServiceContactName) return
    contacts.set(action.assignedServiceContactId, {
      id: action.assignedServiceContactId,
      name: action.assignedServiceContactName,
    })
  })

  return Array.from(contacts.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function getActionFilter(value: string | null): ActionFilter {
  return CATEGORY_FILTERS.some((filter) => filter.value === value)
    ? (value as ActionFilter)
    : "ALL"
}

function getSeverityFilter(value: string | null): ActionSeverityFilter {
  return SEVERITY_FILTERS.some((filter) => filter.value === value)
    ? (value as ActionSeverityFilter)
    : "ALL"
}

function getDueDateFilter(value: string | null): ActionDueDateFilter {
  return DUE_DATE_FILTERS.some((filter) => filter.value === value)
    ? (value as ActionDueDateFilter)
    : "ALL"
}
