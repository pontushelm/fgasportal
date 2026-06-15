"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ImportDataWorkspace } from "@/components/dashboard/import-data-workspace"
import { Badge, Button, Card, EmptyState, PageHeader, Toast, type ToastMessage } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import {
  API_CACHE_KEYS,
  invalidatePropertyCaches,
  isUnauthorizedApiError,
  useApiQuery,
} from "@/lib/client/api-cache"
import {
  DATA_QUALITY_FILTER_LABELS,
  getPropertyQualityFilter,
  matchesPropertyQualityFilter,
} from "@/lib/dashboard/data-quality-filters"
import {
  EMPTY_PROPERTY_LIST_FILTERS,
  buildPropertyFilterOptions,
  hasActivePropertyListFilters,
  matchesPropertyListFilters,
  type PropertyListFilterKey,
  type PropertyListFilters,
} from "@/lib/dashboard/property-list-filters"
import { isAdminRole } from "@/lib/roles"

type PropertySummary = {
  address: string | null
  city: string | null
  id: string
  name: string
  postalCode: string | null
  propertyDesignation: string | null
  municipality: string | null
  installationsCount: number
  totalCo2eTon: number
  dueSoonInspections: number
  overdueInspections: number
  notInspected: number
  highRiskInstallations: number
  leakageClimateImpact: {
    leakageEventsCount: number
    leakageAmountKg: number
    leakageCo2eTon: number
    unknownLeakageCo2eCount: number
    isLeakageCo2eIncomplete: boolean
  }
}

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type PropertyFormData = {
  name: string
  propertyDesignation: string
  address: string
  postalCode: string
  city: string
  municipality: string
}

type SortDirection = "asc" | "desc"
type PropertySortKey =
  | "name"
  | "designation"
  | "municipality"
  | "city"
  | "installations"
  | "co2e"
  | "status"

const initialPropertyFormData: PropertyFormData = {
  name: "",
  propertyDesignation: "",
  address: "",
  postalCode: "",
  city: "",
  municipality: "",
}

const fieldClassName = "grid gap-1 text-sm font-medium text-slate-700"
const inputClassName =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"

export default function PropertiesPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeQualityFilter = getPropertyQualityFilter(searchParams.get("quality"))
  const {
    data: properties = [],
    error: propertiesError,
    isLoading: isPropertiesLoading,
    mutate: mutateProperties,
  } = useApiQuery<PropertySummary[]>(API_CACHE_KEYS.propertiesOverview)
  const {
    data: currentUser = null,
    error: userError,
    isLoading: isUserLoading,
  } = useApiQuery<CurrentUser>(API_CACHE_KEYS.authMe)
  const [propertyForm, setPropertyForm] = useState<PropertyFormData>(
    initialPropertyFormData
  )
  const [isCreating, setIsCreating] = useState(false)
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false)
  const [createError, setCreateError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [propertyFilters, setPropertyFilters] = useState<PropertyListFilters>(
    EMPTY_PROPERTY_LIST_FILTERS
  )
  const [sort, setSort] = useState<{
    key: PropertySortKey | ""
    direction: SortDirection | ""
  }>({ key: "", direction: "" })
  const isLoading = isPropertiesLoading || isUserLoading
  const error = propertiesError ?? userError
  const hasBlockingError = Boolean(error && properties.length === 0)
  const visibleProperties = useMemo(
    () =>
      sortProperties(
        properties.filter(
          (property) =>
            matchesPropertyQualityFilter(property, activeQualityFilter) &&
            matchesPropertyListFilters(property, propertyFilters)
        ),
        sort.key,
        sort.direction
      ),
    [activeQualityFilter, properties, propertyFilters, sort.direction, sort.key]
  )
  const propertyFilterOptions = useMemo(
    () => buildPropertyFilterOptions(properties),
    [properties]
  )
  const hasPropertyFilters = hasActivePropertyListFilters(propertyFilters)

  useEffect(() => {
    if (isUnauthorizedApiError(error)) {
      router.push("/login")
    }
  }, [error, router])

  const canCreateProperties = isAdminRole(currentUser?.role)

  function updateSort(sortKey: PropertySortKey) {
    setSort((current) => {
      if (current.key !== sortKey || !current.direction) {
        return { key: sortKey, direction: "asc" }
      }
      if (current.direction === "asc") {
        return { key: sortKey, direction: "desc" }
      }
      return { key: "", direction: "" }
    })
  }

  function clearQualityFilter() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("quality")
    router.replace(`/dashboard/properties${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function updatePropertyFilter(key: PropertyListFilterKey, value: string) {
    setPropertyFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function clearPropertyFilters() {
    setPropertyFilters(EMPTY_PROPERTY_LIST_FILTERS)
  }

  function handlePropertyChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPropertyForm({
      ...propertyForm,
      [event.target.name]: event.target.value,
    })
  }

  async function handlePropertySubmit(event: React.FormEvent) {
    event.preventDefault()
    setCreateError("")
    setIsCreating(true)

    const response = await fetch("/api/properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(propertyForm),
    })
    const result: { error?: string } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setCreateError(result.error || "Kunde inte skapa fastigheten")
      setToast({
        type: "error",
        title: "Fel",
        message: result.error || "Kunde inte skapa fastigheten.",
      })
      setIsCreating(false)
      return
    }

    await mutateProperties()
    await invalidatePropertyCaches()
    setPropertyForm(initialPropertyFormData)
    setToast({
      type: "success",
      title: "Klart",
      message: "Fastigheten har lagts till.",
    })
    setIsCreating(false)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          canCreateProperties ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsImportWorkspaceOpen(true)}
            >
              Importera fastigheter
            </Button>
          ) : null
        }
        title="Fastighetsöversikt"
        subtitle="Följ kontrollstatus, risk och klimatpåverkan per fastighet."
      />

      {isLoading && properties.length === 0 && <PropertiesLoadingSkeleton />}
      {hasBlockingError && error && !isUnauthorizedApiError(error) && (
        <p className="mt-8 font-semibold text-red-700">
          {error.message || "Kunde inte hämta fastigheter"}
        </p>
      )}

      {(!isLoading || properties.length > 0) && !hasBlockingError && canCreateProperties && (
        <Card className="mt-6 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Lägg till fastighet
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Skapa en fastighet som aggregat kan kopplas till i registret.
            </p>
          </div>

          <form className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={handlePropertySubmit}>
            <label className={fieldClassName}>
              Fastighetsnamn
              <input
                className={inputClassName}
                name="name"
                value={propertyForm.name}
                onChange={handlePropertyChange}
                required
              />
            </label>
            <label className={fieldClassName}>
              Fastighetsbeteckning
              <input
                className={inputClassName}
                name="propertyDesignation"
                value={propertyForm.propertyDesignation}
                onChange={handlePropertyChange}
              />
            </label>
            <label className={fieldClassName}>
              Adress
              <input
                className={inputClassName}
                name="address"
                value={propertyForm.address}
                onChange={handlePropertyChange}
              />
            </label>
            <label className={fieldClassName}>
              Postnummer
              <input
                className={inputClassName}
                name="postalCode"
                value={propertyForm.postalCode}
                onChange={handlePropertyChange}
              />
            </label>
            <label className={fieldClassName}>
              Ort
              <input
                className={inputClassName}
                name="city"
                value={propertyForm.city}
                onChange={handlePropertyChange}
              />
            </label>
            <label className={fieldClassName}>
              Kommun
              <input
                className={inputClassName}
                name="municipality"
                value={propertyForm.municipality}
                onChange={handlePropertyChange}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2 lg:col-span-3">
              <Button disabled={isCreating} type="submit" variant="primary">
                {isCreating ? "Sparar..." : "Lägg till fastighet"}
              </Button>
              {createError && <p className="text-sm font-semibold text-red-700">{createError}</p>}
            </div>
          </form>
        </Card>
      )}

      {!isLoading && !hasBlockingError && properties.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Inga fastigheter att visa"
          description="Lägg till en fastighet här eller koppla aggregat till en fastighet."
        />
      )}

      {(!isLoading || properties.length > 0) && !hasBlockingError && properties.length > 0 && (
        <>
        {activeQualityFilter && (
          <QualityFilterBanner
            label={DATA_QUALITY_FILTER_LABELS[activeQualityFilter]}
            onClear={clearQualityFilter}
          />
        )}
        <PropertyFilterBar
          filters={propertyFilters}
          hasActiveFilters={hasPropertyFilters}
          onClear={clearPropertyFilters}
          onChange={updatePropertyFilter}
          options={propertyFilterOptions}
        />
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader
                    activeSortKey={sort.key}
                    direction={sort.direction}
                    onSort={updateSort}
                    sortKey="name"
                  >
                    Fastighet
                  </TableHeader>
                  <TableHeader
                    activeSortKey={sort.key}
                    direction={sort.direction}
                    onSort={updateSort}
                    sortKey="municipality"
                  >
                    Kommun
                  </TableHeader>
                  <TableHeader
                    activeSortKey={sort.key}
                    direction={sort.direction}
                    onSort={updateSort}
                    sortKey="installations"
                  >
                    Antal aggregat
                  </TableHeader>
                  <TableHeader>Försenade kontroller</TableHeader>
                  <TableHeader
                    activeSortKey={sort.key}
                    direction={sort.direction}
                    onSort={updateSort}
                    sortKey="co2e"
                  >
                    Total CO₂e
                  </TableHeader>
                  <TableHeader
                    activeSortKey={sort.key}
                    direction={sort.direction}
                    onSort={updateSort}
                    sortKey="status"
                  >
                    Risk
                  </TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleProperties.map((property) => (
                  <tr className="hover:bg-slate-50" key={property.id}>
                    <TableCell>
                      <Link
                        className="font-semibold text-slate-950 underline-offset-4 hover:underline"
                        href={`/dashboard/properties/${property.id}`}
                      >
                        {property.name}
                      </Link>
                      {property.city && (
                        <p className="mt-1 text-xs text-slate-500">{property.city}</p>
                      )}
                      {property.address && (
                        <p className="mt-1 text-xs text-slate-500">{property.address}</p>
                      )}
                    </TableCell>
                    <TableCell>{property.municipality || "-"}</TableCell>
                    <TableCell>{property.installationsCount}</TableCell>
                    <TableCell>
                      <ControlStatusSummary property={property} />
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-950">
                        {formatNumber(property.totalCo2eTon)} ton installerad CO₂e
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(property.leakageClimateImpact.leakageCo2eTon)} ton från läckage i år
                        {property.leakageClimateImpact.isLeakageCo2eIncomplete ? " (ofullständigt)" : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <RiskCount
                        count={property.highRiskInstallations}
                        total={property.installationsCount}
                      />
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {visibleProperties.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-700">
            Inga fastigheter matchar valda registerstatus- eller fältfilter.
          </div>
        )}
        </>
      )}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
      {isImportWorkspaceOpen && (
        <ImportDataWorkspace
          initialImportType="properties"
          onClose={() => setIsImportWorkspaceOpen(false)}
          onEventsImported={() => void invalidatePropertyCaches()}
          onInstallationsImported={() => void invalidatePropertyCaches()}
          onPropertiesImported={() => void invalidatePropertyCaches()}
        />
      )}
    </main>
  )
}

function PropertyFilterBar({
  filters,
  hasActiveFilters,
  onChange,
  onClear,
  options,
}: {
  filters: PropertyListFilters
  hasActiveFilters: boolean
  onChange: (key: PropertyListFilterKey, value: string) => void
  onClear: () => void
  options: Record<PropertyListFilterKey, string[]>
}) {
  const filterConfigs = [
    ["name", "Fastighetsnamn"],
    ["propertyDesignation", "Fastighetsbeteckning"],
    ["address", "Adress"],
    ["municipality", "Kommun"],
    ["city", "Ort"],
  ] satisfies Array<[PropertyListFilterKey, string]>

  return (
    <Card className="mt-6 border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Filtrera fastigheter
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Sök eller välj bland befintliga värden i registret.
          </p>
        </div>
        {hasActiveFilters ? (
          <button
            className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={onClear}
          >
            Rensa filter
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {filterConfigs.map(([key, label]) => (
          <PropertySearchableFilter
            key={key}
            label={label}
            name={key}
            onChange={(value) => onChange(key, value)}
            options={options[key]}
            value={filters[key]}
          />
        ))}
      </div>
    </Card>
  )
}

function PropertySearchableFilter({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string
  name: PropertyListFilterKey
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  const listId = `property-filter-${name}`

  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <div className="relative">
        <input
          className={`${inputClassName} w-full pr-9`}
          list={listId}
          placeholder="Sök eller välj"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            aria-label={`Rensa ${label.toLowerCase()}`}
            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            type="button"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  )
}

function ControlStatusSummary({ property }: { property: PropertySummary }) {
  if (
    property.overdueInspections === 0 &&
    property.dueSoonInspections === 0 &&
    property.notInspected === 0
  ) {
    return <Badge variant="success">Inga akuta kontrollärenden</Badge>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {property.overdueInspections > 0 && (
        <Badge variant="danger">{property.overdueInspections} försenade</Badge>
      )}
      {property.dueSoonInspections > 0 && (
        <Badge variant="warning">{property.dueSoonInspections} inom 30 dagar</Badge>
      )}
      {property.notInspected > 0 && (
        <Badge variant="info">{property.notInspected} ej kontrollerade</Badge>
      )}
    </div>
  )
}

function RiskCount({ count, total }: { count: number; total: number }) {
  if (count === 0) return <Badge variant="success">Ingen hög risk</Badge>
  return <Badge variant="warning">{count} av {total} hög risk</Badge>
}

function PropertiesLoadingSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-live="polite" aria-busy="true">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-50"
              key={index}
            />
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Laddar fastigheter...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hämtar fastigheter och beräknar kontrollstatus.
          </p>
        </div>
        <div className="hidden divide-y divide-slate-200 md:block">
          {Array.from({ length: 7 }).map((_, rowIndex) => (
            <div className="grid grid-cols-6 gap-4 px-4 py-4" key={rowIndex}>
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <div
                  className="h-4 animate-pulse rounded bg-slate-100"
                  key={cellIndex}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="grid gap-3 p-4 md:hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="rounded-lg border border-slate-200 bg-white p-4"
              key={index}
            >
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="h-8 animate-pulse rounded bg-slate-100" />
                <div className="h-8 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
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
    <div className="mt-6 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
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

function TableHeader({
  activeSortKey,
  children,
  direction,
  onSort,
  sortKey,
}: {
  activeSortKey?: PropertySortKey | ""
  children: React.ReactNode
  direction?: SortDirection | ""
  onSort?: (sortKey: PropertySortKey) => void
  sortKey?: PropertySortKey
}) {
  const isActive = Boolean(sortKey && activeSortKey === sortKey)

  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
      {sortKey && onSort ? (
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
      ) : (
        children
      )}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-slate-800">{children}</td>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}

function sortProperties(
  properties: PropertySummary[],
  sortKey: PropertySortKey | "",
  direction: SortDirection | ""
) {
  if (!sortKey || !direction) return properties

  const multiplier = direction === "asc" ? 1 : -1

  return [...properties].sort((first, second) => {
    const firstValue = getPropertySortValue(first, sortKey)
    const secondValue = getPropertySortValue(second, sortKey)

    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * multiplier
    }

    return (
      String(firstValue).localeCompare(String(secondValue), "sv", {
        numeric: true,
        sensitivity: "base",
      }) * multiplier
    )
  })
}

function getPropertySortValue(property: PropertySummary, sortKey: PropertySortKey) {
  switch (sortKey) {
    case "name":
      return property.name
    case "designation":
      return property.propertyDesignation || ""
    case "municipality":
      return property.municipality || ""
    case "city":
      return property.city || ""
    case "installations":
      return property.installationsCount
    case "co2e":
      return property.totalCo2eTon
    case "status":
      return property.highRiskInstallations * 1000 + property.overdueInspections
  }
}
