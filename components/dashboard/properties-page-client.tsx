"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import { isAdminRole } from "@/lib/roles"

type PropertySummary = {
  id: string
  name: string
  municipality: string | null
  city: string | null
  installationsCount: number
  totalCo2eTon: number
  overdueInspections: number
  highRiskInstallations: number
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
  const [error, setError] = useState("")
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")

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
  }, [router])

  const canCreateProperties = isAdminRole(currentUser?.role)

  function handlePropertyChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPropertyForm({
      ...propertyForm,
      [event.target.name]: event.target.value,
    })
  }

  async function handlePropertySubmit(event: React.FormEvent) {
    event.preventDefault()
    setCreateError("")
    setCreateSuccess("")
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
      setIsCreating(false)
      return
    }

    const overviewData: PropertySummary[] = await overviewResponse.json()
    setProperties(overviewData)
    setPropertyForm(initialPropertyFormData)
    setCreateSuccess("Fastigheten har lagts till")
    setIsCreating(false)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        title="Fastighetsöversikt"
        subtitle="Följ kontrollstatus, risk och klimatpåverkan per fastighet."
      />

      {isLoading && <p className="mt-8 text-sm text-slate-700">Laddar fastigheter...</p>}
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
              {createSuccess && <p className="text-sm font-semibold text-green-700">{createSuccess}</p>}
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
                  <TableHeader>Fastighet</TableHeader>
                  <TableHeader>Kommun</TableHeader>
                  <TableHeader>Antal aggregat</TableHeader>
                  <TableHeader>Total CO₂e</TableHeader>
                  <TableHeader>Försenade kontroller</TableHeader>
                  <TableHeader>Högriskaggregat</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {properties.map((property) => (
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
                    <TableCell>{formatNumber(property.totalCo2eTon)} ton</TableCell>
                    <TableCell>
                      <StatusCount count={property.overdueInspections} />
                    </TableCell>
                    <TableCell>
                      <RiskCount count={property.highRiskInstallations} />
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </main>
  )
}

function StatusCount({ count }: { count: number }) {
  if (count === 0) return <Badge variant="success">0</Badge>
  return <Badge variant="danger">{count}</Badge>
}

function RiskCount({ count }: { count: number }) {
  if (count === 0) return <Badge variant="success">0</Badge>
  return <Badge variant="warning">{count}</Badge>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
