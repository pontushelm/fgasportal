"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { ImportDataWorkspace } from "@/components/dashboard/import-data-workspace"
import CreateInstallationForm from "@/components/installations/create-installation-form"
import { Button, Card, PageHeader, Toast } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import {
  API_CACHE_KEYS,
  invalidateInstallationCaches,
  isUnauthorizedApiError,
  useApiQuery,
} from "@/lib/client/api-cache"
import {
  DATA_QUALITY_FILTER_LABELS,
  getInstallationQualityFilter,
  matchesInstallationQualityFilter,
} from "@/lib/dashboard/data-quality-filters"
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
  propertyName?: string | null
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

type FilterSourceInstallation = Pick<
  Installation,
  | "id"
  | "refrigerantType"
  | "property"
  | "assignedContractor"
  | "assignedServicePartnerCompany"
>

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
  servicePartnerCompanyId?: string | null
  isServicePartnerAdmin?: boolean
}

type Contractor = {
  id: string
  name: string
  email: string
  servicePartnerCompany?: ServicePartnerCompanySummary | null
}

type ServiceTechnician = {
  id: string
  name: string | null
  email: string
  isServicePartnerAdmin: boolean
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

type InstallationSortKey =
  | "name"
  | "location"
  | "servicePartner"
  | "refrigerantType"
  | "refrigerantAmount"
  | "co2e"
  | "nextInspection"
  | "inspectionInterval"
  | "status"

type SortDirection = "asc" | "desc"

type SearchableFilterOption = {
  value: string
  label: string
  description?: string
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

const SAVED_FILTER_PAGE = "installations"
const INITIAL_VISIBLE_INSTALLATION_COUNT = 50
const filterControlClassName =
  "h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
const bulkSecondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
const bulkDestructiveButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"

export default function InstallationsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchValue = searchParams.get("q") || ""
  const archivedValue = searchParams.get("archived") || ""
  const refrigerantValue = searchParams.get("refrigerantType") || ""
  const servicePartnerCompanyFilterValue = searchParams.get("servicePartnerCompanyId") || ""
  const propertyFilterValue = searchParams.get("propertyId") || ""
  const municipalityFilterValue = searchParams.get("municipality") || ""
  const statusValue = searchParams.get("status") || ""
  const riskFilterValue = searchParams.get("risk") || ""
  const inspectionIntervalFilterValue = searchParams.get("inspectionInterval") || ""
  const activeQualityFilter = getInstallationQualityFilter(searchParams.get("quality"))
  const statusFilterValue =
    statusValue ||
    (archivedValue === "archived" ? "archived" : archivedValue === "active" ? "active" : "")
  const initialSortFieldValue = normalizeInstallationSortKey(searchParams.get("sort"))
  const initialSortDirectionValue: SortDirection | "" =
    searchParams.get("direction") === "asc"
      ? "asc"
      : searchParams.get("direction") === "desc"
      ? "desc"
      : ""
  const [columnSort, setColumnSort] = useState<{
    key: InstallationSortKey | ""
    direction: SortDirection | ""
  }>(() => ({
    key: initialSortFieldValue && initialSortDirectionValue ? initialSortFieldValue : "",
    direction: initialSortFieldValue ? initialSortDirectionValue : "",
  }))
  const sortFieldValue = columnSort.key
  const sortDirectionValue = columnSort.direction
  const {
    data: currentUser = null,
    error: currentUserError,
    isLoading: isCurrentUserLoading,
  } = useApiQuery<CurrentUser>(API_CACHE_KEYS.authMe)
  const {
    data: installations = [],
    error: installationsError,
    isLoading: isInstallationsLoading,
    mutate: mutateInstallations,
  } = useApiQuery<Installation[]>(API_CACHE_KEYS.installations)
  const {
    data: filterSourceInstallations = [],
    error: filterSourceError,
    isLoading: isFilterSourceLoading,
  } = useApiQuery<FilterSourceInstallation[]>(
    API_CACHE_KEYS.installationsFilterSource
  )
  const {
    data: savedFilters = [],
    error: savedFiltersError,
    isLoading: isSavedFiltersLoading,
    mutate: mutateSavedFilters,
  } = useApiQuery<SavedFilter[]>(API_CACHE_KEYS.savedFilters(SAVED_FILTER_PAGE))
  const {
    data: properties = [],
    error: propertiesError,
    isLoading: isPropertiesLoading,
  } = useApiQuery<PropertyOption[]>(API_CACHE_KEYS.properties)
  const {
    data: servicePartnerCompanies = [],
    error: servicePartnerCompaniesError,
    isLoading: isServicePartnerCompaniesLoading,
  } = useApiQuery<ServicePartnerCompanySummary[]>(
    API_CACHE_KEYS.servicePartnerCompanies
  )
  const {
    data: companyContractors = [],
    error: companyContractorsError,
    isLoading: isCompanyContractorsLoading,
  } = useApiQuery<Contractor[]>(
    currentUser && isAdminRole(currentUser.role)
      ? API_CACHE_KEYS.companyContractors
      : null
  )
  const {
    data: technicians = [],
    error: techniciansError,
    isLoading: isTechniciansLoading,
  } = useApiQuery<ServiceTechnician[]>(
    currentUser?.role === "CONTRACTOR" && currentUser.isServicePartnerAdmin
      ? API_CACHE_KEYS.serviceTechnicians
      : null
  )
  const contractors = useMemo(
    () =>
      currentUser && isAdminRole(currentUser.role)
        ? companyContractors
        : deriveContractors(filterSourceInstallations),
    [companyContractors, currentUser, filterSourceInstallations]
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [visibleInstallationCount, setVisibleInstallationCount] = useState(
    INITIAL_VISIBLE_INSTALLATION_COUNT
  )
  const [bulkServicePartnerCompanyId, setBulkServicePartnerCompanyId] = useState("")
  const [contractorId, setContractorId] = useState("")
  const [bulkPropertyId, setBulkPropertyId] = useState("")
  const [bulkTechnicianId, setBulkTechnicianId] = useState("")
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "servicepartner" | "property" | "archive" | "technician" | null
  >(null)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [isBulkPanelFloating, setIsBulkPanelFloating] = useState(false)
  const bulkPanelSentinelRef = useRef<HTMLDivElement | null>(null)
  const [selectedInstallation, setSelectedInstallation] =
    useState<Installation | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<InstallationEvent[]>([])
  const [isQuickViewLoading, setIsQuickViewLoading] = useState(false)
  const [quickViewError, setQuickViewError] = useState("")
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState("")
  const [technicianFilterValue, setTechnicianFilterValue] = useState("")
  const [assigningTechnicianInstallationId, setAssigningTechnicianInstallationId] =
    useState("")
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState("")
  const [isSavingFilter, setIsSavingFilter] = useState(false)
  const [savedFilterError, setSavedFilterError] = useState("")
  const [searchInputState, setSearchInputState] = useState({
    sourceValue: searchValue,
    value: searchValue,
  })
  const searchInputValue =
    searchInputState.sourceValue === searchValue
      ? searchInputState.value
      : searchValue
  const canManage = isAdminRole(currentUser?.role)
  const isServicePartnerUser = currentUser?.role === "CONTRACTOR"
  const isServicePartnerAdmin = Boolean(
    currentUser?.role === "CONTRACTOR" && currentUser.isServicePartnerAdmin
  )
  const canSelectInstallations = canManage || isServicePartnerAdmin
  const loadError =
    currentUserError ??
    installationsError ??
    filterSourceError ??
    savedFiltersError ??
    propertiesError ??
    servicePartnerCompaniesError ??
    companyContractorsError ??
    techniciansError
  const isLoading =
    (!currentUser && isCurrentUserLoading) ||
    (installations.length === 0 && isInstallationsLoading) ||
    (filterSourceInstallations.length === 0 && isFilterSourceLoading) ||
    (savedFilters.length === 0 && isSavedFiltersLoading) ||
    (properties.length === 0 && isPropertiesLoading) ||
    (servicePartnerCompanies.length === 0 && isServicePartnerCompaniesLoading) ||
    (currentUser && isAdminRole(currentUser.role) && isCompanyContractorsLoading) ||
    (isServicePartnerAdmin && isTechniciansLoading)
  const loadErrorMessage =
    loadError && !isUnauthorizedApiError(loadError)
      ? loadError.message || "Kunde inte hämta aggregat"
      : ""

  useEffect(() => {
    if (isUnauthorizedApiError(loadError)) {
      router.push("/login")
    }
  }, [loadError, router])

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
    const sentinel = bulkPanelSentinelRef.current

    if (!canSelectInstallations || !sentinel) {
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
  }, [canSelectInstallations, installations.length, isLoading])

  function dismissFeedback() {
    setFeedback(null)
  }

  function showFeedback(nextFeedback: {
    type: "success" | "error"
    message: string
  }) {
    setFeedback(nextFeedback)
  }

  const hasSelectedInstallations = selectedIds.length > 0
  const filteredInstallations = useMemo(
    () =>
      filterInstallationsByQuery(
        installations.filter((installation) =>
          matchesInstallationQualityFilter(installation, activeQualityFilter)
        ),
        {
          inspectionIntervalFilterValue,
          municipalityFilterValue,
          propertyFilterValue,
          refrigerantValue,
          riskFilterValue,
          searchValue,
          servicePartnerCompanyFilterValue,
          statusFilterValue,
        }
      ),
    [
      activeQualityFilter,
      installations,
      inspectionIntervalFilterValue,
      municipalityFilterValue,
      propertyFilterValue,
      refrigerantValue,
      riskFilterValue,
      searchValue,
      servicePartnerCompanyFilterValue,
      statusFilterValue,
    ]
  )
  const displayedInstallations = useMemo(
    () =>
      sortInstallations(
        filterInstallationsByTechnician(filteredInstallations, technicianFilterValue),
        sortFieldValue,
        sortDirectionValue
      ),
    [filteredInstallations, sortDirectionValue, sortFieldValue, technicianFilterValue]
  )
  const visibleInstallations = useMemo(
    () => displayedInstallations.slice(0, visibleInstallationCount),
    [displayedInstallations, visibleInstallationCount]
  )
  const hasMoreInstallationsToShow =
    visibleInstallations.length < displayedInstallations.length
  const allSelected = useMemo(
    () =>
      visibleInstallations.length > 0 &&
      visibleInstallations.every((installation) =>
        selectedIds.includes(installation.id)
      ),
    [selectedIds, visibleInstallations]
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
      )
        .sort((first, second) => first.localeCompare(second, "sv"))
        .map((refrigerant) => ({
          value: refrigerant,
          label: refrigerant,
        })),
    [filterSourceInstallations]
  )
  const propertyOptions = useMemo(
    () =>
      properties.map((property) => ({
        value: property.id,
        label: property.name,
        description: [property.municipality, property.city]
          .filter(Boolean)
          .join(" · "),
      })),
    [properties]
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
  const servicePartnerFilterOptions = useMemo(
    () =>
      servicePartnerCompanyOptions.map((company) => ({
        value: company.id,
        label: company.name,
        description: company.organizationNumber ?? undefined,
      })),
    [servicePartnerCompanyOptions]
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
      servicePartnerCompanyFilterValue ||
      propertyFilterValue ||
      municipalityFilterValue ||
      statusValue ||
      activeQualityFilter ||
      riskFilterValue ||
      inspectionIntervalFilterValue
  )

  const updateQueryParam = useCallback((name: string, value: string) => {
    const params = getFilterParamsWithoutColumnSort(searchParams)
    setSelectedSavedFilterId("")
    setSelectedIds([])
    setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)

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

  function updateColumnSort(sortKey: InstallationSortKey) {
    setSelectedSavedFilterId("")

    setColumnSort((current) => {
      if (current.key !== sortKey || !current.direction) {
        return { key: sortKey, direction: "asc" }
      }

      if (current.direction === "asc") {
        return { key: sortKey, direction: "desc" }
      }

      return { key: "", direction: "" }
    })
  }

  function updateStatusFilter(value: string) {
    const params = getFilterParamsWithoutColumnSort(searchParams)
    setSelectedSavedFilterId("")
    setSelectedIds([])
    setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)

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
    setColumnSort({ key: "", direction: "" })
    setSelectedIds([])
    setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)
  }

  function clearQualityFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("quality")
    setSelectedIds([])
    setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)
    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function applySavedFilter(savedFilterId: string) {
    setSelectedSavedFilterId(savedFilterId)
    setSelectedIds([])
    setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)

    if (!savedFilterId) return

    const savedFilter = savedFilters.find((filter) => filter.id === savedFilterId)
    if (!savedFilter) return

    const savedSortKey = normalizeInstallationSortKey(savedFilter.queryParams.sort ?? null)
    const savedSortDirection =
      savedFilter.queryParams.direction === "asc" || savedFilter.queryParams.direction === "desc"
        ? savedFilter.queryParams.direction
        : ""
    const params = new URLSearchParams(savedFilter.queryParams)
    params.delete("sort")
    params.delete("direction")
    setColumnSort({
      key: savedSortKey,
      direction: savedSortKey ? savedSortDirection : "",
    })
    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }

  async function handleSaveFilter(event: React.FormEvent) {
    event.preventDefault()
    setSavedFilterError("")

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
        queryParams: buildSavedFilterQueryParams(
          searchParams,
          sortFieldValue,
          sortDirectionValue
        ),
      }),
    })
    const result: SavedFilter & { error?: string } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setSavedFilterError(result.error || "Kunde inte spara filtret")
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte spara filtret.",
      })
      setIsSavingFilter(false)
      return
    }

    await mutateSavedFilters((current = []) => [result, ...current], {
      revalidate: false,
    })
    void mutateSavedFilters()
    setSelectedSavedFilterId(result.id)
    setSaveFilterName("")
    setIsSaveFilterOpen(false)
    showFeedback({
      type: "success",
      message: "Filtret har sparats.",
    })
    setIsSavingFilter(false)
  }

  function toggleAll() {
    const visibleInstallationIds = visibleInstallations.map(
      (installation) => installation.id
    )

    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !visibleInstallationIds.includes(id))
        : Array.from(new Set([...selectedIds, ...visibleInstallationIds]))
    )
  }

  function toggleInstallation(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    )
  }

  function updateInstallationRows(
    installationIds: string[],
    updater: (installation: Installation) => Installation
  ) {
    const ids = new Set(installationIds)
    const updateList = (current: Installation[]) =>
      current.map((installation) =>
        ids.has(installation.id) ? updater(installation) : installation
      )

    void mutateInstallations((current = []) => updateList(current), {
      revalidate: false,
    })
    setSelectedInstallation((current) =>
      current && ids.has(current.id) ? updater(current) : current
    )
  }

  function archiveInstallationRows(installationIds: string[]) {
    const ids = new Set(installationIds)
    const archivedAt = new Date().toISOString()
    const updateArchived = (installation: Installation): Installation =>
      ids.has(installation.id)
        ? {
            ...installation,
            archivedAt,
            isActive: false,
          }
        : installation

    setSelectedInstallation((current) =>
      current && ids.has(current.id) ? updateArchived(current) : current
    )

    if (archivedValue === "all") {
      void mutateInstallations((current = []) => current.map(updateArchived), {
        revalidate: false,
      })
      return
    }

    void mutateInstallations(
      (current = []) => current.filter((installation) => !ids.has(installation.id)),
      { revalidate: false }
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

    const targetInstallationIds = selectedIds
    const selectedContractor =
      contractors.find((contractor) => contractor.id === contractorId) ?? null
    const selectedServicePartnerCompany =
      servicePartnerCompanyOptions.find(
        (company) => company.id === bulkServicePartnerCompanyId
      ) ??
      selectedContractor?.servicePartnerCompany ??
      null
    const selectedCompanyName =
      selectedServicePartnerCompany?.name ?? "vald servicepartner"

    setIsSubmitting(true)
    setPendingBulkAction("servicepartner")

    const res = await fetch("/api/installations/bulk/assign-contractor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: targetInstallationIds,
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
      message: `${result.updated ?? targetInstallationIds.length} aggregat tilldelades ${selectedCompanyName}.`,
    })
    updateInstallationRows(targetInstallationIds, (installation) => ({
      ...installation,
      assignedContractor: selectedContractor,
      assignedServicePartnerCompany: selectedServicePartnerCompany,
    }))
    setBulkServicePartnerCompanyId("")
    setContractorId("")
    setIsAssignModalOpen(false)
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    void invalidateInstallationCaches()
  }

  async function handleArchiveSelected() {
    setError("")
    setFeedback(null)

    const targetInstallationIds = selectedIds
    const confirmed = window.confirm(
      `Arkivera ${targetInstallationIds.length} valda aggregat?`
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
        installationIds: targetInstallationIds,
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
      message: `${result.archived ?? targetInstallationIds.length} aggregat arkiverades.`,
    })
    archiveInstallationRows(targetInstallationIds)
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    void invalidateInstallationCaches()
  }

  async function handleAssignProperty(event: React.FormEvent) {
    event.preventDefault()
    setError("")
    setFeedback(null)
    const targetInstallationIds = selectedIds
    const selectedProperty =
      properties.find((property) => property.id === bulkPropertyId) ?? null
    const selectedPropertyName = selectedProperty?.name ?? "vald fastighet"
    setIsSubmitting(true)
    setPendingBulkAction("property")

    const res = await fetch("/api/installations/bulk/assign-property", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: targetInstallationIds,
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
        ? `${result.updated ?? targetInstallationIds.length} aggregat kopplades till ${selectedPropertyName}.`
        : `${result.updated ?? targetInstallationIds.length} aggregat fick fastighetskopplingen borttagen.`,
    })
    updateInstallationRows(targetInstallationIds, (installation) => ({
      ...installation,
      propertyId: selectedProperty?.id ?? null,
      property: selectedProperty,
    }))
    setBulkPropertyId("")
    setIsPropertyModalOpen(false)
    setSelectedIds([])
    setIsSubmitting(false)
    setPendingBulkAction(null)
    void invalidateInstallationCaches()
  }

  async function assignTechnicianToInstallation(
    installationId: string,
    technicianId: string
  ) {
    setFeedback(null)
    setAssigningTechnicianInstallationId(installationId)

    const res = await fetch("/api/dashboard/service/assign-technician", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationId,
        technicianId: technicianId || null,
      }),
    })
    const result: {
      error?: string
      assignedContractor?: {
        id: string
        name: string | null
        email: string
      } | null
    } = await res.json()

    if (res.status === 401) {
      setAssigningTechnicianInstallationId("")
      router.push("/login")
      return
    }

    if (!res.ok) {
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte tilldela tekniker.",
      })
      setAssigningTechnicianInstallationId("")
      return
    }

    const assignedContractor = result.assignedContractor
      ? {
          id: result.assignedContractor.id,
          name: result.assignedContractor.name || result.assignedContractor.email,
          email: result.assignedContractor.email,
        }
      : null

    updateInstallationRows([installationId], (installation) => ({
      ...installation,
      assignedContractor,
    }))
    showFeedback({
      type: "success",
      message: assignedContractor
        ? `${installationNameById(installationId, installations)} tilldelades ${assignedContractor.name}.`
        : "Teknikertilldelningen togs bort.",
    })
    setAssigningTechnicianInstallationId("")
    void invalidateInstallationCaches(installationId)
  }

  async function handleBulkAssignTechnician() {
    setFeedback(null)

    if (!hasSelectedInstallations) return

    const targetInstallationIds = selectedIds
    setIsSubmitting(true)
    setPendingBulkAction("technician")

    const res = await fetch("/api/dashboard/service/assign-technician/bulk", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: targetInstallationIds,
        technicianId: bulkTechnicianId || null,
      }),
    })
    const result: {
      error?: string
      updated?: number
      assignedContractor?: {
        id: string
        name: string | null
        email: string
      } | null
    } = await res.json()

    if (res.status === 401) {
      setIsSubmitting(false)
      setPendingBulkAction(null)
      router.push("/login")
      return
    }

    if (!res.ok) {
      showFeedback({
        type: "error",
        message: result.error || "Kunde inte tilldela tekniker.",
      })
      setIsSubmitting(false)
      setPendingBulkAction(null)
      return
    }

    const assignedContractor = result.assignedContractor
      ? {
          id: result.assignedContractor.id,
          name: result.assignedContractor.name || result.assignedContractor.email,
          email: result.assignedContractor.email,
        }
      : null

    updateInstallationRows(targetInstallationIds, (installation) => ({
      ...installation,
      assignedContractor,
    }))
    setSelectedIds([])
    showFeedback({
      type: "success",
      message: assignedContractor
        ? `${result.updated ?? targetInstallationIds.length} aggregat tilldelades ${assignedContractor.name}.`
        : `${result.updated ?? targetInstallationIds.length} aggregat fick teknikertilldelningen borttagen.`,
    })
    setIsSubmitting(false)
    setPendingBulkAction(null)
    void invalidateInstallationCaches()
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          isLoading ? (
            <div className="flex flex-wrap gap-2">
              <SkeletonBlock className="h-10 w-28 rounded-lg" />
              <SkeletonBlock className="h-10 w-36 rounded-lg" />
              <SkeletonBlock className="h-10 w-36 rounded-lg" />
            </div>
          ) : (
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
            {!isServicePartnerUser && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsImportWorkspaceOpen(true)}
                >
                  Importera data
                </Button>
              </>
            )}
            </>
          )
        }
        title={isServicePartnerUser ? "Tilldelade aggregat" : "Aggregat"}
        subtitle={
          isServicePartnerUser
            ? "Översikt över tilldelade köldmedieaggregat."
            : "Översikt över organisationens köldmedieaggregat."
        }
      />
      {isLoading ? (
        <InstallationsLoadingSkeleton />
      ) : loadErrorMessage && installations.length === 0 ? (
        <p className="mt-8 font-semibold text-red-700">{loadErrorMessage}</p>
      ) : (
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

          {!isServicePartnerUser && (
            <SearchableFilterSelect
              label="Servicepartner"
              options={servicePartnerFilterOptions}
              value={servicePartnerCompanyFilterValue}
              onChange={(value) => updateQueryParam("servicePartnerCompanyId", value)}
            />
          )}

          <SearchableFilterSelect
            label="Fastighet"
            options={propertyOptions}
            value={propertyFilterValue}
            onChange={(value) => updateQueryParam("propertyId", value)}
          />

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

          {!isServicePartnerUser && (
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
          )}

          {isServicePartnerAdmin && (
            <FilterSelect
              label="Tekniker"
              value={technicianFilterValue}
              onChange={(value) => {
                setTechnicianFilterValue(value)
                setSelectedIds([])
                setVisibleInstallationCount(INITIAL_VISIBLE_INSTALLATION_COUNT)
              }}
            >
              <option value="">Alla</option>
              <option value="unassigned">Ej tilldelade</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {formatTechnicianName(technician)}
                </option>
              ))}
            </FilterSelect>
          )}

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

        <div className="mt-4 border-t border-slate-200 pt-4">
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
                  }}
                >
                  Spara filter
                </button>
              )}
            </div>
          </div>

        </div>

        {savedFilterError && (
          <p className="mt-3 text-sm font-semibold text-red-700">{savedFilterError}</p>
        )}
        {activeQualityFilter && (
          <QualityFilterBanner
            label={DATA_QUALITY_FILTER_LABELS[activeQualityFilter]}
            onClear={clearQualityFilter}
          />
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
      )}

      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}
      {feedback && (
        <Toast
          onClose={dismissFeedback}
          toast={{
            type: feedback.type,
            title: feedback.type === "success" ? "Klart" : "Kunde inte utföra åtgärden",
            message: feedback.message,
          }}
        />
      )}

      {!isLoading && canSelectInstallations && (
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
          <BulkActionControls
            bulkTechnicianId={bulkTechnicianId}
            canManage={canManage}
            hasSelectedInstallations={hasSelectedInstallations}
            isServicePartnerAdmin={isServicePartnerAdmin}
            isSubmitting={isSubmitting}
            pendingBulkAction={pendingBulkAction}
            technicians={technicians}
            onArchiveSelected={handleArchiveSelected}
            onBulkTechnicianChange={setBulkTechnicianId}
            onOpenAssignModal={() => setIsAssignModalOpen(true)}
            onOpenPropertyModal={() => setIsPropertyModalOpen(true)}
            onSubmitBulkTechnician={handleBulkAssignTechnician}
          />
        </div>
      )}

      <div ref={bulkPanelSentinelRef} className="h-px" />

      {!isLoading && canSelectInstallations && isBulkPanelFloating && (
        <FloatingBulkActionCard
          bulkTechnicianId={bulkTechnicianId}
          canManage={canManage}
          hasSelectedInstallations={hasSelectedInstallations}
          isServicePartnerAdmin={isServicePartnerAdmin}
          isSubmitting={isSubmitting}
          pendingBulkAction={pendingBulkAction}
          selectedCount={selectedIds.length}
          technicians={technicians}
          onArchiveSelected={handleArchiveSelected}
          onBulkTechnicianChange={setBulkTechnicianId}
          onClearSelection={() => setSelectedIds([])}
          onOpenAssignModal={() => setIsAssignModalOpen(true)}
          onOpenPropertyModal={() => setIsPropertyModalOpen(true)}
          onSubmitBulkTechnician={handleBulkAssignTechnician}
        />
      )}

      {!isLoading && displayedInstallations.length > 0 && (
        <div className="mt-6 grid gap-3 lg:hidden">
          {visibleInstallations.map((installation) => (
            <InstallationMobileCard
              canManage={canSelectInstallations}
              canAssignTechnician={isServicePartnerAdmin}
              assigningTechnicianInstallationId={assigningTechnicianInstallationId}
              installation={installation}
              isSelected={selectedIds.includes(installation.id)}
              key={installation.id}
              technicians={technicians}
              onAssignTechnician={assignTechnicianToInstallation}
              onOpenQuickView={() => setSelectedInstallation(installation)}
              onToggleSelected={() => toggleInstallation(installation.id)}
            />
          ))}
        </div>
      )}

      {!isLoading && displayedInstallations.length > 0 && (
        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-[13px]">
            <colgroup>
              {canSelectInstallations && <col className="w-[3.5%]" />}
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[6%]" />
              {isServicePartnerAdmin && <col className="w-[12%]" />}
              <col className="w-[20.5%]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr>
                {canSelectInstallations && (
                  <th className="px-1.5 py-2 text-left">
                    <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-transparent hover:border-slate-300 hover:bg-white">
                      <input
                        aria-label="Välj synliga aggregat"
                        checked={allSelected}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600"
                        onChange={toggleAll}
                        type="checkbox"
                      />
                    </label>
                  </th>
                )}
                <TableHeader
                  sortKey="name"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Aggregat
                </TableHeader>
                <TableHeader
                  sortKey="location"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Placering
                </TableHeader>
                <TableHeader
                  sortKey="servicePartner"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Servicepartner
                </TableHeader>
                <TableHeader
                  sortKey="refrigerantType"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Köldmedium
                </TableHeader>
                <TableHeader
                  sortKey="refrigerantAmount"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Mängd
                </TableHeader>
                <TableHeader
                  sortKey="co2e"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  CO₂e
                </TableHeader>
                <TableHeader
                  sortKey="nextInspection"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Nästa kontroll
                </TableHeader>
                <TableHeader
                  sortKey="inspectionInterval"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Intervall
                </TableHeader>
                {isServicePartnerAdmin && (
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-600">
                    Tekniker
                  </th>
                )}
                <TableHeader
                  sortKey="status"
                  activeSortKey={sortFieldValue}
                  direction={sortDirectionValue}
                  onSort={updateColumnSort}
                >
                  Status
                </TableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleInstallations.map((installation) => (
                <tr
                  className="cursor-pointer hover:bg-slate-50"
                  key={installation.id}
                  onClick={() => setSelectedInstallation(installation)}
                >
                  {canSelectInstallations && (
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
                  {isServicePartnerAdmin && (
                    <td
                      className="px-2 py-2 align-top text-slate-800"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <TechnicianAssignmentSelect
                        installationId={installation.id}
                        assignedContractorId={installation.assignedContractor?.id ?? ""}
                        disabled={
                          assigningTechnicianInstallationId === installation.id ||
                          Boolean(installation.archivedAt || installation.scrappedAt)
                        }
                        technicians={technicians}
                        onAssign={assignTechnicianToInstallation}
                      />
                    </td>
                  )}
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

      {!isLoading && hasMoreInstallationsToShow && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Visar {visibleInstallations.length} av {displayedInstallations.length} aggregat
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50"
              type="button"
              onClick={() =>
                setVisibleInstallationCount((current) =>
                  Math.min(
                    current + INITIAL_VISIBLE_INSTALLATION_COUNT,
                    displayedInstallations.length
                  )
                )
              }
            >
              Visa 50 till
            </button>
            <button
              className="rounded-md bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700"
              type="button"
              onClick={() =>
                setVisibleInstallationCount(displayedInstallations.length)
              }
            >
              Visa alla
            </button>
          </div>
        </div>
      )}

      {!isLoading && displayedInstallations.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            {hasActiveFilters ? "Inga aggregat matchar filtret" : "Inga aggregat i registret än"}
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            {hasActiveFilters
              ? "Justera sökning, filter eller sortering för att hitta rätt aggregat."
              : "Importera aggregatregistret eller skapa första aggregatet manuellt. Aggregat behövs för kontroller, åtgärder och årsrapport."}
          </p>
          {!hasActiveFilters && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="primary" onClick={() => setIsImportWorkspaceOpen(true)}>
                Importera data
              </Button>
              <Link
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                href="/dashboard/help"
              >
                Visa kom igång-guide
              </Link>
            </div>
          )}
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
                void invalidateInstallationCaches()
              }}
            />
          </div>
        </div>
      )}

      {isImportWorkspaceOpen && (
        <ImportDataWorkspace
          onClose={() => setIsImportWorkspaceOpen(false)}
          onEventsImported={() => void invalidateInstallationCaches()}
          onInstallationsImported={() => void invalidateInstallationCaches()}
          onPropertiesImported={() => void invalidateInstallationCaches()}
        />
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

function InstallationsLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <Card className="mt-6 p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-900">Laddar aggregat...</p>
          <p className="text-sm text-slate-600">
            Hämtar register och beräknar kontrollstatus.
          </p>
        </div>
        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="grid gap-2" key={index}>
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid gap-2 sm:w-72">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-10 w-full rounded-md" />
            </div>
            <SkeletonBlock className="h-10 w-28 rounded-md" />
          </div>
        </div>
      </Card>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="mt-2 h-3 w-56" />
      </div>

      <div className="mt-6 grid gap-3 lg:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={index}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <SkeletonBlock className="h-5 w-3/5" />
                <SkeletonBlock className="h-4 w-4/5" />
              </div>
              <SkeletonBlock className="h-11 w-11 rounded-md" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SkeletonBlock className="h-7 w-24 rounded-full" />
              <SkeletonBlock className="h-7 w-20 rounded-full" />
              <SkeletonBlock className="h-7 w-28 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div className="grid gap-2" key={itemIndex}>
                  <SkeletonBlock className="h-3 w-20" />
                  <SkeletonBlock className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white lg:block">
        <div className="grid grid-cols-[3.5%_15%_12%_12%_10%_6%_7%_9%_6%_1fr] gap-0 border-b border-slate-200 bg-slate-50 px-2 py-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonBlock className="h-3 w-4/5" key={index} />
          ))}
        </div>
        <div className="divide-y divide-slate-200">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              className="grid grid-cols-[3.5%_15%_12%_12%_10%_6%_7%_9%_6%_1fr] items-start gap-0 px-2 py-3"
              key={index}
            >
              <SkeletonBlock className="h-5 w-5 rounded" />
              <div className="grid gap-2 pr-3">
                <SkeletonBlock className="h-4 w-4/5" />
                <SkeletonBlock className="h-3 w-3/5" />
              </div>
              {Array.from({ length: 8 }).map((__, cellIndex) => (
                <SkeletonBlock className="h-4 w-4/5" key={cellIndex} />
              ))}
            </div>
          ))}
        </div>
      </div>
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

function QualityFilterBanner({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Visar poster från registerstatus: <strong>{label}</strong>
      </span>
      <button
        className="font-semibold text-blue-800 underline-offset-4 hover:underline"
        type="button"
        onClick={onClear}
      >
        Rensa registerstatusfilter
      </button>
    </div>
  )
}

function FloatingBulkActionCard({
  bulkTechnicianId,
  canManage,
  hasSelectedInstallations,
  isServicePartnerAdmin,
  isSubmitting,
  onArchiveSelected,
  onBulkTechnicianChange,
  onClearSelection,
  onOpenAssignModal,
  onOpenPropertyModal,
  onSubmitBulkTechnician,
  pendingBulkAction,
  selectedCount,
  technicians,
}: {
  bulkTechnicianId: string
  canManage: boolean
  hasSelectedInstallations: boolean
  isServicePartnerAdmin: boolean
  isSubmitting: boolean
  onArchiveSelected: () => void
  onBulkTechnicianChange: (technicianId: string) => void
  onClearSelection: () => void
  onOpenAssignModal: () => void
  onOpenPropertyModal: () => void
  onSubmitBulkTechnician: () => void
  pendingBulkAction: "servicepartner" | "property" | "archive" | "technician" | null
  selectedCount: number
  technicians: ServiceTechnician[]
}) {
  const neutralActionClassName =
    "inline-flex min-h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
  const archiveActionClassName =
    "inline-flex min-h-10 w-full items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <aside
      aria-label="Bulkåtgärder för valda aggregat"
      className="fixed right-4 top-28 z-30 hidden w-72 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur lg:block"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Valda aggregat</h2>
          <p className="mt-1 text-xs text-slate-600">
            {selectedCount} aggregat markerade
          </p>
        </div>
        {hasSelectedInstallations && (
          <button
            className="text-xs font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            type="button"
            onClick={onClearSelection}
          >
            Rensa urval
          </button>
        )}
      </div>

      {!hasSelectedInstallations && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Markera aggregat för att använda åtgärderna.
        </p>
      )}

      {isServicePartnerAdmin ? (
        <div className="mt-4 grid gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tilldela tekniker
            </p>
            <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">
              Tekniker
              <select
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:bg-slate-100"
                disabled={!hasSelectedInstallations || isSubmitting}
                value={bulkTechnicianId}
                onChange={(event) => onBulkTechnicianChange(event.target.value)}
              >
                <option value="">Ingen tekniker</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {formatTechnicianName(technician)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className={neutralActionClassName}
            type="button"
            disabled={!hasSelectedInstallations || isSubmitting}
            onClick={onSubmitBulkTechnician}
          >
            {pendingBulkAction === "technician" ? "Tilldelar..." : "Spara tilldelning"}
          </button>
        </div>
      ) : canManage ? (
        <div className="mt-4 grid gap-4">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tilldela
            </p>
            <div className="mt-2 grid gap-2">
              <button
                className={neutralActionClassName}
                type="button"
                disabled={!hasSelectedInstallations || isSubmitting}
                onClick={onOpenAssignModal}
              >
                {pendingBulkAction === "servicepartner"
                  ? "Tilldelar..."
                  : "Tilldela servicepartner"}
              </button>
              <button
                className={neutralActionClassName}
                type="button"
                disabled={!hasSelectedInstallations || isSubmitting}
                onClick={onOpenPropertyModal}
              >
                {pendingBulkAction === "property" ? "Kopplar..." : "Tilldela fastighet"}
              </button>
            </div>
          </section>
          <section className="border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Arkivering
            </p>
            <button
              className={`${archiveActionClassName} mt-2`}
              type="button"
              disabled={!hasSelectedInstallations || isSubmitting}
              onClick={onArchiveSelected}
            >
              {pendingBulkAction === "archive" ? "Arkiverar..." : "Arkivera aggregat"}
            </button>
          </section>
        </div>
      ) : null}
    </aside>
  )
}

function BulkActionControls({
  bulkTechnicianId,
  canManage,
  compact = false,
  hasSelectedInstallations,
  isServicePartnerAdmin,
  isSubmitting,
  onArchiveSelected,
  onBulkTechnicianChange,
  onOpenAssignModal,
  onOpenPropertyModal,
  onSubmitBulkTechnician,
  pendingBulkAction,
  technicians,
}: {
  bulkTechnicianId: string
  canManage: boolean
  compact?: boolean
  hasSelectedInstallations: boolean
  isServicePartnerAdmin: boolean
  isSubmitting: boolean
  onArchiveSelected: () => void
  onBulkTechnicianChange: (technicianId: string) => void
  onOpenAssignModal: () => void
  onOpenPropertyModal: () => void
  onSubmitBulkTechnician: () => void
  pendingBulkAction: "servicepartner" | "property" | "archive" | "technician" | null
  technicians: ServiceTechnician[]
}) {
  if (isServicePartnerAdmin) {
    return (
      <div className={compact ? "grid gap-2" : "flex flex-wrap items-end gap-2"}>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Tekniker
          <select
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:bg-slate-100"
            disabled={!hasSelectedInstallations || isSubmitting}
            value={bulkTechnicianId}
            onChange={(event) => onBulkTechnicianChange(event.target.value)}
          >
            <option value="">Ingen tekniker</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {formatTechnicianName(technician)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={bulkSecondaryButtonClassName}
          type="button"
          disabled={!hasSelectedInstallations || isSubmitting}
          onClick={onSubmitBulkTechnician}
        >
          {pendingBulkAction === "technician" ? "Tilldelar..." : "Tilldela tekniker"}
        </button>
      </div>
    )
  }

  if (!canManage) return null

  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap gap-2"}>
      <button
        className={bulkSecondaryButtonClassName}
        type="button"
        disabled={!hasSelectedInstallations || isSubmitting}
        onClick={onOpenAssignModal}
      >
        {pendingBulkAction === "servicepartner" ? "Tilldelar..." : "Tilldela servicepartner"}
      </button>
      <button
        className={bulkSecondaryButtonClassName}
        type="button"
        disabled={!hasSelectedInstallations || isSubmitting}
        onClick={onOpenPropertyModal}
      >
        {pendingBulkAction === "property" ? "Kopplar..." : "Tilldela fastighet"}
      </button>
      <button
        className={bulkDestructiveButtonClassName}
        type="button"
        disabled={!hasSelectedInstallations || isSubmitting}
        onClick={onArchiveSelected}
      >
        {pendingBulkAction === "archive" ? "Arkiverar..." : "Arkivera aggregat"}
      </button>
    </div>
  )
}

function InstallationMobileCard({
  assigningTechnicianInstallationId,
  canAssignTechnician,
  canManage,
  installation,
  isSelected,
  technicians,
  onAssignTechnician,
  onOpenQuickView,
  onToggleSelected,
}: {
  assigningTechnicianInstallationId: string
  canAssignTechnician: boolean
  canManage: boolean
  installation: Installation
  isSelected: boolean
  technicians: ServiceTechnician[]
  onAssignTechnician: (installationId: string, technicianId: string) => void
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

      {canAssignTechnician && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Tekniker
            <TechnicianAssignmentSelect
              installationId={installation.id}
              assignedContractorId={installation.assignedContractor?.id ?? ""}
              disabled={
                assigningTechnicianInstallationId === installation.id ||
                Boolean(installation.archivedAt || installation.scrappedAt)
              }
              technicians={technicians}
              onAssign={onAssignTechnician}
            />
          </label>
        </div>
      )}

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

function TechnicianAssignmentSelect({
  assignedContractorId,
  disabled,
  installationId,
  onAssign,
  technicians,
}: {
  assignedContractorId: string
  disabled: boolean
  installationId: string
  onAssign: (installationId: string, technicianId: string) => void
  technicians: ServiceTechnician[]
}) {
  return (
    <select
      className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
      disabled={disabled}
      value={assignedContractorId}
      onChange={(event) => onAssign(installationId, event.target.value)}
    >
      <option value="">Ingen tekniker</option>
      {technicians.map((technician) => (
        <option key={technician.id} value={technician.id}>
          {formatTechnicianName(technician)}
        </option>
      ))}
    </select>
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
  options: SearchableFilterOption[]
  value: string
}) {
  const inputId = useId()
  const listboxId = useId()
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  )
  const [isOpen, setIsOpen] = useState(false)
  const [searchState, setSearchState] = useState({
    sourceValue: value,
    value: selectedOption?.label ?? value,
  })
  const search =
    searchState.sourceValue === value
      ? searchState.value
      : selectedOption?.label ?? value

  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return options

    return options.filter((option) =>
      [option.label, option.description]
        .filter((text): text is string => Boolean(text))
        .some((text) => text.toLowerCase().includes(normalizedSearch))
    )
  }, [options, search])

  function selectOption(option: SearchableFilterOption | null) {
    const nextValue = option?.value ?? ""
    onChange(nextValue)
    setSearchState({
      sourceValue: nextValue,
      value: option?.label ?? "",
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
            value: selectedOption?.label ?? value,
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
                value: selectedOption?.label ?? value,
              })
            }
            if (event.key === "Enter" && filteredOptions.length === 1) {
              event.preventDefault()
              selectOption(filteredOptions[0])
            }
          }}
        />
        {value ? (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            type="button"
            onClick={() => selectOption(null)}
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
            onClick={() => selectOption(null)}
          >
            Alla
          </button>
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Inga träffar</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  value === option.value ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700"
                }`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                <span>{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {option.description}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function TableHeader({
  activeSortKey,
  children,
  direction,
  onSort,
  sortKey,
}: {
  activeSortKey: InstallationSortKey | ""
  children: React.ReactNode
  direction: SortDirection | ""
  onSort: (sortKey: InstallationSortKey) => void
  sortKey: InstallationSortKey
}) {
  const isActive = activeSortKey === sortKey

  return (
    <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-slate-600">
      <button
        className="inline-flex items-center gap-1 rounded-sm text-left hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-100"
        type="button"
        onClick={() => onSort(sortKey)}
      >
        <span>{children}</span>
        {isActive && direction && (
          <span aria-hidden="true" className="text-slate-900">
            {direction === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
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

function deriveContractors(installations: FilterSourceInstallation[]) {
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
  installations: FilterSourceInstallation[] = [],
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

function formatTechnicianName(technician: ServiceTechnician) {
  return technician.name || technician.email
}

function installationNameById(installationId: string, installations: Installation[]) {
  return (
    installations.find((installation) => installation.id === installationId)
      ?.name ?? "Aggregatet"
  )
}

function filterInstallationsByQuery(
  installations: Installation[],
  filters: {
    inspectionIntervalFilterValue: string
    municipalityFilterValue: string
    propertyFilterValue: string
    refrigerantValue: string
    riskFilterValue: string
    searchValue: string
    servicePartnerCompanyFilterValue: string
    statusFilterValue: string
  }
) {
  const normalizedSearch = filters.searchValue.trim().toLowerCase()

  return installations.filter((installation) => {
    if (
      normalizedSearch &&
      ![
        installation.name,
        installation.location,
        installation.equipmentId,
        installation.serialNumber,
        installation.propertyName,
        installation.property?.name,
        installation.property?.municipality,
        installation.property?.city,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    ) {
      return false
    }

    if (
      filters.refrigerantValue &&
      installation.refrigerantType !== filters.refrigerantValue
    ) {
      return false
    }

    if (
      filters.propertyFilterValue &&
      installation.propertyId !== filters.propertyFilterValue
    ) {
      return false
    }

    if (
      filters.municipalityFilterValue &&
      installation.property?.municipality !== filters.municipalityFilterValue
    ) {
      return false
    }

    if (
      filters.servicePartnerCompanyFilterValue &&
      getInstallationServicePartnerCompanyId(installation) !==
        filters.servicePartnerCompanyFilterValue
    ) {
      return false
    }

    if (
      filters.statusFilterValue &&
      !matchesClientStatusFilter(installation, filters.statusFilterValue)
    ) {
      return false
    }

    if (
      filters.riskFilterValue &&
      !matchesRiskFilter(
        installation.riskLevel,
        installation.riskScore,
        filters.riskFilterValue
      )
    ) {
      return false
    }

    if (
      filters.inspectionIntervalFilterValue &&
      !matchesInspectionIntervalFilter(
        installation.inspectionInterval ?? null,
        filters.inspectionIntervalFilterValue
      )
    ) {
      return false
    }

    return true
  })
}

function getInstallationServicePartnerCompanyId(installation: Installation) {
  return (
    installation.assignedServicePartnerCompany?.id ??
    installation.assignedContractor?.servicePartnerCompany?.id ??
    null
  )
}

function matchesClientStatusFilter(installation: Installation, filter: string) {
  if (filter === "all") return true
  if (filter === "active") return !installation.archivedAt && !installation.scrappedAt
  if (filter === "archived") return Boolean(installation.archivedAt)
  if (filter === "scrapped") return Boolean(installation.scrappedAt)
  if (filter === "inactive") {
    return !installation.isActive || Boolean(installation.archivedAt)
  }

  return matchesStatusFilter(
    installation.complianceStatus,
    installation.inspectionInterval ?? null,
    installation.scrappedAt,
    filter
  )
}

function matchesStatusFilter(
  status: ComplianceStatus,
  inspectionInterval: number | null,
  scrappedAt: string | null | undefined,
  filter: string
) {
  if (filter === "scrapped") return Boolean(scrappedAt)
  if (filter === "overdue") return status === "OVERDUE"
  if (filter === "dueSoon") return status === "DUE_SOON"
  if (filter === "ok") return status === "OK"
  if (filter === "missing") return status === "NOT_INSPECTED"
  if (filter === "required") return inspectionInterval !== null
  if (filter === "notRequired") return inspectionInterval === null
  if (filter === "archived" || filter === "inactive") return true
  return true
}

function matchesRiskFilter(
  riskLevel: InstallationRiskLevel | null | undefined,
  riskScore: number | null | undefined,
  filter: string
) {
  if (filter === "MISSING") return !riskLevel && !riskScore
  return riskLevel === filter
}

function matchesInspectionIntervalFilter(
  inspectionInterval: number | null,
  filter: string
) {
  if (filter === "none") return inspectionInterval === null

  const parsedFilter = Number(filter)
  return Number.isFinite(parsedFilter) && inspectionInterval === parsedFilter
}

function filterInstallationsByTechnician(
  installations: Installation[],
  technicianFilterValue: string
) {
  if (!technicianFilterValue) return installations

  if (technicianFilterValue === "unassigned") {
    return installations.filter((installation) => !installation.assignedContractor)
  }

  return installations.filter(
    (installation) => installation.assignedContractor?.id === technicianFilterValue
  )
}

function normalizeInstallationSortKey(value: string | null): InstallationSortKey | "" {
  if (value === "nextInspectionDate") return "nextInspection"
  if (value === "co2e") return "co2e"

  const allowedSortKeys: InstallationSortKey[] = [
    "name",
    "location",
    "servicePartner",
    "refrigerantType",
    "refrigerantAmount",
    "co2e",
    "nextInspection",
    "inspectionInterval",
    "status",
  ]

  return allowedSortKeys.includes(value as InstallationSortKey)
    ? (value as InstallationSortKey)
    : ""
}

function getFilterParamsWithoutColumnSort(searchParams: { toString: () => string }) {
  const params = new URLSearchParams(searchParams.toString())
  params.delete("sort")
  params.delete("direction")
  return params
}

function buildSavedFilterQueryParams(
  searchParams: { entries: () => IterableIterator<[string, string]> },
  sortKey: InstallationSortKey | "",
  direction: SortDirection | ""
) {
  const queryParams = Object.fromEntries(searchParams.entries())

  if (sortKey && direction) {
    queryParams.sort = sortKey
    queryParams.direction = direction
  } else {
    delete queryParams.sort
    delete queryParams.direction
  }

  return queryParams
}

function sortInstallations(
  installations: Installation[],
  sortKey: InstallationSortKey | "",
  direction: SortDirection | ""
) {
  if (!sortKey || !direction) return installations

  const multiplier = direction === "asc" ? 1 : -1

  return [...installations].sort((first, second) => {
    const firstValue = getInstallationSortValue(first, sortKey)
    const secondValue = getInstallationSortValue(second, sortKey)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier
    }

    return String(firstValue).localeCompare(String(secondValue), "sv", {
      numeric: true,
      sensitivity: "base",
    }) * multiplier
  })
}

function getInstallationSortValue(
  installation: Installation,
  sortKey: InstallationSortKey
) {
  switch (sortKey) {
    case "name":
      return installation.name
    case "location":
      return `${installation.location} ${formatPlacementMeta(installation)}`
    case "servicePartner":
      return formatAssignedServicePartner(installation)
    case "refrigerantType":
      return installation.refrigerantType
    case "refrigerantAmount":
      return installation.refrigerantAmount
    case "co2e":
      return installation.co2eTon ?? Number.NEGATIVE_INFINITY
    case "nextInspection":
      return installation.nextInspection
        ? new Date(installation.nextInspection).getTime()
        : Number.POSITIVE_INFINITY
    case "inspectionInterval":
      return installation.inspectionInterval ?? Number.POSITIVE_INFINITY
    case "status":
      return getInstallationStatusLabel(installation)
  }
}

function getInstallationStatusLabel(installation: Installation) {
  if (installation.scrappedAt) return "Skrotad"
  if (installation.archivedAt) return "Arkiverad"
  return STATUS_LABELS[installation.complianceStatus]
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
