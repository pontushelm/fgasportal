"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Badge,
  buttonClassName,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
} from "@/components/ui"

type ContractorOverview = {
  id: string
  name: string
  email: string
  isActive: boolean
  assignedInstallationsCount: number
  overdueInspections: number
  dueSoonInspections: number
  highRiskInstallations: number
  leakageEventsCount: number
  latestActivityDate: string | null
}

type ContractorsOverviewResponse = {
  summary: {
    totalContractors: number
    assignedInstallations: number
    overdueInspections: number
    highRiskInstallations: number
  }
  contractors: ContractorOverview[]
}

export default function ContractorsOverviewPageClient() {
  const router = useRouter()
  const [data, setData] = useState<ContractorsOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchOverview() {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/contractors/overview", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (response.status === 403) {
        if (!isMounted) return
        setError("Du har inte behörighet att se servicepartneröversikten.")
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta servicepartners.")
        setIsLoading(false)
        return
      }

      const overview: ContractorsOverviewResponse = await response.json()
      if (!isMounted) return

      setData(overview)
      setIsLoading(false)
    }

    void fetchOverview()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Servicepartners"
        title="Servicepartneröversikt"
        subtitle="Följ arbetsbelastning, försenade kontroller och risk per tilldelad servicepartner."
        actions={
          <Link
            className={buttonClassName({ variant: "secondary" })}
            href="/dashboard/company"
          >
            Hantera inbjudningar
          </Link>
        }
      />

      {isLoading && (
        <p className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Laddar servicepartners...
        </p>
      )}
      {error && <p className="mt-8 text-sm font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && data && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Totalt antal servicepartners"
              value={data.summary.totalContractors}
            />
            <MetricCard
              label="Tilldelade aggregat"
              value={data.summary.assignedInstallations}
            />
            <MetricCard
              label="Försenade kontroller"
              tone={data.summary.overdueInspections > 0 ? "danger" : "success"}
              value={data.summary.overdueInspections}
            />
            <MetricCard
              label="Högriskaggregat"
              tone={data.summary.highRiskInstallations > 0 ? "warning" : "success"}
              value={data.summary.highRiskInstallations}
            />
          </section>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Servicepartners"
                subtitle="Klicka på en servicepartner för att se filtrerade installationer."
              />
            </div>

            {data.contractors.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga servicepartners har lagts till ännu."
                  description="Bjud in servicepartners från företagsinställningarna när ni vill tilldela aggregat."
                  action={
                    <Link
                      className={buttonClassName({ variant: "primary" })}
                      href="/dashboard/company"
                    >
                      Öppna företagsinställningar
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <TableHeader>Servicepartner</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Tilldelade aggregat</TableHeader>
                      <TableHeader>Försenade kontroller</TableHeader>
                      <TableHeader>Inom 30 dagar</TableHeader>
                      <TableHeader>Högriskaggregat</TableHeader>
                      <TableHeader>Läckage</TableHeader>
                      <TableHeader>Senaste aktivitet</TableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.contractors.map((contractor) => (
                      <tr
                        className="align-top hover:bg-slate-50 dark:hover:bg-slate-800"
                        key={contractor.id}
                      >
                        <TableCell>
                          <Link
                            className="font-semibold text-slate-950 underline-offset-4 hover:underline dark:text-slate-100"
                            href={`/dashboard/installations?contractorId=${contractor.id}`}
                          >
                            {contractor.name || contractor.email}
                          </Link>
                          {contractor.name && (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {contractor.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge isActive={contractor.isActive} />
                        </TableCell>
                        <TableCell>{contractor.assignedInstallationsCount}</TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="danger"
                            count={contractor.overdueInspections}
                          />
                        </TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="warning"
                            count={contractor.dueSoonInspections}
                          />
                        </TableCell>
                        <TableCell>
                          <CountBadge
                            activeVariant="warning"
                            count={contractor.highRiskInstallations}
                          />
                        </TableCell>
                        <TableCell>{contractor.leakageEventsCount}</TableCell>
                        <TableCell>
                          {formatOptionalDateTime(contractor.latestActivityDate)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  )
}

function MetricCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string
  tone?: "danger" | "neutral" | "success" | "warning"
  value: number
}) {
  const accentClassName = {
    danger: "border-l-red-400",
    neutral: "border-l-blue-400",
    success: "border-l-emerald-400",
    warning: "border-l-amber-400",
  }[tone]

  return (
    <Card className={`border-l-4 p-5 ${accentClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-slate-100">
        {formatNumber(value)}
      </p>
    </Card>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="success">Aktiv</Badge>
  ) : (
    <Badge variant="neutral">Inaktiv</Badge>
  )
}

function CountBadge({
  activeVariant,
  count,
}: {
  activeVariant: "danger" | "warning"
  count: number
}) {
  return count > 0 ? (
    <Badge variant={activeVariant}>{count}</Badge>
  ) : (
    <Badge variant="success">0</Badge>
  )
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
      {children}
    </th>
  )
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-slate-800 dark:text-slate-200">
      {children}
    </td>
  )
}

function formatOptionalDateTime(value: string | null) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value)
}
