"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import CreateInstallationForm from "@/components/installations/create-installation-form"
import { Button, buttonClassName, Card, PageHeader } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import type { ComplianceStatus } from "@/lib/fgas-calculations"
import { REFRIGERANT_GWP } from "@/lib/refrigerants"
import type { InstallationRiskLevel } from "@/lib/risk-classification"

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
  co2eTon: number
  riskLevel: InstallationRiskLevel
  riskScore: number
  complianceStatus: ComplianceStatus
  nextInspection?: string | null
  updatedAt: string
  archivedAt?: string | null
  assignedContractor?: Contractor | null
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
}

type PropertyOption = {
  id: string
  name: string
  municipality?: string | null
  city?: string | null
}

type InstallationEventType = "INSPECTION" | "LEAK" | "REFILL" | "SERVICE"

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

const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "Senast uppdaterad" },
  { value: "updatedAt:asc", label: "Äldst uppdaterad" },
  { value: "nextInspectionDate:asc", label: "Nästa kontroll, tidigast först" },
  { value: "nextInspectionDate:desc", label: "Nästa kontroll, senast först" },
  { value: "co2e:desc", label: "CO₂e, högst först" },
  { value: "co2e:asc", label: "CO₂e, lägst först" },
]
const SAVED_FILTER_PAGE = "installations"

export default function InstallationsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const [installations, setInstallations] = useState<Installation[]>([])
  const [filterSourceInstallations, setFilterSourceInstallations] = useState<Installation[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [contractorId, setContractorId] = useState("")
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
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

  const searchValue = searchParams.get("q") || ""
  const archivedValue = searchParams.get("archived") || "active"
  const refrigerantValue = searchParams.get("refrigerantType") || ""
  const contractorFilterValue = searchParams.get("contractorId") || ""
  const propertyFilterValue = searchParams.get("propertyId") || ""
  const municipalityFilterValue = searchParams.get("municipality") || ""
  const statusValue = searchParams.get("status") || ""
  const sortValue = `${searchParams.get("sort") || "updatedAt"}:${searchParams.get("direction") || "desc"}`

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      setIsLoading(true)
      setError("")

      const installationsUrl = `/api/installations${queryString ? `?${queryString}` : ""}`
      const [installationsRes, userRes, filterSourceRes, savedFiltersRes, propertiesRes] = await Promise.all([
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
      const contractorsData: Contractor[] =
        userData.role === "ADMIN"
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : deriveContractors(filterSourceData)

      if (!isMounted) return

      setInstallations(installationsData)
      setFilterSourceInstallations(filterSourceData)
      setCurrentUser(userData)
      setContractors(contractorsData)
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

  const canManage = currentUser?.role === "ADMIN"
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
  const hasActiveFilters = Boolean(
    searchValue ||
      archivedValue !== "active" ||
      refrigerantValue ||
      contractorFilterValue ||
      propertyFilterValue ||
      municipalityFilterValue ||
      statusValue
  )

  function updateQueryParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedFilterId("")
    setSavedFilterSuccess("")

    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }

    router.replace(`/dashboard/installations${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function updateSort(value: string) {
    const [sort, direction] = value.split(":")
    const params = new URLSearchParams(searchParams.toString())
    setSelectedSavedFilterId("")
    setSavedFilterSuccess("")

    params.set("sort", sort)
    params.set("direction", direction)
    router.replace(`/dashboard/installations?${params.toString()}`)
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
    setSuccess("")

    if (!contractorId) {
      setError("Välj servicepartner")
      return
    }

    setIsSubmitting(true)

    const res = await fetch("/api/installations/bulk/assign-contractor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        installationIds: selectedIds,
        contractorId,
      }),
    })
    const result: { error?: string; updated?: number } = await res.json()

    if (res.status === 401) {
      router.push("/login")
      return
    }

    if (!res.ok) {
      setError(result.error || "Kunde inte tilldela servicepartner")
      setIsSubmitting(false)
      return
    }

    setSuccess(`${result.updated ?? selectedIds.length} aggregat uppdaterade`)
    setContractorId("")
    setIsAssignModalOpen(false)
    setIsSubmitting(false)
    setRefreshKey((current) => current + 1)
  }

  async function handleArchiveSelected() {
    setError("")
    setSuccess("")

    const confirmed = window.confirm(
      `Markera ${selectedIds.length} aggregat som inaktiva?`
    )

    if (!confirmed) return

    setIsSubmitting(true)

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
      router.push("/login")
      return
    }

    if (!res.ok) {
      setError(result.error || "Kunde inte markera aggregat som inaktiva")
      setIsSubmitting(false)
      return
    }

    setSuccess(`${result.archived ?? selectedIds.length} aggregat markerade som inaktiva`)
    setIsSubmitting(false)
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
            <Link
              className={buttonClassName({ variant: "secondary" })}
              href="/dashboard/installations/import"
            >
              Import Excel
            </Link>
          </>
        }
        backHref="/dashboard"
        backLabel="Tillbaka till dashboard"
        eyebrow="Aggregat"
        title="Registrerade aggregat"
        subtitle="SÃ¶k, filtrera och sortera aggregatlistan. AdministratÃ¶rer kan Ã¤ven gÃ¶ra bulkÃ¥tgÃ¤rder."
      />

      {false && (
      <div className="hidden">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Aggregat
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Registrerade aggregat
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Sök, filtrera och sortera aggregatlistan. Administratörer kan även göra bulkåtgärder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Skapa aggregat
            </button>
          )}
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/installations/import">
            Import Excel
          </Link>
        </div>
      </div>
      )}

      <Card className="mt-6 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.4fr)_repeat(7,minmax(150px,1fr))]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Sök
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="Namn, plats eller ID"
              type="search"
              value={searchValue}
              onChange={(event) => updateQueryParam("q", event.target.value)}
            />
          </label>

          <FilterSelect
            label="Status"
            value={archivedValue}
            onChange={(value) => updateQueryParam("archived", value === "active" ? "" : value)}
          >
            <option value="active">Aktiva</option>
            <option value="archived">Inaktiva</option>
            <option value="all">Alla</option>
          </FilterSelect>

          <FilterSelect
            label="Köldmedium"
            value={refrigerantValue}
            onChange={(value) => updateQueryParam("refrigerantType", value)}
          >
            <option value="">Alla</option>
            {refrigerantOptions.map((refrigerant) => (
              <option key={refrigerant} value={refrigerant}>
                {refrigerant}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Servicepartner"
            value={contractorFilterValue}
            onChange={(value) => updateQueryParam("contractorId", value)}
          >
            <option value="">Alla</option>
            <option value="unassigned">Ingen servicepartner</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
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
            label="Kontrollstatus"
            value={statusValue}
            onChange={(value) => updateQueryParam("status", value)}
          >
            <option value="">Alla</option>
            <option value="overdue">Försenad</option>
            <option value="dueSoon">Inom 30 dagar</option>
            <option value="ok">OK</option>
          </FilterSelect>

          <FilterSelect label="Sortering" value={sortValue} onChange={updateSort}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="grid gap-1 text-sm font-medium text-slate-700 lg:min-w-72">
            Mina sparade filter
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
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
              <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSaveFilter}>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Filternamn
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                    placeholder="Ex. Försenade R410A"
                    value={saveFilterName}
                    onChange={(event) => setSaveFilterName(event.target.value)}
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
      {success && <p className="mt-8 font-semibold text-green-700">{success}</p>}

      {!isLoading && !canManage && (
        <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Du kan visa aggregatlistan. Endast administratörer kan använda bulkåtgärder.
        </p>
      )}

      {!isLoading && canManage && selectedIds.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold text-slate-950">
            {selectedIds.length} aggregat valda
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAssignModalOpen(true)}
            >
              Tilldela servicepartner
            </button>
            <button
              className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400"
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleArchiveSelected()}
            >
              Markera som inaktivt
            </button>
          </div>
        </div>
      )}

      {!isLoading && installations.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {canManage && (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      aria-label="Välj alla aggregat"
                      checked={allSelected}
                      onChange={toggleAll}
                      type="checkbox"
                    />
                  </th>
                )}
                <TableHeader>Aggregat</TableHeader>
                <TableHeader>Plats</TableHeader>
                <TableHeader>Fastighet</TableHeader>
                <TableHeader>Kommun</TableHeader>
                <TableHeader>Köldmedium</TableHeader>
                <TableHeader>Mängd</TableHeader>
                <TableHeader>CO₂e</TableHeader>
                <TableHeader>Servicepartner</TableHeader>
                <TableHeader>Nästa kontroll</TableHeader>
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
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        aria-label={`Välj ${installation.name}`}
                        checked={selectedIds.includes(installation.id)}
                        onChange={() => toggleInstallation(installation.id)}
                        type="checkbox"
                      />
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
                  <TableCell>{installation.location}</TableCell>
                  <TableCell>{installation.property?.name || "-"}</TableCell>
                  <TableCell>{installation.property?.municipality || "-"}</TableCell>
                  <TableCell>{installation.refrigerantType}</TableCell>
                  <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                  <TableCell>{formatNumber(installation.co2eTon)} ton</TableCell>
                  <TableCell>{installation.assignedContractor?.name || "-"}</TableCell>
                  <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                  <TableCell>
                    <StatusBadge status={installation.complianceStatus} />
                  </TableCell>
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
              Välj servicepartner för {selectedIds.length} valda aggregat.
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Servicepartner
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={contractorId}
                onChange={(event) => setContractorId(event.target.value)}
                required
              >
                <option value="">Välj servicepartner</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name} ({contractor.email})
                  </option>
                ))}
              </select>
            </label>
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Skapa aggregat</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Lägg till ett nytt aggregat i registret.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Stäng
              </button>
            </div>
            <CreateInstallationForm
              onInstallationCreated={() => {
                setIsCreateModalOpen(false)
                setRefreshKey((current) => current + 1)
              }}
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
              Installation
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
                value={`${formatNumber(installation.co2eTon)} ton`}
              />
              <QuickViewItem
                label="Riskpoäng"
                value={`${installation.riskScore} / ${RISK_LABELS[installation.riskLevel]}`}
              />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <RiskBadge level={installation.riskLevel} />
              <StatusBadge status={installation.complianceStatus} />
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
                value={installation.assignedContractor?.name || "-"}
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
              Snabbåtgärder
            </h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <QuickAction href={`/dashboard/installations/${installation.id}#event-form`}>
                Lägg till kontroll
              </QuickAction>
              <QuickAction href={`/dashboard/installations/${installation.id}#event-form`}>
                Registrera läckage
              </QuickAction>
              <QuickAction href={`/dashboard/installations/${installation.id}#event-form`}>
                Lägg till service
              </QuickAction>
              <QuickAction href={`/dashboard/installations/${installation.id}#documents`}>
                Ladda upp dokument
              </QuickAction>
              <Link
                className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700 sm:col-span-2"
                href={`/dashboard/installations/${installation.id}`}
              >
                Öppna hela aggregatsidan
              </Link>
            </div>
          </section>
        </div>
      </aside>
    </div>
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
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
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

function StatusBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function RiskBadge({ level }: { level: InstallationRiskLevel }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${RISK_TONE[level]}`}>
      Risk: {RISK_LABELS[level]}
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

function QuickAction({
  children,
  href,
}: {
  children: React.ReactNode
  href: string
}) {
  return (
    <Link
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
      href={href}
    >
      {children}
    </Link>
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

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
