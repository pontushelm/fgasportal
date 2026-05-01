"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge, buttonClassName, Card, EmptyState, PageHeader } from "@/components/ui"

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

export default function PropertiesPageClient() {
  const router = useRouter()
  const [properties, setProperties] = useState<PropertySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchProperties() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/properties/overview", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta fastigheter")
        setIsLoading(false)
        return
      }

      const data: PropertySummary[] = await response.json()
      if (!isMounted) return

      setProperties(data)
      setIsLoading(false)
    }

    void fetchProperties()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <PageHeader
        actions={
          <>
            <Link className={buttonClassName({ variant: "secondary" })} href="/dashboard/installations">
              Installationer
            </Link>
            <Link className={buttonClassName({ variant: "secondary" })} href="/dashboard/reports">
              Rapporter
            </Link>
          </>
        }
        backHref="/dashboard"
        backLabel="Tillbaka till dashboard"
        eyebrow="Fastigheter"
        title="Fastighetsöversikt"
        subtitle="Se compliance, risk och klimatpåverkan per fastighet."
      />

      {isLoading && <p className="mt-8 text-sm text-slate-700">Laddar fastigheter...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && properties.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Inga fastigheter att visa"
          description="Lägg till fastigheter under företagsinställningar eller koppla aggregat till en fastighet."
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
