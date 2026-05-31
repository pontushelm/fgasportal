"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ImportDataWorkspace } from "@/components/dashboard/import-data-workspace"
import { Badge, Button, Card, EmptyState, PageHeader, Toast, type ToastMessage } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"

type PropertySummary = {
  id: string
  name: string
  municipality: string | null
  city: string | null
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
  const [properties, setProperties] = useState<PropertySummary[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [propertyForm, setPropertyForm] = useState<PropertyFormData>(
    initialPropertyFormData
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false)
  const [error, setError] = useState("")
  const [createError, setCreateError] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sort, setSort] = useState<{
    key: PropertySortKey | ""
    direction: SortDirection | ""
  }>({ key: "", direction: "" })
  const sortedProperties = useMemo(
    () => sortProperties(properties, sort.key, sort.direction),
    [properties, sort.direction, sort.key]
  )

  useEffect(() => {
    let isMounted = true

    async function fetchProperties() {
      setIsLoading(true)
      setError("")

      const [propertiesResponse, userResponse] = await Promise.all([
        fetch("/api/properties/overview", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (propertiesResponse.status === 401 || userResponse.status === 401) {
        router.push("/login")
        return
      }

      if (!propertiesResponse.ok || !userResponse.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta fastigheter")
        setIsLoading(false)
        return
      }

      const data: PropertySummary[] = await propertiesResponse.json()
      const userData: CurrentUser = await userResponse.json()
      if (!isMounted) return

      setProperties(data)
      setCurrentUser(userData)
      setIsLoading(false)
    }

    void fetchProperties()

    return () => {
      isMounted = false
    }
  }, [refreshKey, router])

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

    const overviewResponse = await fetch("/api/properties/overview", {
      credentials: "include",
    })

    if (overviewResponse.status === 401) {
      router.push("/login")
      return
    }

    if (!overviewResponse.ok) {
      setCreateError("Fastigheten skapades, men listan kunde inte uppdateras")
      setToast({
        type: "warning",
        title: "Varning",
        message: "Fastigheten skapades, men listan kunde inte uppdateras.",
      })
      setIsCreating(false)
      return
    }

    const overviewData: PropertySummary[] = await overviewResponse.json()
    setProperties(overviewData)
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

      {isLoading && <PropertiesLoadingSkeleton />}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && canCreateProperties && (
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

      {!isLoading && !error && properties.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Inga fastigheter att visa"
          description="Lägg till en fastighet här eller koppla aggregat till en fastighet."
        />
      )}

      {!isLoading && !error && properties.length > 0 && (
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
                {sortedProperties.map((property) => (
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
      )}
      {toast && <Toast onClose={() => setToast(null)} toast={toast} />}
      {isImportWorkspaceOpen && (
        <ImportDataWorkspace
          initialImportType="properties"
          onClose={() => setIsImportWorkspaceOpen(false)}
          onEventsImported={() => setRefreshKey((current) => current + 1)}
          onInstallationsImported={() => setRefreshKey((current) => current + 1)}
          onPropertiesImported={() => setRefreshKey((current) => current + 1)}
        />
      )}
    </main>
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
      return property.name
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
