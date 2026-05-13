"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useMemo, useState } from "react"
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
  servicePartnerCompanyId: string | null
  servicePartnerCompanyName: string | null
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
  { label: "Riskbevakning", value: "HIGH_RISK" },
  { label: "Saknar servicekontakt", value: "NO_SERVICE_PARTNER" },
  { label: "Köldmedium", value: "REFRIGERANT_REVIEW" },
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
  HIGH_RISK: "Riskbevakning",
  NO_SERVICE_PARTNER: "Servicekontakt saknas",
  RECENT_LEAKAGE: "Läckage att följa upp",
  REFRIGERANT_REVIEW: "Köldmedium bör granskas",
}

const SUMMARY_CARD_TOOLTIPS = {
  total: "Alla framräknade uppföljningspunkter utifrån registrerade aggregat och händelser.",
  highSeverity: "Punkter som bör prioriteras först, exempelvis försenade kontroller.",
  overdue: "Aggregat där kontrollintervallet har passerats.",
  dueSoon: "Aggregat med kontroll inom kommande period.",
  leakageFollowUp: "Registrerade läckage som kan behöva följas upp.",
  missingServiceContact: "Aggregat utan tilldelad servicekontakt.",
  refrigerantReview:
    "Aggregat med köldmedium som bör kontrolleras mot gällande eller kommande krav.",
} satisfies Record<string, string>

const SORT_TOOLTIP =
  "Listan sorteras automatiskt efter systemets prioritering. Försenade kontroller och viktiga uppföljningar visas före lägre prioriterade bevakningspunkter."

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
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const activeCategory = getActionFilter(searchParams.get("filter"))
  const activeSeverity = getSeverityFilter(searchParams.get("severity"))
  const activeDueDate = getDueDateFilter(searchParams.get("due"))
  const activeProperty = searchParams.get("property") ?? ""
  const activeServiceContact = searchParams.get("serviceContact") ?? ""
  const activeServicePartnerCompany = searchParams.get("servicePartnerCompany") ?? ""
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
  const servicePartnerCompanyOptions = useMemo(
    () => getServicePartnerCompanyOptions(actions),
    [actions]
  )
  const visibleActions = useMemo(
    () =>
      filterActionWorkQueue(actions, {
        category: activeCategory,
        severity: activeSeverity,
        propertyId: activeProperty,
        serviceContactId: activeServiceContact,
        servicePartnerCompanyId: activeServicePartnerCompany,
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
      activeServicePartnerCompany,
      activeSeverity,
    ]
  )
  const activeFilterLabels = useMemo(
    () =>
      getActiveFilterLabels({
        activeCategory,
        activeDueDate,
        activeProperty,
        activeSearch,
        activeServiceContact,
        activeServicePartnerCompany,
        activeSeverity,
        registeredProperties,
        serviceContactOptions,
        servicePartnerCompanyOptions,
      }),
    [
      activeCategory,
      activeDueDate,
      activeProperty,
      activeSearch,
      activeServiceContact,
      activeServicePartnerCompany,
      activeSeverity,
      registeredProperties,
      serviceContactOptions,
      servicePartnerCompanyOptions,
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
    <main className="min-h-screen bg-slate-50 px-3 py-6 text-slate-900 sm:px-6 sm:py-8 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <PageHeader
          title="Åtgärder"
          subtitle="Operativ översikt över aggregat som kräver uppföljning."
        />
      </section>

      <div className="mx-auto mt-6 max-w-7xl">
        <section className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 xl:gap-3">
            <SummaryCard
              label="Totalt"
              tooltip={SUMMARY_CARD_TOOLTIPS.total}
              value={summaryCounts.total}
            />
            <SummaryCard
              label="Hög prio"
              tone="red"
              tooltip={SUMMARY_CARD_TOOLTIPS.highSeverity}
              value={summaryCounts.highSeverity}
            />
            <SummaryCard
              label="Försenade"
              tone="red"
              tooltip={SUMMARY_CARD_TOOLTIPS.overdue}
              value={summaryCounts.overdue}
            />
            <SummaryCard
              label="Kommande"
              tone="amber"
              tooltip={SUMMARY_CARD_TOOLTIPS.dueSoon}
              value={summaryCounts.dueSoon}
            />
            <SummaryCard
              label="Läckage"
              tone="amber"
              tooltip={SUMMARY_CARD_TOOLTIPS.leakageFollowUp}
              value={summaryCounts.leakageFollowUp}
            />
            <SummaryCard
              label="Saknar servicekontakt"
              tooltip={SUMMARY_CARD_TOOLTIPS.missingServiceContact}
              value={summaryCounts.missingServiceContact}
            />
            <SummaryCard
              label="Köldmedium"
              tooltip={SUMMARY_CARD_TOOLTIPS.refrigerantReview}
              value={summaryCounts.refrigerantReview}
            />
        </section>

        <Card className="sticky top-0 z-20 mt-4 p-3 shadow-sm sm:static sm:p-4 sm:shadow-none">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <div>
              <p className="text-sm font-semibold text-slate-950">Filter</p>
              <p className="text-xs text-slate-500">
                {activeFilterLabels.length > 0
                  ? `${activeFilterLabels.length} aktiva`
                  : "Alla åtgärder"}
              </p>
            </div>
            <button
              className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              type="button"
              onClick={() => setIsFilterPanelOpen((current) => !current)}
            >
              {isFilterPanelOpen ? "Dölj filter" : "Visa filter"}
            </button>
          </div>

          <div className="hidden items-center justify-between gap-3 sm:flex">
            <div>
              <p className="text-sm font-semibold text-slate-950">Filter</p>
              <p className="text-xs text-slate-500">
                {activeFilterLabels.length > 0
                  ? `${activeFilterLabels.length} aktiva filter`
                  : "Alla åtgärder visas"}
              </p>
            </div>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={clearFilters}
            >
              Rensa filter
            </button>
          </div>

          {activeFilterLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterLabels.map((label) => (
                <span
                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800"
                  key={label}
                >
                  {label}
                </span>
              ))}
              <button
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:hidden"
                type="button"
                onClick={clearFilters}
              >
                Rensa filter
              </button>
            </div>
          )}

          <div className={`${isFilterPanelOpen ? "block" : "hidden"} sm:block`}>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                className={`min-h-10 shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${
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

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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

          <div className="mt-3 max-w-sm">
            <FilterField label="Servicepartnerföretag">
              <select
                className={filterControlClassName}
                value={activeServicePartnerCompany}
                onChange={(event) => updateParam("servicePartnerCompany", event.target.value, "")}
              >
                <option value="">Alla företag</option>
                {servicePartnerCompanyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
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

          </div>
        </Card>

        {isLoading && <p className="mt-6 text-slate-700">Laddar åtgärder...</p>}
        {error && <p className="mt-6 font-semibold text-red-700">{error}</p>}

        {!isLoading && !error && (
          <Card className="mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                {visibleActions.length} åtgärder
              </p>
              <InfoTooltip text={SORT_TOOLTIP} />
            </div>
            {visibleActions.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-600">
                Inga åtgärder matchar filtret. Prova att rensa filter eller visa alla åtgärder.
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
  tooltip,
  value,
}: {
  label: string
  tone?: "slate" | "red" | "amber"
  tooltip: string
  value: number
}) {
  const toneClass = {
    slate: "border-l-slate-300",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  }[tone]
  const tooltipId = useId()

  return (
    <Card
      aria-describedby={tooltipId}
      className={`group relative border-l-4 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${toneClass}`}
      tabIndex={0}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
      <span
        className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {tooltip}
      </span>
    </Card>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const tooltipId = useId()

  return (
    <span className="group/help relative inline-flex">
      <button
        aria-describedby={tooltipId}
        aria-label="Visa hjälptext"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        type="button"
      >
        i
      </button>
      <span
        className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-700 opacity-0 shadow-lg transition-opacity group-hover/help:opacity-100 group-focus-within/help:opacity-100"
        id={tooltipId}
        role="tooltip"
      >
        {text}
      </span>
    </span>
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
    <article className="grid gap-3 px-3 py-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <ActionPriorityBadge action={action} />
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
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>Fastighet: {action.propertyName || "-"}</span>
          <span>Servicekontakt: {action.assignedServiceContactName || "-"}</span>
          <span>Företag: {action.servicePartnerCompanyName || "-"}</span>
          <span>{getDateLabel(action)}: {formatActionDate(action)}</span>
        </div>
      </div>
      <Link
        className="inline-flex min-h-11 justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 md:min-h-0"
        href={action.href}
      >
        Öppna aggregat
      </Link>
    </article>
  )
}

function ActionPriorityBadge({ action }: { action: ActionItem }) {
  if (action.type === "HIGH_RISK") {
    return <Badge variant="neutral">Bevakning</Badge>
  }

  return <SeverityBadge severity={action.severity} />
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

function getServicePartnerCompanyOptions(actions: ActionItem[]) {
  const companies = new Map<string, { id: string; name: string }>()

  actions.forEach((action) => {
    if (!action.servicePartnerCompanyId || !action.servicePartnerCompanyName) return
    companies.set(action.servicePartnerCompanyId, {
      id: action.servicePartnerCompanyId,
      name: action.servicePartnerCompanyName,
    })
  })

  return Array.from(companies.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function getActiveFilterLabels({
  activeCategory,
  activeDueDate,
  activeProperty,
  activeSearch,
  activeServiceContact,
  activeServicePartnerCompany,
  activeSeverity,
  registeredProperties,
  serviceContactOptions,
  servicePartnerCompanyOptions,
}: {
  activeCategory: ActionFilter
  activeDueDate: ActionDueDateFilter
  activeProperty: string
  activeSearch: string
  activeServiceContact: string
  activeServicePartnerCompany: string
  activeSeverity: ActionSeverityFilter
  registeredProperties: RegisteredProperty[]
  serviceContactOptions: Array<{ id: string; name: string }>
  servicePartnerCompanyOptions: Array<{ id: string; name: string }>
}) {
  const labels: string[] = []
  const category = CATEGORY_FILTERS.find((filter) => filter.value === activeCategory)
  const severity = SEVERITY_FILTERS.find((filter) => filter.value === activeSeverity)
  const dueDate = DUE_DATE_FILTERS.find((filter) => filter.value === activeDueDate)

  if (category && category.value !== "ALL") labels.push(category.label)
  if (severity && severity.value !== "ALL") labels.push(severity.label)
  if (dueDate && dueDate.value !== "ALL") labels.push(dueDate.label)
  if (activeProperty === "none") {
    labels.push("Ingen registrerad fastighet")
  } else if (activeProperty) {
    labels.push(
      registeredProperties.find((property) => property.id === activeProperty)?.name ??
        "Vald fastighet"
    )
  }
  if (activeServiceContact) {
    labels.push(
      serviceContactOptions.find((contact) => contact.id === activeServiceContact)?.name ??
        "Vald servicekontakt"
    )
  }
  if (activeServicePartnerCompany) {
    labels.push(
      servicePartnerCompanyOptions.find(
        (company) => company.id === activeServicePartnerCompany
      )?.name ?? "Valt servicepartnerföretag"
    )
  }
  if (activeSearch) labels.push(`Sök: ${activeSearch}`)

  return labels
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
