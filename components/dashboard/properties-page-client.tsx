"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ImportDataWorkspace } from "@/components/dashboard/import-data-workspace"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SearchableSelect,
  Toast,
  type SearchableSelectOption,
  type ToastMessage,
} from "@/components/ui"
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

type BulkDialog = "delete" | "clear-fields" | "set-municipality" | null
type ClearablePropertyField =
  | "address"
  | "postalCode"
  | "city"
  | "municipality"
  | "propertyDesignation"

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
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null)
  const [bulkError, setBulkError] = useState("")
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false)
  const [clearFields, setClearFields] = useState<ClearablePropertyField[]>([])
  const [bulkMunicipality, setBulkMunicipality] = useState("")
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
  const visiblePropertyIds = useMemo(
    () => visibleProperties.map((property) => property.id),
    [visibleProperties]
  )
  const visibleSelectedCount = selectedPropertyIds.filter((propertyId) =>
    visiblePropertyIds.includes(propertyId)
  ).length
  const allVisibleSelected =
    visibleProperties.length > 0 && visibleSelectedCount === visibleProperties.length

  useEffect(() => {
    if (isUnauthorizedApiError(error)) {
      router.push("/login")
    }
  }, [error, router])

  const canCreateProperties = isAdminRole(currentUser?.role)
  const canBulkEditProperties = isAdminRole(currentUser?.role)
  const canBulkDeleteProperties = currentUser?.role === "OWNER"

  function updateSort(sortKey: PropertySortKey) {
    setSelectedPropertyIds([])
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
    setSelectedPropertyIds([])
    const params = new URLSearchParams(searchParams.toString())
    params.delete("quality")
    router.replace(`/dashboard/properties${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function updatePropertyFilter(key: PropertyListFilterKey, value: string) {
    setSelectedPropertyIds([])
    setPropertyFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function clearPropertyFilters() {
    setSelectedPropertyIds([])
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

  function togglePropertySelection(propertyId: string) {
    setSelectedPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((selectedId) => selectedId !== propertyId)
        : [...current, propertyId]
    )
  }

  function toggleSelectVisibleProperties() {
    setSelectedPropertyIds((current) => {
      const visibleSet = new Set(visiblePropertyIds)
      if (allVisibleSelected) {
        return current.filter((propertyId) => !visibleSet.has(propertyId))
      }

      return Array.from(new Set([...current, ...visiblePropertyIds]))
    })
  }

  function openBulkDialog(dialog: BulkDialog) {
    setBulkError("")
    setBulkDialog(dialog)
    if (dialog === "clear-fields") setClearFields([])
    if (dialog === "set-municipality") setBulkMunicipality("")
  }

  function closeBulkDialog() {
    if (isBulkSubmitting) return
    setBulkDialog(null)
    setBulkError("")
  }

  function toggleClearField(field: ClearablePropertyField) {
    setClearFields((current) =>
      current.includes(field)
        ? current.filter((selectedField) => selectedField !== field)
        : [...current, field]
    )
  }

  async function runBulkAction(payload: Record<string, unknown>) {
    setBulkError("")
    setIsBulkSubmitting(true)

    const response = await fetch("/api/properties/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        propertyIds: selectedPropertyIds,
        ...payload,
      }),
    })
    const result = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return null
    }

    if (!response.ok) {
      setBulkError(result.error || "Bulkåtgärden kunde inte genomföras.")
      setIsBulkSubmitting(false)
      return null
    }

    await mutateProperties()
    await invalidatePropertyCaches()
    setIsBulkSubmitting(false)
    setBulkDialog(null)
    return result
  }

  async function handleBulkDelete() {
    const result: {
      blocked?: Array<{ id: string; installationCount: number; name: string }>
      blockedCount: number
      deletedCount: number
    } | null = await runBulkAction({ action: "DELETE" })

    if (!result) return

    setSelectedPropertyIds(result.blocked?.map((property) => property.id) ?? [])
    setToast({
      type: result.blockedCount > 0 ? "warning" : "success",
      title: "Klart",
      message: buildBulkDeleteMessage(result),
    })
  }

  async function handleBulkClearFields() {
    if (clearFields.length === 0) {
      setBulkError("Välj minst ett fält att rensa.")
      return
    }

    const result: { updatedCount: number } | null = await runBulkAction({
      action: "CLEAR_FIELDS",
      fields: clearFields,
    })

    if (!result) return

    setSelectedPropertyIds([])
    setToast({
      type: "success",
      title: "Klart",
      message: `${formatClearFieldLabels(clearFields)} rensades för ${result.updatedCount} fastigheter.`,
    })
  }

  async function handleBulkSetMunicipality() {
    const municipality = bulkMunicipality.trim()
    if (!municipality) {
      setBulkError("Ange en kommun.")
      return
    }

    const result: { updatedCount: number; municipality: string } | null =
      await runBulkAction({
        action: "SET_MUNICIPALITY",
        municipality,
      })

    if (!result) return

    setSelectedPropertyIds([])
    setToast({
      type: "success",
      title: "Klart",
      message: `Kommun uppdaterades till ${result.municipality} för ${result.updatedCount} fastigheter.`,
    })
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
          title="Inga fastigheter i registret än"
          description="Börja med att importera fastigheter eller lägg till den första manuellt. Fastigheter behövs för årsrapport och registerstatus."
          action={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="primary" onClick={() => setIsImportWorkspaceOpen(true)}>
                Importera fastigheter
              </Button>
              <Link
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                href="/dashboard/data-quality"
              >
                Öppna registerstatus
              </Link>
            </div>
          }
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
        {canBulkEditProperties && selectedPropertyIds.length > 0 && (
          <PropertyBulkActionBar
            canDelete={canBulkDeleteProperties}
            onClearSelection={() => setSelectedPropertyIds([])}
            onOpenDialog={openBulkDialog}
            selectedCount={selectedPropertyIds.length}
          />
        )}
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {canBulkEditProperties && (
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        aria-label="Välj alla synliga fastigheter"
                        checked={allVisibleSelected}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={toggleSelectVisibleProperties}
                        type="checkbox"
                      />
                    </th>
                  )}
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
                    {canBulkEditProperties && (
                      <TableCell>
                        <input
                          aria-label={`Välj ${property.name}`}
                          checked={selectedPropertyIds.includes(property.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          onChange={() => togglePropertySelection(property.id)}
                          type="checkbox"
                        />
                      </TableCell>
                    )}
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
      {bulkDialog === "delete" && (
        <BulkDialogFrame
          error={bulkError}
          onClose={closeBulkDialog}
          title="Ta bort valda fastigheter?"
        >
          <p className="text-sm text-slate-600">
            Fastigheter utan kopplade aggregat tas bort. Fastigheter med kopplade
            aggregat lämnas kvar.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {selectedPropertyIds.length} fastigheter valda.
          </p>
          <BulkDialogActions
            confirmLabel={isBulkSubmitting ? "Tar bort..." : "Ta bort fastigheter"}
            confirmVariant="danger"
            disabled={isBulkSubmitting}
            onCancel={closeBulkDialog}
            onConfirm={handleBulkDelete}
          />
        </BulkDialogFrame>
      )}
      {bulkDialog === "clear-fields" && (
        <BulkDialogFrame
          error={bulkError}
          onClose={closeBulkDialog}
          title="Rensa fält"
        >
          <p className="text-sm text-slate-600">
            Välj vilka uppgifter som ska rensas för {selectedPropertyIds.length} valda fastigheter.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {clearableFieldOptions.map((field) => (
              <label
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                key={field.value}
              >
                <input
                  checked={clearFields.includes(field.value)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  onChange={() => toggleClearField(field.value)}
                  type="checkbox"
                />
                {field.label}
              </label>
            ))}
          </div>
          <BulkDialogActions
            confirmLabel={isBulkSubmitting ? "Rensar..." : "Rensa valda fält"}
            disabled={isBulkSubmitting}
            onCancel={closeBulkDialog}
            onConfirm={handleBulkClearFields}
          />
        </BulkDialogFrame>
      )}
      {bulkDialog === "set-municipality" && (
        <BulkDialogFrame
          error={bulkError}
          onClose={closeBulkDialog}
          title="Sätt kommun"
        >
          <p className="text-sm text-slate-600">
            Sätt kommun för {selectedPropertyIds.length} valda fastigheter.
          </p>
          <label className={`${fieldClassName} mt-4`}>
            Kommun
            <input
              className={inputClassName}
              onChange={(event) => setBulkMunicipality(event.target.value)}
              value={bulkMunicipality}
            />
          </label>
          <BulkDialogActions
            confirmLabel={isBulkSubmitting ? "Uppdaterar..." : "Uppdatera kommun"}
            disabled={isBulkSubmitting}
            onCancel={closeBulkDialog}
            onConfirm={handleBulkSetMunicipality}
          />
        </BulkDialogFrame>
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
          <SearchableSelect
            key={key}
            clearLabel={`Rensa ${label.toLowerCase()}`}
            emptyLabel="Inga träffar"
            label={label}
            name={key}
            onChange={(value) => onChange(key, value)}
            options={options[key].map(toSearchableSelectOption)}
            value={filters[key]}
          />
        ))}
      </div>
    </Card>
  )
}

const clearableFieldOptions = [
  { label: "Adress", value: "address" },
  { label: "Postnummer", value: "postalCode" },
  { label: "Ort", value: "city" },
  { label: "Kommun", value: "municipality" },
  { label: "Fastighetsbeteckning", value: "propertyDesignation" },
] satisfies Array<{ label: string; value: ClearablePropertyField }>

function PropertyBulkActionBar({
  canDelete,
  onClearSelection,
  onOpenDialog,
  selectedCount,
}: {
  canDelete: boolean
  onClearSelection: () => void
  onOpenDialog: (dialog: BulkDialog) => void
  selectedCount: number
}) {
  return (
    <Card className="mt-4 border-blue-100 bg-blue-50/70 p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-blue-950">
          {selectedCount} fastigheter valda
        </p>
        <div className="flex flex-wrap gap-2">
          {canDelete && (
            <Button
              type="button"
              variant="danger"
              onClick={() => onOpenDialog("delete")}
            >
              Ta bort
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenDialog("clear-fields")}
          >
            Rensa fält
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenDialog("set-municipality")}
          >
            Sätt kommun
          </Button>
          <Button type="button" variant="ghost" onClick={onClearSelection}>
            Avmarkera alla
          </Button>
        </div>
      </div>
    </Card>
  )
}

function BulkDialogFrame({
  children,
  error,
  onClose,
  title,
}: {
  children: React.ReactNode
  error: string
  onClose: () => void
  title: string
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button
            aria-label="Stäng"
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            Stäng
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </div>
  )
}

function BulkDialogActions({
  confirmLabel,
  confirmVariant = "primary",
  disabled,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string
  confirmVariant?: "primary" | "danger"
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-end gap-2">
      <Button disabled={disabled} type="button" variant="secondary" onClick={onCancel}>
        Avbryt
      </Button>
      <Button disabled={disabled} type="button" variant={confirmVariant} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  )
}

function buildBulkDeleteMessage(result: {
  blocked?: Array<{ installationCount: number; name: string }>
  blockedCount: number
  deletedCount: number
}) {
  const base = `${result.deletedCount} fastigheter togs bort.`
  if (result.blockedCount === 0) return base

  const blockedNames = (result.blocked ?? [])
    .slice(0, 3)
    .map((property) => `${property.name} (${property.installationCount} aggregat)`)
    .join(", ")

  return `${base} ${result.blockedCount} lämnades kvar eftersom de har kopplade aggregat${
    blockedNames ? `: ${blockedNames}` : ""
  }.`
}

function formatClearFieldLabels(fields: ClearablePropertyField[]) {
  const labels = fields.map(
    (field) =>
      clearableFieldOptions.find((option) => option.value === field)?.label ?? field
  )

  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(", ")} och ${labels.at(-1)}`
}

function toSearchableSelectOption(value: string): SearchableSelectOption {
  return {
    label: value,
    value,
  }
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
