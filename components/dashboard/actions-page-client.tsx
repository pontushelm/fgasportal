"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useId, useMemo, useState } from "react"
import { Badge, Card, PageHeader, Toast, type ToastMessage } from "@/components/ui"
import {
  ACTION_SAVED_FILTER_PAGE,
  filterActionWorkQueue,
  getActionStableKey,
  getActionSummaryCounts,
  sanitizeActionFilterQueryParams,
  type ActionDueDateFilter,
  type ActionFilter,
  type ActionSeverityFilter,
  type ActionSummaryCounts,
} from "@/lib/actions/action-filters"
import {
  ACTION_LIST_PAGE_SIZE,
  getInitialVisibleActionCount,
  getVisibleActionCount,
} from "@/lib/actions/action-list-display"
import type {
  DashboardActionSeverity,
  DashboardActionSource,
  DashboardActionType,
} from "@/lib/actions/generate-actions"
import {
  API_CACHE_KEYS,
  isUnauthorizedApiError,
  useApiQuery,
} from "@/lib/client/api-cache"

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

const EMPTY_ACTIONS: ActionItem[] = []

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

type SummaryCardTone = "slate" | "red" | "amber" | "sky"

const CATEGORY_FILTERS: Array<{ label: string; value: ActionFilter }> = [
  { label: "Alla", value: "ALL" },
  { label: "Försenade kontroller", value: "OVERDUE_INSPECTIONS" },
  { label: "Kommande kontroller", value: "UPCOMING_INSPECTIONS" },
  { label: "Läckage", value: "LEAKAGE" },
  { label: "Riskbevakning", value: "HIGH_RISK" },
  { label: "Saknar servicepartner", value: "NO_SERVICE_PARTNER" },
  { label: "Servicepartner", value: "SERVICEPARTNER" },
  { label: "Köldmedium", value: "REFRIGERANT_REVIEW" },
  { label: "Servicepartnercertifiering", value: "SERVICEPARTNER_CERTIFICATION" },
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
  NO_SERVICE_PARTNER: "Servicepartner saknas",
  RECENT_LEAKAGE: "Läckage att följa upp",
  REFRIGERANT_REVIEW: "Köldmedium bör granskas",
  SERVICEPARTNER_CERTIFICATE_MISSING: "Servicepartnercertifikat saknas",
  SERVICEPARTNER_CERTIFICATE_EXPIRING: "Servicepartnercertifikat går snart ut",
  SERVICEPARTNER_CERTIFICATE_EXPIRED: "Servicepartnercertifikat har gått ut",
  TECHNICIAN_CERTIFICATE_MISSING: "Tekniker saknar personcertifikat",
  TECHNICIAN_CERTIFICATE_EXPIRING: "Teknikers personcertifikat går snart ut",
  TECHNICIAN_CERTIFICATE_EXPIRED: "Teknikers personcertifikat har gått ut",
  SERVICEPARTNER_INVITE_EXPIRED: "Inbjudan har gått ut",
  SERVICEPARTNER_NO_CONNECTED_ACCOUNT: "Servicepartner saknar konto",
  SERVICEPARTNER_NO_ADMIN: "Serviceansvarig saknas",
  SERVICEPARTNER_NEEDS_COMPLETION: "Servicepartner behöver kompletteras",
}

const SUMMARY_CARD_TOOLTIPS = {
  total: "Alla framräknade uppföljningspunkter utifrån registrerade aggregat och händelser.",
  highSeverity:
    "Högprioriterade åtgärder baseras exempelvis på försenade kontroller, större läckage, högriskaggregat eller andra uppföljningar som bör hanteras snabbt.",
  overdue: "Aggregat där kontrollintervallet har passerats.",
  dueSoon: "Aggregat med kontroll inom kommande period.",
  leakageFollowUp: "Registrerade läckage som kan behöva följas upp.",
  missingServiceContact: "Aggregat utan tilldelat servicepartnerföretag.",
  refrigerantReview:
    "Aggregat med köldmedium som bör kontrolleras mot gällande eller kommande krav.",
  certificationReview:
    "Servicepartners och tekniker där certifiering saknas, har gått ut eller snart behöver förnyas.",
} satisfies Record<string, string>

const SORT_TOOLTIP =
  "Listan sorteras automatiskt efter systemets prioritering. Försenade kontroller och viktiga uppföljningar visas före lägre prioriterade bevakningspunkter."

const SUMMARY_CARDS = [
  {
    key: "overdue",
    label: "Försenade",
    tone: "red",
    tooltip: SUMMARY_CARD_TOOLTIPS.overdue,
  },
  {
    key: "highSeverity",
    label: "Hög prio",
    tone: "red",
    tooltip: SUMMARY_CARD_TOOLTIPS.highSeverity,
  },
  {
    key: "dueSoon",
    label: "Kommande",
    tone: "amber",
    tooltip: SUMMARY_CARD_TOOLTIPS.dueSoon,
  },
  {
    key: "leakageFollowUp",
    label: "Läckage",
    tone: "amber",
    tooltip: SUMMARY_CARD_TOOLTIPS.leakageFollowUp,
  },
  {
    key: "refrigerantReview",
    label: "Köldmedium",
    tone: "sky",
    tooltip: SUMMARY_CARD_TOOLTIPS.refrigerantReview,
  },
  {
    key: "certificationReview",
    label: "Certifiering",
    tone: "amber",
    tooltip: SUMMARY_CARD_TOOLTIPS.certificationReview,
  },
  {
    key: "missingServiceContact",
    label: "Saknar servicepartner",
    tone: "slate",
    tooltip: SUMMARY_CARD_TOOLTIPS.missingServiceContact,
  },
  {
    key: "total",
    label: "Totalt",
    tone: "slate",
    tooltip: SUMMARY_CARD_TOOLTIPS.total,
  },
] satisfies Array<{
  key: keyof ActionSummaryCounts
  label: string
  tone: SummaryCardTone
  tooltip: string
}>

export default function ActionsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const savedViewsKey = API_CACHE_KEYS.savedFilters(ACTION_SAVED_FILTER_PAGE)
  const {
    data: actionsData,
    error: actionsError,
    isLoading: isActionsLoading,
  } = useApiQuery<ActionsResponse>(API_CACHE_KEYS.actions)
  const {
    data: registeredProperties = [],
    error: propertiesError,
    isLoading: isPropertiesLoading,
  } = useApiQuery<RegisteredProperty[]>(API_CACHE_KEYS.properties)
  const {
    data: savedViews = [],
    error: savedViewsError,
    isLoading: isSavedViewsLoading,
    mutate: mutateSavedViews,
  } = useApiQuery<SavedActionView[]>(savedViewsKey)
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("")
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState("")
  const [isSavingView, setIsSavingView] = useState(false)
  const [savedViewError, setSavedViewError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
  const [visibleActionCount, setVisibleActionCount] = useState(ACTION_LIST_PAGE_SIZE)
  const actions = actionsData?.actions ?? EMPTY_ACTIONS
  const isLoading = isActionsLoading || isPropertiesLoading || isSavedViewsLoading
  const error = actionsError ?? propertiesError ?? savedViewsError
  const hasBlockingError = Boolean(error && actions.length === 0)
  const activeCategory = getActionFilter(searchParams.get("filter"))
  const activeSeverity = getSeverityFilter(searchParams.get("severity"))
  const activeDueDate = getDueDateFilter(searchParams.get("due"))
  const activeProperty = searchParams.get("property") ?? ""
  const activeServiceContact = searchParams.get("serviceContact") ?? ""
  const activeServicePartnerCompany = searchParams.get("servicePartnerCompany") ?? ""
  const activeSearch = searchParams.get("q") ?? ""
  const advancedFilterCount = [
    activeDueDate !== "ALL",
    Boolean(activeProperty),
    Boolean(activeServiceContact),
    Boolean(activeServicePartnerCompany),
    Boolean(selectedSavedViewId),
  ].filter(Boolean).length

  useEffect(() => {
    if (isUnauthorizedApiError(error)) {
      router.push("/login")
    }
  }, [error, router])

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
  const displayedActions = visibleActions.slice(0, visibleActionCount)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisibleActionCount(getInitialVisibleActionCount(visibleActions.length))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeCategory,
    activeDueDate,
    activeProperty,
    activeSearch,
    activeServiceContact,
    activeServicePartnerCompany,
    activeSeverity,
    visibleActions.length,
  ])

  function updateParam(key: string, value: string, emptyValue = "ALL") {
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedViewId("")

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
  }

  function applySavedView(savedViewId: string) {
    setSelectedSavedViewId(savedViewId)
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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte spara vyn.",
      })
      setIsSavingView(false)
      return
    }

    await mutateSavedViews((current = []) => [result, ...current], {
      revalidate: false,
    })
    setSelectedSavedViewId(result.id)
    setSaveViewName("")
    setIsSaveViewOpen(false)
    setToast({
      type: "success",
      title: "Klart",
      message: "Vyn har sparats.",
    })
    setIsSavingView(false)
  }

  async function handleDeleteSavedView() {
    if (!selectedSavedViewId) return

    setSavedViewError("")

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
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte ta bort vyn.",
      })
      return
    }

    await mutateSavedViews(
      (current = []) => current.filter((view) => view.id !== selectedSavedViewId),
      { revalidate: false }
    )
    setSelectedSavedViewId("")
    setToast({
      type: "success",
      title: "Klart",
      message: "Vyn har tagits bort.",
    })
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
        <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:gap-3">
          {isLoading && actions.length === 0
            ? Array.from({ length: SUMMARY_CARDS.length }).map((_, index) => (
                <Card
                  className="border-l-4 border-l-slate-200 px-3 py-3"
                  key={index}
                >
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="mt-3 h-7 w-12 animate-pulse rounded bg-slate-200" />
                </Card>
              ))
            : SUMMARY_CARDS.map((card) => (
                <SummaryCard
                  key={card.key}
                  label={card.label}
                  tone={card.tone}
                  tooltip={card.tooltip}
                  value={summaryCounts[card.key]}
                />
              ))}
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
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
            <FilterField label="Sök">
              <input
                className={filterControlClassName}
                placeholder="Aggregat, ID, fastighet..."
                type="search"
                value={activeSearch}
                onChange={(event) => updateParam("q", event.target.value, "")}
              />
            </FilterField>
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
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
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

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="self-start rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              type="button"
              onClick={() => setIsAdvancedFiltersOpen((current) => !current)}
            >
              {isAdvancedFiltersOpen ? "Dölj fler filter" : "Fler filter"}
              {advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}
            </button>
            {advancedFilterCount > 0 ? (
              <span className="text-xs font-semibold text-blue-800">
                {advancedFilterCount} dolda filter är aktiva
              </span>
            ) : null}
          </div>

          {isAdvancedFiltersOpen || advancedFilterCount > 0 ? (
          <>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          </>
          ) : null}

          </div>
        </Card>

        {isLoading && actions.length === 0 && <ActionsLoadingSkeleton />}
        {hasBlockingError && error && !isUnauthorizedApiError(error) && (
          <p className="mt-6 font-semibold text-red-700">
            {error.message || "Kunde inte hämta åtgärder"}
          </p>
        )}

        {(!isLoading || actions.length > 0) && !hasBlockingError && (
          <Card className="mt-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                {visibleActions.length} åtgärder
              </p>
              <InfoTooltip text={SORT_TOOLTIP} />
            </div>
            {visibleActions.length === 0 ? (
              <div className="px-4 py-8">
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700">
                  <h2 className="font-semibold text-slate-950">Inga åtgärder att visa</h2>
                  <p className="mt-1">
                    När registerstatus, kontroller eller certifikat behöver följas upp
                    visas de här som prioriterade åtgärder.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      href="/dashboard/data-quality"
                    >
                      Öppna registerstatus
                    </Link>
                    <Link
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      href="/dashboard/installations"
                    >
                      Visa aggregat
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {displayedActions.map((action) => (
                  <ActionRow action={action} key={getActionStableKey(action)} />
                ))}
              </div>
            )}
            {visibleActions.length > ACTION_LIST_PAGE_SIZE ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Visar {displayedActions.length} av {visibleActions.length} åtgärder
                </span>
                {displayedActions.length < visibleActions.length ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50"
                      type="button"
                      onClick={() =>
                        setVisibleActionCount((current) =>
                          getVisibleActionCount({
                            totalCount: visibleActions.length,
                            visibleCount: current,
                          })
                        )
                      }
                    >
                      Visa fler
                    </button>
                    <button
                      className="rounded-md border border-blue-200 bg-white px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                      type="button"
                      onClick={() => setVisibleActionCount(visibleActions.length)}
                    >
                      Visa alla
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        )}
      </div>
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
    </main>
  )
}

const filterControlClassName =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

function ActionsLoadingSkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-live="polite" aria-busy="true">
      <Card className="p-4">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Laddar åtgärder...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hämtar aggregat och beräknar prioriterade uppföljningar.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="h-10 animate-pulse rounded-lg bg-slate-100"
              key={index}
            />
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_9rem]"
              key={index}
            >
              <div>
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-9 animate-pulse rounded-md bg-slate-100" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  tone = "slate",
  tooltip,
  value,
}: {
  label: string
  tone?: SummaryCardTone
  tooltip: string
  value: number
}) {
  const toneClass = {
    slate: "border-l-slate-300",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    sky: "border-l-sky-500",
  }[tone]
  const tooltipId = useId()

  return (
    <Card className={`relative border-l-4 px-3 py-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
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
            {tooltip}
          </span>
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
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
          {!isCertificationAction(action.type) && (
            <>
              <span>Fastighet: {action.propertyName || "-"}</span>
              <span>Servicekontakt: {action.assignedServiceContactName || "-"}</span>
            </>
          )}
          <span>Företag: {action.servicePartnerCompanyName || "-"}</span>
          <span>{getDateLabel(action)}: {formatActionDate(action)}</span>
        </div>
      </div>
      <Link
        className="inline-flex min-h-11 justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 md:min-h-0"
        href={action.href}
      >
        {isCertificationAction(action.type)
          ? "Öppna certifiering"
          : "Öppna aggregat"}
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
  if (isCertificationAction(action.type)) return "Giltigt till"
  if (action.dueDate) return "Förfallodatum"
  return "Datum"
}

function isCertificationAction(type: DashboardActionType) {
  return (
    type === "SERVICEPARTNER_CERTIFICATE_MISSING" ||
    type === "SERVICEPARTNER_CERTIFICATE_EXPIRING" ||
    type === "SERVICEPARTNER_CERTIFICATE_EXPIRED" ||
    type === "TECHNICIAN_CERTIFICATE_MISSING" ||
    type === "TECHNICIAN_CERTIFICATE_EXPIRING" ||
    type === "TECHNICIAN_CERTIFICATE_EXPIRED"
  )
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
