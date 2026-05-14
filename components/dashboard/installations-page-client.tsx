"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import ImportInstallationsPage from "@/components/dashboard/installations-import-page-client"
import CreateInstallationForm from "@/components/installations/create-installation-form"
import { Button, Card, PageHeader } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import {
  getRefrigerantRegulatoryStatus,
  type RefrigerantRegulatoryStatus,
} from "@/lib/refrigerant-regulatory-status"
import { REFRIGERANT_GWP } from "@/lib/refrigerants"
import type { InstallationRiskLevel } from "@/lib/risk-classification"
import { isAdminRole } from "@/lib/roles"

type Installation = {
  id: string
  name: string
  location: string
  propertyId?: string | null
  property?: PropertyOption | null
  equipmentId?: string | null
  serialNumber?: string | null
  refrigerantType: string
  refrigerantAmount: number
  co2eTon: number | null
  inspectionInterval?: number | null
  riskLevel: InstallationRiskLevel
  riskScore: number
  complianceStatus: ComplianceStatus
  nextInspection?: string | null
  updatedAt: string
  isActive: boolean
  archivedAt?: string | null
  scrappedAt?: string | null
  assignedContractor?: Contractor | null
  assignedServicePartnerCompany?: ServicePartnerCompanySummary | null
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type Contractor = {
  id: string
  name: string
  email: string
  servicePartnerCompany?: ServicePartnerCompanySummary | null
}

type ServicePartnerCompanySummary = {
  id: string
  name: string
  organizationNumber?: string | null
}

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
  city?: string | null
}

type InstallationEventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"

type InstallationEvent = {
  id: string
  date: string
  type: InstallationEventType
  refrigerantAddedKg?: number | null
  notes?: string | null
}

type SavedFilter = {
  id: string
  name: string
  page: string
  queryParams: Record<string, string>
  createdAt: string
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  OK: "OK",
  DUE_SOON: "Kontroll inom 30 dagar",
  OVERDUE: "Försenad kontroll",
  NOT_REQUIRED: "Ej kontrollpliktig",
  NOT_INSPECTED: "Ej kontrollerad",
}

const STATUS_TONE: Record<ComplianceStatus, string> = {
  OK: "border-emerald-300 bg-emerald-50 text-emerald-900",
  DUE_SOON: "border-amber-300 bg-amber-50 text-amber-900",
  OVERDUE: "border-red-300 bg-red-50 text-red-900",
  NOT_REQUIRED: "border-slate-300 bg-slate-50 text-slate-800",
  NOT_INSPECTED: "border-sky-300 bg-sky-50 text-sky-900",
}

const RISK_LABELS: Record<InstallationRiskLevel, string> = {
  LOW: "Låg",
  MEDIUM: "Medel",
  HIGH: "Hög",
}

const RISK_TONE: Record<InstallationRiskLevel, string> = {
  LOW: "border-emerald-300 bg-emerald-50 text-emerald-900",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900",
  HIGH: "border-red-300 bg-red-50 text-red-900",
}

const REGULATORY_STATUS_TONE: Record<RefrigerantRegulatoryStatus, string> = {
  OK: "border-emerald-300 bg-emerald-50 text-emerald-900",
  REVIEW: "border-sky-300 bg-sky-50 text-sky-900",
  RESTRICTED: "border-red-300 bg-red-50 text-red-900",
  PHASE_OUT_RISK: "border-amber-300 bg-amber-50 text-amber-900",
  UNKNOWN: "border-slate-300 bg-slate-50 text-slate-800",
}

const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "Senast uppdaterad" },
  { value: "updatedAt:asc", label: "Äldst uppdaterad" },
  { value: "nextInspectionDate:asc", label: "Nästa kontroll, tidigast först" },
  { value: "nextInspectionDate:desc", label: "Nästa kontroll, senast först" },
  { value: "co2e:desc", label: "CO₂e, högst först" },
  { value: "co2e:asc", label: "CO₂e, lägst först" },
]
const SAVED_FILTER_PAGE = "installations"
const filterControlClassName =
  "h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
const bulkSecondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
const bulkDestructiveButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"

export default function InstallationsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const searchValue = searchParams.get("q") || ""
  const archivedValue = searchParams.get("archived") || ""
  const refrigerantValue = searchParams.get("refrigerantType") || ""
  const contractorFilterValue = searchParams.get("contractorId") || ""
  const servicePartnerCompanyFilterValue = searchParams.get("servicePartnerCompanyId") || ""
  const propertyFilterValue = searchParams.get("propertyId") || ""
  const municipalityFilterValue = searchParams.get("municipality") || ""
  const statusValue = searchParams.get("status") || ""
  const riskFilterValue = searchParams.get("risk") || ""
  const inspectionIntervalFilterValue = searchParams.get("inspectionInterval") || ""
  const statusFilterValue =
    statusValue ||
    (archivedValue === "archived" ? "archived" : archivedValue === "active" ? "active" : "")
  const sortValue = `${searchParams.get("sort") || "updatedAt"}:${searchParams.get("direction") || "desc"}`
  const [installations, setInstallations] = useState<Installation[]>([])
  const [filterSourceInstallations, setFilterSourceInstallations] = useState<Installation[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [servicePartnerCompanies, setServicePartnerCompanies] = useState<ServicePartnerCompanySummary[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkServicePartnerCompanyId, setBulkServicePartnerCompanyId] = useState("")
  const [contractorId, setContractorId] = useState("")
  const [bulkPropertyId, setBulkPropertyId] = useState("")
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "servicepartner" | "property" | "archive" | null
  >(null)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [isFeedbackExiting, setIsFeedbackExiting] = useState(false)
  const [isBulkPanelFloating, setIsBulkPanelFloating] = useState(false)
  const bulkPanelSentinelRef = useRef<HTMLDivElement | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedInstallation, setSelectedInstallation] =
    useState<Installation | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<InstallationEvent[]>([])
  const [isQuickViewLoading, setIsQuickViewLoading] = useState(false)
  const [quickViewError, setQuickViewError] = useState("")
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState("")
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState("")
  const [isSavingFilter, setIsSavingFilter] = useState(false)
  const [savedFilterError, setSavedFilterError] = useState("")
  const [savedFilterSuccess, setSavedFilterSuccess] = useState("")
  const [searchInputState, setSearchInputState] = useState({
    sourceValue: searchValue,
    value: searchValue,
  })
  const searchInputValue =
    searchInputState.sourceValue === searchValue
      ? searchInputState.value
      : searchValue
  const canManage = isAdminRole(currentUser?.role)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      setIsLoading(true)
      setError("")

      const installationsUrl = `/api/installations${queryString ? `?${queryString}` : ""}`
      const [installationsRes, userRes, filterSourceRes, savedFiltersRes, propertiesRes, servicePartnerCompaniesRes] = await Promise.all([
        fetch(installationsUrl, {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        fetch("/api/installations?archived=all", {
          credentials: "include",
        }),
        fetch(`/api/saved-filters?page=${SAVED_FILTER_PAGE}`, {
          credentials: "include",
        }),
        fetch("/api/properties", {
          credentials: "include",
        }),
        fetch("/api/service-partner-companies", {
          credentials: "include",
        }),
      ])

      if (
        installationsRes.status === 401 ||
        userRes.status === 401 ||
        savedFiltersRes.status === 401 ||
        propertiesRes.status === 401
      ) {
        router.push("/login")
        return
      }

      if (!installationsRes.ok || !userRes.ok || !filterSourceRes.ok || !savedFiltersRes.ok || !propertiesRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta aggregat")
        setIsLoading(false)
        return
      }

      const installationsData: Installation[] = await installationsRes.json()
      const userData: CurrentUser = await userRes.json()
      const filterSourceData: Installation[] = await filterSourceRes.json()
      const savedFiltersData: SavedFilter[] = await savedFiltersRes.json()
      const propertiesData: PropertyOption[] = await propertiesRes.json()
      const servicePartnerCompaniesData: ServicePartnerCompanySummary[] =
        servicePartnerCompaniesRes.ok ? await servicePartnerCompaniesRes.json() : []
      const contractorsData: Contractor[] =
        isAdminRole(userData.role)
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : deriveContractors(filterSourceData)

      if (!isMounted) return

      setInstallations(installationsData)
      setFilterSourceInstallations(filterSourceData)
      setCurrentUser(userData)
      setContractors(contractorsData)
      setServicePartnerCompanies(servicePartnerCompaniesData)
      setProperties(propertiesData)
      setSavedFilters(savedFiltersData)
      setSelectedIds([])
      setIsLoading(false)
    }

    void fetchData()

    return () => {
      isMounted = false
    }
  }, [queryString, refreshKey, router])

  useEffect(() => {
    let isMounted = true

    async function fetchSelectedEvents() {
      if (!selectedInstallation) {
        setSelectedEvents([])
        setQuickViewError("")
        return
      }

      setIsQuickViewLoading(true)
      setQuickViewError("")

      const res = await fetch(`/api/installations/${selectedInstallation.id}/events`, {
        credentials: "include",
      })

      if (!isMounted) return

      if (res.status === 401) {
        router.push("/login")
        return
      }

      if (!res.ok) {
        setQuickViewError("Kunde inte hämta historik")
        setSelectedEvents([])
        setIsQuickViewLoading(false)
        return
      }

      const events: InstallationEvent[] = await res.json()
      setSelectedEvents(events)
      setIsQuickViewLoading(false)
    }

    void fetchSelectedEvents()

    return () => {
      isMounted = false
    }
  }, [router, selectedInstallation])

  useEffect(() => {
    if (!feedback) return

    const fadeTimeoutId = window.setTimeout(() => {
      setIsFeedbackExiting(true)
    }, 4600)

    return () => window.clearTimeout(fadeTimeoutId)
  }, [feedback])

  useEffect(() => {
    if (!feedback || !isFeedbackExiting) return

    const removeTimeoutId = window.setTimeout(() => {
      setFeedback(null)
      setIsFeedbackExiting(false)
    }, 250)

    return () => window.clearTimeout(removeTimeoutId)
  }, [feedback, isFeedbackExiting])

  useEffect(() => {
    const sentinel = bulkPanelSentinelRef.current

    if (!canManage || !sentinel) {
      setIsBulkPanelFloating(false)
      return
    }

    const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBulkPanelFloating(isDesktop() && !entry.isIntersecting)
      },
      {
        rootMargin: "-96px 0px 0px 0px",
        threshold: 0,
      }
    )
    const handleResize = () => {
      if (!isDesktop()) setIsBulkPanelFloating(false)
    }

    observer.observe(sentinel)
    window.addEventListener("resize", handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", handleResize)
    }
  }, [canManage, installations.length, isLoading])

  function dismissFeedback() {
    setIsFeedbackExiting(true)
  }

  function showFeedback(nextFeedback: {
    type: "success" | "error"
    message: string
  }) {
    setIsFeedbackExiting(false)
    setFeedback(nextFeedback)
  }

  const hasSelectedInstallations = selectedIds.length > 0
  const allSelected = useMemo(
    () => installations.length > 0 && selectedIds.length === installations.length,
    [installations.length, selectedIds.length]
  )
  const refrigerantOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(REFRIGERANT_GWP),
          ...filterSourceInstallations
            .map((installation) => installation.refrigerantType)
            .filter(Boolean),
        ])
      ).sort((first, second) => first.localeCompare(second, "sv")),
    [filterSourceInstallations]
  )
  const municipalityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...properties.map((property) => property.municipality),
            ...filterSourceInstallations.map(
              (installation) => installation.property?.municipality
            ),
          ].filter((value): value is string => Boolean(value))
        )
      ).sort((first, second) => first.localeCompare(second, "sv")),
    [filterSourceInstallations, properties]
  )
  const servicePartnerCompanyOptions = useMemo(
    () =>
      deriveServicePartnerCompanies(
        contractors,
        filterSourceInstallations,
        servicePartnerCompanies
      ),
    [contractors, filterSourceInstallations, servicePartnerCompanies]
  )
  const bulkContactOptions = useMemo(
    () =>
      bulkServicePartnerCompanyId
        ? contractors.filter(
            (contractor) =>
              contractor.servicePartnerCompany?.id === bulkServicePartnerCompanyId
          )
        : contractors,
    [bulkServicePartnerCompanyId, contractors]
  )
  const hasActiveFilters = Boolean(
    searchValue ||
      statusFilterValue ||
      refrigerantValue ||
      contractorFilterValue ||
      servicePartnerCompanyFilterValue ||
      propertyFilterValue ||
      municipalityFilterValue ||
      statusValue ||
      riskFilterValue ||
      inspectionIntervalFilterValue
  )

  const updateQueryParam = useCallback((name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedFilterId("")
    setSavedFilterSuccess("")

    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }

    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }, [router, searchParams])

  useEffect(() => {
    const nextSearchValue = searchInputValue.trim()
    if (nextSearchValue === searchValue) return

    const timeoutId = window.setTimeout(() => {
      updateQueryParam("q", nextSearchValue)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchInputValue, searchValue, updateQueryParam])

  function updateSort(value: string) {
    const [sort, direction] = value.split(":")
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedFilterId("")
    setSavedFilterSuccess("")

    params.set("sort", sort)
    params.set("direction", direction)
    router.replace(`/dashboard/installations?${params.toString()}`)
  }

  function updateStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedFilterId("")
    setSavedFilterSuccess("")

    params.delete("status")
    params.delete("archived")

    if (value === "active") {
      params.set("archived", "active")
    } else if (value === "all") {
      params.set("archived", "all")
    } else if (value) {
      params.set("status", value)
    }

    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function clearFilters() {
    router.replace("/dashboard/installations")
    setSelectedSavedFilterId("")
  }

  function applySavedFilter(savedFilterId: string) {
    setSelectedSavedFilterId(savedFilterId)

    if (!savedFilterId) return

    const savedFilter = savedFilters.find((filter) => filter.id === savedFilterId)
    if (!savedFilter) return

    const params = new URLSearchParams(savedFilter.queryParams)
    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }

  async function handleSaveFilter(event: React.FormEvent) {
    event.preventDefault()
    setSavedFilterError("")
    setSavedFilterSuccess("")

    const trimmedName = saveFilterName.trim()

    if (!trimmedName) {
      setSavedFilterError("Ange ett namn för filtret")
      return
    }

    setIsSavingFilter(true)

    const res = await fetch("/api/saved-filters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name: trimmedName,
        page: SAVED_FILTER_PAGE,
        queryParams: Object.fromEntries(searchParams.entries()),
      }),
    })
    const result: SavedFilter & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setSavedFilterError(result.error || "Kunde inte spara filtret")
      setIsSavingFilter(false)
      return
    }

    setSavedFilters((current) => [result, ...current])
    setSelectedSavedFilterId(result.id)
    setSaveFilterName("")
    setIsSaveFilterOpen(false)
    setSavedFilterSuccess("Filtret har sparats")
    setIsSavingFilter(false)
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : installations.map((installation) => installation.id))
  }

  function toggleInstallation(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    )
  }

  async function handleAssignContractor(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setFeedback(null)

    if (!bulkServicePartnerCompanyId && !contractorId) {
      showFeedback({
        type: "error",
        message: "Välj servicepartnerföretag eller servicekontakt.",
      })
      return
    }

    const selectedCompanyName =
      servicePartnerCompanyOptions.find((company) => company.id === bulkServicePartnerCompanyId)
        ?.name ?? "vald servicepartner"

    setIsSubmitting(true)
    setPendingBulkAction("servicepartner")

    const res = await fetch("/api/installations/bulk/assign-contractor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: selectedIds,
        servicePartnerCompanyId: bulkServicePartnerCompanyId || null,
        contractorId: contractorId || null,
      }),
    })
    const result: { error?: string; updated?: number } = await res.json()

    if (res.status === 401) {
      setIsSubmitting(false)
      setPendingBulkAction(null)
      router.push("/login")
      return
    }

    if (!res.ok) {
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte tilldela servicepartner.",
      })
      setBulkServicePartnerCompanyId("")
      setContractorId("")
      setIsAssignModalOpen(false)
      setIsSubmitting(false)
      setPendingBulkAction(null)
      return
    }

    showFeedback({
      type: "success",
      message: `${result.updated ?? selectedIds.length} aggregat tilldelades ${selectedCompanyName}.`,
    })
    setBulkServicePartnerCompanyId("")
    setContractorId("")
    setIsAssignModalOpen(false)
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    setRefreshKey((current) => current + 1)
  }

  async function handleArchiveSelected() {
    setError("")
    setFeedback(null)

    const confirmed = window.confirm(
      `Arkivera ${selectedIds.length} valda aggregat?`
    )

    if (!confirmed) return

    setIsSubmitting(true)
    setPendingBulkAction("archive")

    const res = await fetch("/api/installations/bulk/archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: selectedIds,
      }),
    })
    const result: { error?: string; archived?: number } = await res.json()

    if (res.status === 401) {
      setIsSubmitting(false)
      setPendingBulkAction(null)
      router.push("/login")
      return
    }

    if (!res.ok) {
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte arkivera aggregat.",
      })
      setSelectedIds([])
      setIsSubmitting(false)
      setPendingBulkAction(null)
      return
    }

    showFeedback({
      type: "success",
      message: `${result.archived ?? selectedIds.length} aggregat arkiverades.`,
    })
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    setRefreshKey((current) => current + 1)
  }

  async function handleAssignProperty(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setFeedback(null)
    const selectedPropertyName =
      properties.find((property) => property.id === bulkPropertyId)?.name ??
      "vald fastighet"
    setIsSubmitting(true)
    setPendingBulkAction("property")

    const res = await fetch("/api/installations/bulk/assign-property", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: selectedIds,
        propertyId: bulkPropertyId || null,
      }),
    })
    const result: { error?: string; updated?: number } = await res.json()

    if (res.status === 401) {
      setIsSubmitting(false)
      setPendingBulkAction(null)
      router.push("/login")
      return
    }

    if (!res.ok) {
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte tilldela fastighet.",
      })
      setBulkPropertyId("")
      setIsPropertyModalOpen(false)
      setIsSubmitting(false)
      setPendingBulkAction(null)
      return
    }

    showFeedback({
      type: "success",
      message: bulkPropertyId
        ? `${result.updated ?? selectedIds.length} aggregat kopplades till ${selectedPropertyName}.`
        : `${result.updated ?? selectedIds.length} aggregat fick fastighetskopplingen borttagen.`,
    })
    setBulkPropertyId("")
    setIsPropertyModalOpen(false)
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    setRefreshKey((current) => current + 1)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          <>
            {canManage && (
              <Button
                type="button"
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Skapa aggregat
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
            >
              Importera aggregat
            </Button>
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              href="/dashboard/installations/import-events"
            >
              Importera händelser
            </Link>
          </>
        }
        title="Aggregat"
        subtitle="Översikt över organisationens köldmedieaggregat."
      />
      <Card className="mt-6 p-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Sök
            <input
              className={filterControlClassName}
              placeholder="Namn, plats eller ID"
              type="search"
              value={searchInputValue}
              onChange={(event) =>
                setSearchInputState({
                  sourceValue: searchValue,
                  value: event.target.value,
                })
              }
            />
          </label>

          <SearchableFilterSelect
            label="Köldmedium"
            options={refrigerantOptions}
            value={refrigerantValue}
            onChange={(value) => updateQueryParam("refrigerantType", value)}
          />

          <FilterSelect
            label="Servicekontakt"
            value={contractorFilterValue}
            onChange={(value) => updateQueryParam("contractorId", value)}
          >
            <option value="">Alla</option>
            <option value="unassigned">Ingen servicekontakt</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {formatContractorOption(contractor)}
                  </option>
                ))}
          </FilterSelect>

          <FilterSelect
            label="Servicepartnerföretag"
            value={servicePartnerCompanyFilterValue}
            onChange={(value) => updateQueryParam("servicePartnerCompanyId", value)}
          >
            <option value="">Alla</option>
            {servicePartnerCompanyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Fastighet"
            value={propertyFilterValue}
            onChange={(value) => updateQueryParam("propertyId", value)}
          >
            <option value="">Alla</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Kommun"
            value={municipalityFilterValue}
            onChange={(value) => updateQueryParam("municipality", value)}
          >
            <option value="">Alla</option>
            {municipalityOptions.map((municipality) => (
              <option key={municipality} value={municipality}>
                {municipality}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Status"
            value={statusFilterValue}
            onChange={updateStatusFilter}
          >
            <option value="">Alla</option>
            <option value="active">Aktiva</option>
            <option value="overdue">Försenad kontroll</option>
            <option value="missing">Saknar uppgifter</option>
            <option value="archived">Arkiverade</option>
            <option value="scrapped">Skrotade</option>
          </FilterSelect>

          <FilterSelect
            label="Risk"
            value={riskFilterValue}
            onChange={(value) => updateQueryParam("risk", value)}
          >
            <option value="">Alla</option>
            <option value="HIGH">Hög</option>
            <option value="MEDIUM">Medel</option>
            <option value="LOW">Låg</option>
            <option value="MISSING">Saknas</option>
          </FilterSelect>

          <FilterSelect
            label="Kontrollintervall"
            value={inspectionIntervalFilterValue}
            onChange={(value) => updateQueryParam("inspectionInterval", value)}
          >
            <option value="">Alla</option>
            <option value="3">Var 3:e månad</option>
            <option value="6">Var 6:e månad</option>
            <option value="12">Var 12:e månad</option>
            <option value="24">Var 24:e månad</option>
            <option value="none">Ej kontrollpliktigt</option>
          </FilterSelect>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] lg:items-end">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="grid gap-1 text-sm font-medium text-slate-700 lg:min-w-72">
              Mina sparade filter
              <select
                className={filterControlClassName}
                value={selectedSavedFilterId}
                onChange={(event) => applySavedFilter(event.target.value)}
              >
                <option value="">Välj sparat filter</option>
                {savedFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              {isSaveFilterOpen ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={handleSaveFilter}
                >
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    Filternamn
                    <input
                      className={filterControlClassName}
                      placeholder="Ex. Försenade R410A"
                      value={saveFilterName}
                      onChange={(event) =>
                        setSaveFilterName(event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                    type="submit"
                    disabled={isSavingFilter}
                  >
                    {isSavingFilter ? "Sparar..." : "Spara"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    type="button"
                    disabled={isSavingFilter}
                    onClick={() => {
                      setIsSaveFilterOpen(false)
                      setSaveFilterName("")
                      setSavedFilterError("")
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
                    setIsSaveFilterOpen(true)
                    setSavedFilterError("")
                    setSavedFilterSuccess("")
                  }}
                >
                  Spara filter
                </button>
              )}
            </div>
          </div>

          <div className="lg:justify-self-end lg:min-w-56">
            <FilterSelect label="Sortering" value={sortValue} onChange={updateSort}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {savedFilterError && (
          <p className="mt-3 text-sm font-semibold text-red-700">{savedFilterError}</p>
        )}
        {savedFilterSuccess && (
          <p className="mt-3 text-sm font-semibold text-green-700">{savedFilterSuccess}</p>
        )}

        {hasActiveFilters && (
          <button
            className="mt-4 text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
            type="button"
            onClick={clearFilters}
          >
            Rensa filter
          </button>
        )}
      </Card>

      {isLoading && <p className="mt-8 text-slate-700">Laddar...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}
      {feedback && (
        <div
          className={`fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-lg border bg-white p-4 text-sm shadow-xl transition-all duration-200 ease-out sm:bottom-6 sm:right-6 ${
            feedback.type === "success" ? "border-emerald-200" : "border-red-200"
          } ${isFeedbackExiting ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`font-semibold ${
                  feedback.type === "success" ? "text-emerald-900" : "text-red-900"
                }`}
              >
                {feedback.type === "success" ? "Klart" : "Kunde inte utföra åtgärden"}
              </p>
              <p className="mt-1 text-slate-700">{feedback.message}</p>
            </div>
            <button
              className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              type="button"
              onClick={dismissFeedback}
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {!isLoading && !canManage && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Du kan visa aggregatlistan. Endast administratörer kan använda bulkåtgärder.
        </p>
      )}

      {!isLoading && canManage && (
        <div
          className={`mt-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
            isBulkPanelFloating ? "lg:hidden" : ""
          }`}
        >
          <div>
            <p className="font-semibold text-slate-950">
              {selectedIds.length} aggregat valda
            </p>
            {!hasSelectedInstallations && (
              <p className="mt-1 text-sm text-slate-600">
                Markera aggregat för att använda åtgärderna.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={bulkSecondaryButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => setIsAssignModalOpen(true)}
            >
              {pendingBulkAction === "servicepartner" ? "Tilldelar..." : "Tilldela servicepartner"}
            </button>
            <button
              className={bulkSecondaryButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => setIsPropertyModalOpen(true)}
            >
              {pendingBulkAction === "property" ? "Kopplar..." : "Tilldela fastighet"}
            </button>
            <button
              className={bulkDestructiveButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => void handleArchiveSelected()}
            >
              {pendingBulkAction === "archive" ? "Arkiverar..." : "Arkivera aggregat"}
            </button>
          </div>
        </div>
      )}

      <div ref={bulkPanelSentinelRef} className="h-px" />

      {!isLoading && canManage && isBulkPanelFloating && (
        <div className="fixed right-4 top-28 z-30 hidden w-56 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur lg:block">
          <p className="text-sm font-semibold text-slate-950">
            {selectedIds.length} aggregat valda
          </p>
          {!hasSelectedInstallations && (
            <p className="mt-1 text-xs text-slate-600">
              Markera aggregat för att använda åtgärderna.
            </p>
          )}
          <div className="mt-3 grid gap-2">
            <button
              className={bulkSecondaryButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => setIsAssignModalOpen(true)}
            >
              {pendingBulkAction === "servicepartner" ? "Tilldelar..." : "Tilldela servicepartner"}
            </button>
            <button
              className={bulkSecondaryButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => setIsPropertyModalOpen(true)}
            >
              {pendingBulkAction === "property" ? "Kopplar..." : "Tilldela fastighet"}
            </button>
            <button
              className={bulkDestructiveButtonClassName}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={() => void handleArchiveSelected()}
            >
              {pendingBulkAction === "archive" ? "Arkiverar..." : "Arkivera aggregat"}
            </button>
          </div>
        </div>
      )}

      {!isLoading && installations.length > 0 && (
        <div className="mt-6 grid gap-3 lg:hidden">
          {installations.map((installation) => (
            <InstallationMobileCard
              canManage={canManage}
              installation={installation}
              isSelected={selectedIds.includes(installation.id)}
              key={installation.id}
              onOpenQuickView={() => setSelectedInstallation(installation)}
              onToggleSelected={() => toggleInstallation(installation.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && installations.length > 0 && (
        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-[13px]">
            <colgroup>
              {canManage && <col className="w-[3.5%]" />}
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
              <col className="w-[20.5%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                {canManage && (
                  <th className="px-1.5 py-2 text-left">
                    <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-transparent hover:border-slate-300 hover:bg-white">
                      <input
                        aria-label="Välj alla aggregat"
                        checked={allSelected}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600"
                        onChange={toggleAll}
                        type="checkbox"
                      />
                    </label>
                  </th>
                )}
                <TableHeader>Aggregat</TableHeader>
                <TableHeader>Placering</TableHeader>
                <TableHeader>Servicepartner</TableHeader>
                <TableHeader>Köldmedium</TableHeader>
                <TableHeader>Mängd</TableHeader>
                <TableHeader>CO₂e</TableHeader>
                <TableHeader>Nästa kontroll</TableHeader>
                <TableHeader>Intervall</TableHeader>
                <TableHeader>Status</TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {installations.map((installation) => (
                <tr
                  className="cursor-pointer hover:bg-slate-50"
                  key={installation.id}
                  onClick={() => setSelectedInstallation(installation)}
                >
                  {canManage && (
                    <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                      <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-transparent hover:border-slate-300 hover:bg-slate-50">
                        <input
                          aria-label={`Välj ${installation.name}`}
                          checked={selectedIds.includes(installation.id)}
                          className="h-5 w-5 rounded border-slate-300 text-blue-600"
                          onChange={() => toggleInstallation(installation.id)}
                          type="checkbox"
                        />
                      </label>
                    </td>
                  )}
                  <TableCell>
                    <button
                      className="text-left font-semibold text-slate-950 underline-offset-4 hover:underline"
                      type="button"
                      onClick={() => setSelectedInstallation(installation)}
                    >
                      {installation.name}
                    </button>
                    {(installation.equipmentId || installation.serialNumber) && (
                      <div className="mt-1 text-xs text-slate-500">
                        {[installation.equipmentId, installation.serialNumber].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{installation.location}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {formatPlacementMeta(installation)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {formatAssignedServicePartner(installation)}
                      </p>
                      {installation.assignedContractor && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {formatAssignedContractorName(installation.assignedContractor)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <span>{installation.refrigerantType}</span>
                      <RefrigerantRegulatoryBadge
                        amountKg={installation.refrigerantAmount}
                        refrigerantType={installation.refrigerantType}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                  <TableCell>{formatCo2eTon(installation.co2eTon)}</TableCell>
                  <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                  <TableCell>{formatInspectionIntervalShort(installation.inspectionInterval)}</TableCell>
                  <td className="px-2 py-2 align-top text-slate-800">
                    <StatusBadge
                      archivedAt={installation.archivedAt}
                      scrappedAt={installation.scrappedAt}
                      status={installation.complianceStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && installations.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">Inga aggregat matchar filtret</h2>
          <p className="mt-2 text-sm text-slate-700">
            Justera sökning, filter eller sortering för att hitta rätt aggregat.
          </p>
          {hasActiveFilters && (
            <button
              className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              type="button"
              onClick={clearFilters}
            >
              Visa alla aktiva aggregat
            </button>
          )}
        </div>
      )}

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl" onSubmit={handleAssignContractor}>
            <h2 className="text-lg font-semibold text-slate-950">Tilldela servicepartner</h2>
            <p className="mt-1 text-sm text-slate-700">
              Välj servicepartnerföretag för {selectedIds.length} valda aggregat.
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Servicepartnerföretag
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={bulkServicePartnerCompanyId}
                onChange={(event) => {
                  setBulkServicePartnerCompanyId(event.target.value)
                  setContractorId("")
                }}
              >
                <option value="">Ingen vald</option>
                {servicePartnerCompanyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Valfri kontaktperson
              </summary>
              <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
                Servicekontakt / tekniker
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  value={contractorId}
                  onChange={(event) => setContractorId(event.target.value)}
                >
                  <option value="">Ingen vald</option>
                  {bulkContactOptions.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {formatContractorOption(contractor)} ({contractor.email})
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs text-slate-600">
                Valfritt – används bara om en särskild kontaktperson är känd.
              </p>
            </details>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAssignModalOpen(false)}
              >
                Avbryt
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sparar..." : "Tilldela"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isPropertyModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <form className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl" onSubmit={handleAssignProperty}>
            <h2 className="text-lg font-semibold text-slate-950">Tilldela fastighet</h2>
            <p className="mt-1 text-sm text-slate-700">
              Välj fastighet för {selectedIds.length} valda aggregat, eller ta bort
              befintlig fastighetskoppling.
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Fastighet
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={bulkPropertyId}
                onChange={(event) => setBulkPropertyId(event.target.value)}
              >
                <option value="">Ingen fastighet</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                    {property.municipality ? `, ${property.municipality}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-600">
              Välj Ingen fastighet för att ta bort fastighetskopplingen.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setBulkPropertyId("")
                  setIsPropertyModalOpen(false)
                }}
              >
                Avbryt
              </button>
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sparar..." : "Uppdatera fastighet"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-2xl">
            <CreateInstallationForm
              headerAction={
                <button
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Stäng
                </button>
              }
              onInstallationCreated={() => {
                setIsCreateModalOpen(false)
                setRefreshKey((current) => current + 1)
              }}
            />
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Import
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  Importera aggregat
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Importera flera aggregat från ett befintligt Excel-register.
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
              >
                Stäng
              </button>
            </div>
            <ImportInstallationsPage
              embedded
              onClose={() => setIsImportModalOpen(false)}
              onImported={() => setRefreshKey((current) => current + 1)}
            />
          </div>
        </div>
      )}

      {selectedInstallation && (
        <InstallationQuickView
          events={selectedEvents}
          installation={selectedInstallation}
          isLoading={isQuickViewLoading}
          error={quickViewError}
          onClose={() => setSelectedInstallation(null)}
        />
      )}
    </main>
  )
}

function InstallationQuickView({
  error,
  events,
  installation,
  isLoading,
  onClose,
}: {
  error: string
  events: InstallationEvent[]
  installation: Installation
  isLoading: boolean
  onClose: () => void
}) {
  const latestInspection = getLatestEvent(events, "INSPECTION")
  const latestLeak = getLatestEvent(events, "LEAK")
  const latestService = getLatestEvent(events, "SERVICE")

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      <button
        aria-label="Stäng snabbvy"
        className="absolute inset-0 h-full w-full bg-slate-950/40"
        type="button"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl sm:border-l sm:border-slate-200">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Snabbvy
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {installation.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{installation.location}</p>
          </div>
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            Stäng
          </button>
        </div>

        <div className="grid gap-5 p-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Aggregat
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <QuickViewItem label="Köldmedium" value={installation.refrigerantType} />
              <QuickViewItem
                label="Fastighet"
                value={installation.property?.name || "-"}
              />
              <QuickViewItem
                label="Kommun"
                value={installation.property?.municipality || "-"}
              />
              <QuickViewItem
                label="Fyllnadsmängd"
                value={`${formatNumber(installation.refrigerantAmount)} kg`}
              />
              <QuickViewItem
                label="CO₂e"
                value={formatCo2eTon(installation.co2eTon)}
              />
              <QuickViewItem
                label="Riskpoäng"
                value={`${installation.riskScore} / ${RISK_LABELS[installation.riskLevel]}`}
              />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {!installation.scrappedAt && <RiskBadge level={installation.riskLevel} />}
              <StatusBadge
                archivedAt={installation.archivedAt}
                scrappedAt={installation.scrappedAt}
                status={installation.complianceStatus}
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Status
            </h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <QuickViewItem
                label="Nästa kontroll"
                value={formatOptionalDate(installation.nextInspection)}
              />
              <QuickViewItem
                label="Servicepartner"
                value={formatAssignedServicePartner(installation)}
              />
              <QuickViewItem
                label="Servicekontakt"
                value={formatAssignedContractorName(installation.assignedContractor)}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Senaste historik
            </h3>
            {isLoading && <p className="mt-4 text-sm text-slate-600">Hämtar historik...</p>}
            {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
            {!isLoading && !error && (
              <div className="mt-4 grid gap-3">
                <HistoryItem label="Senaste kontroll" event={latestInspection} />
                <HistoryItem label="Senaste läckage" event={latestLeak} />
                <HistoryItem label="Senaste service" event={latestService} />
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Åtgärd
            </h3>
            <Link
              className="mt-4 inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700"
              href={`/dashboard/installations/${installation.id}`}
            >
              Öppna hela aggregatsidan
            </Link>
          </section>
        </div>
      </aside>
    </div>
  )
}

function InstallationMobileCard({
  canManage,
  installation,
  isSelected,
  onOpenQuickView,
  onToggleSelected,
}: {
  canManage: boolean
  installation: Installation
  isSelected: boolean
  onOpenQuickView: () => void
  onToggleSelected: () => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            className="text-left text-base font-semibold text-slate-950 underline-offset-4 hover:underline"
            type="button"
            onClick={onOpenQuickView}
          >
            {installation.name}
          </button>
          <p className="mt-1 text-sm text-slate-600">
            {[installation.equipmentId, installation.location].filter(Boolean).join(" · ") || "-"}
          </p>
        </div>
        {canManage && (
          <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-slate-50 hover:bg-white">
            <input
              aria-label={`Välj ${installation.name}`}
              className="h-5 w-5 rounded border-slate-300 text-blue-600"
              checked={isSelected}
              type="checkbox"
              onChange={onToggleSelected}
            />
          </label>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          archivedAt={installation.archivedAt}
          scrappedAt={installation.scrappedAt}
          status={installation.complianceStatus}
        />
        {!installation.scrappedAt && <RiskBadge level={installation.riskLevel} />}
        <RefrigerantRegulatoryBadge
          amountKg={installation.refrigerantAmount}
          refrigerantType={installation.refrigerantType}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <QuickViewItem label="Fastighet" value={installation.property?.name || "-"} />
        <QuickViewItem
          label="Servicepartner"
          value={formatAssignedServicePartner(installation)}
        />
        <QuickViewItem
          label="Servicekontakt"
          value={formatAssignedContractorName(installation.assignedContractor)}
        />
        <QuickViewItem
          label="Nästa kontroll"
          value={formatOptionalDate(installation.nextInspection)}
        />
        <QuickViewItem label="CO₂e" value={formatCo2eTon(installation.co2eTon)} />
      </dl>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          type="button"
          onClick={onOpenQuickView}
        >
          Snabbvy
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          href={`/dashboard/installations/${installation.id}`}
        >
          Öppna aggregat
        </Link>
      </div>
    </article>
  )
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <select
        className={filterControlClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function SearchableFilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  const inputId = useId()
  const listboxId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [searchState, setSearchState] = useState({
    sourceValue: value,
    value,
  })
  const search = searchState.sourceValue === value ? searchState.value : value

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return options

    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch)
    )
  }, [options, search])

  function selectValue(nextValue: string) {
    onChange(nextValue)
    setSearchState({
      sourceValue: nextValue,
      value: nextValue,
    })
    setIsOpen(false)
  }

  return (
    <div
      className="relative grid gap-1 text-sm font-medium text-slate-700"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
          setSearchState({
            sourceValue: value,
            value,
          })
        }
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          autoComplete="off"
          className={`${filterControlClassName} pr-20`}
          id={inputId}
          placeholder="Alla"
          role="combobox"
          value={search}
          onChange={(event) => {
            setSearchState({
              sourceValue: value,
              value: event.target.value,
            })
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false)
              setSearchState({
                sourceValue: value,
                value,
              })
            }
            if (event.key === "Enter" && filteredOptions.length === 1) {
              event.preventDefault()
              selectValue(filteredOptions[0])
            }
          }}
        />
        {value ? (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            type="button"
            onClick={() => selectValue("")}
          >
            Alla
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          id={listboxId}
          role="listbox"
        >
          <button
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
              value ? "text-slate-700" : "bg-blue-50 font-semibold text-blue-800"
            }`}
            type="button"
            role="option"
            aria-selected={!value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectValue("")}
          >
            Alla
          </button>
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Inga träffar</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  value === option ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700"
                }`}
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectValue(option)}
              >
                {option}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-600">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-2 py-2 align-top text-slate-800">{children}</td>
}

function StatusBadge({
  archivedAt,
  scrappedAt,
  status,
}: {
  archivedAt?: string | null
  scrappedAt?: string | null
  status: ComplianceStatus
}) {
  if (scrappedAt) {
    return (
      <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
        Skrotad
      </span>
    )
  }

  if (archivedAt) {
    return (
      <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
        Arkiverad
      </span>
    )
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function formatInspectionIntervalShort(intervalMonths?: number | null) {
  return intervalMonths ? `${intervalMonths} mån` : "Ej krav"
}

function formatPlacementMeta(installation: Installation) {
  return [installation.property?.name, installation.property?.municipality]
    .filter(Boolean)
    .join(" · ") || "-"
}

function RiskBadge({ level }: { level: InstallationRiskLevel }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${RISK_TONE[level]}`}>
      Risk: {RISK_LABELS[level]}
    </span>
  )
}

function RefrigerantRegulatoryBadge({
  amountKg,
  refrigerantType,
}: {
  amountKg: number
  refrigerantType: string
}) {
  const status = getRefrigerantRegulatoryStatus({
    refrigerantType,
    refrigerantAmountKg: amountKg,
  })

  if (status.status === "OK") return null

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${REGULATORY_STATUS_TONE[status.status]}`}
      title={`${status.label}. ${status.description}`}
    >
      {status.shortLabel}
    </span>
  )
}

function QuickViewItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950">{value || "-"}</dd>
    </div>
  )
}

function HistoryItem({
  event,
  label,
}: {
  event?: InstallationEvent
  label: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600">
          {event ? formatOptionalDate(event.date) : "-"}
        </p>
      </div>
      {event?.notes && <p className="mt-2 text-sm text-slate-700">{event.notes}</p>}
      {event?.refrigerantAddedKg != null && (
        <p className="mt-2 text-sm text-slate-700">
          Mängd: {formatNumber(event.refrigerantAddedKg)} kg
        </p>
      )}
    </div>
  )
}

function getLatestEvent(events: InstallationEvent[], type: InstallationEventType) {
  return events.find((event) => event.type === type)
}

function deriveContractors(installations: Installation[]) {
  const contractors = new Map<string, Contractor>()

  for (const installation of installations) {
    if (installation.assignedContractor) {
      contractors.set(installation.assignedContractor.id, installation.assignedContractor)
    }
  }

  return Array.from(contractors.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function deriveServicePartnerCompanies(
  contractors: Contractor[],
  installations: Installation[] = [],
  registeredCompanies: ServicePartnerCompanySummary[] = []
) {
  const companies = new Map<string, ServicePartnerCompanySummary>()

  registeredCompanies.forEach((company) => {
    companies.set(company.id, company)
  })

  contractors.forEach((contractor) => {
    if (contractor.servicePartnerCompany) {
      companies.set(contractor.servicePartnerCompany.id, contractor.servicePartnerCompany)
    }
  })
  installations.forEach((installation) => {
    const company =
      installation.assignedServicePartnerCompany ??
      installation.assignedContractor?.servicePartnerCompany
    if (company) {
      companies.set(company.id, company)
    }
  })

  return Array.from(companies.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function formatContractorOption(contractor: Contractor) {
  return contractor.servicePartnerCompany?.name
    ? `${contractor.name} - ${contractor.servicePartnerCompany.name}`
    : contractor.name
}

function formatAssignedServicePartner(installation: Installation) {
  return (
    installation.assignedServicePartnerCompany?.name ??
    installation.assignedContractor?.servicePartnerCompany?.name ??
    "Saknar servicepartner"
  )
}

function formatAssignedContractorName(contractor?: Contractor | null) {
  return contractor?.name ?? "-"
}

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCo2eTon(value: number | null) {
  return value === null ? "Okänt GWP-värde" : `${formatNumber(value)} ton`
}
