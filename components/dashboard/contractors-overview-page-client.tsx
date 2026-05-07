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
import type { CertificationStatusResult } from "@/lib/certification-status"

type ContractorOverview = {
  id: string
  name: string
  email: string
  isActive: boolean
  isCertifiedCompany: boolean
  certificationNumber: string | null
  certificationOrganization: string | null
  certificationValidUntil: string | null
  certificationStatus: CertificationStatusResult
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
    expiredCertifications: number
  }
  contractors: ContractorOverview[]
}

export default function ContractorsOverviewPageClient() {
  const router = useRouter()
  const [data, setData] = useState<ContractorsOverviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)

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

  async function refreshOverview() {
    const response = await fetch("/api/contractors/overview", {
      credentials: "include",
    })

    if (response.ok) {
      const overview: ContractorsOverviewResponse = await response.json()
      setData(overview)
    }
  }

  function openInviteModal() {
    setInviteEmail("")
    setInviteError("")
    setInviteSuccess("")
    setInviteLink("")
    setIsInviteOpen(true)
  }

  async function handleInviteSubmit(event: React.FormEvent) {
    event.preventDefault()
    setInviteError("")
    setInviteSuccess("")
    setInviteLink("")
    setIsSubmittingInvite(true)

    const response = await fetch("/api/company/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: inviteEmail,
        role: "CONTRACTOR",
      }),
    })
    const result: {
      error?: string
      inviteLink?: string
      message?: string
    } = await response.json()

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (!response.ok) {
      setInviteError(result.error || "Kunde inte skicka inbjudan.")
      setIsSubmittingInvite(false)
      return
    }

    setInviteSuccess(
      result.inviteLink
        ? "Inbjudan har skickats."
        : result.message || "Servicepartnern har lagts till."
    )
    setInviteLink(result.inviteLink || "")
    setInviteEmail("")
    setIsSubmittingInvite(false)
    await refreshOverview()
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Servicepartners"
        title="Servicepartneröversikt"
        subtitle="Följ arbetsbelastning, försenade kontroller och risk per tilldelad servicepartner."
        actions={
          <button
            className={buttonClassName({ variant: "secondary" })}
            type="button"
            onClick={openInviteModal}
          >
            Bjud in servicepartner
          </button>
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
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
            <MetricCard
              label="Utgången certifiering"
              tone={data.summary.expiredCertifications > 0 ? "danger" : "success"}
              value={data.summary.expiredCertifications}
            />
          </section>

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <SectionHeader
                title="Servicepartners"
                subtitle="Klicka på en servicepartner för att se filtrerade aggregat."
              />
            </div>

            {data.contractors.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga servicepartners har lagts till ännu."
                  description="Bjud in servicepartners här när ni vill tilldela aggregat."
                  action={
                    <button
                      className={buttonClassName({ variant: "primary" })}
                      type="button"
                      onClick={openInviteModal}
                    >
                      Bjud in servicepartner
                    </button>
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
                      <TableHeader>Certifiering</TableHeader>
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
                        <TableCell>
                          <CertificationBadge status={contractor.certificationStatus} />
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

      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                  Bjud in servicepartner
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Bjud in en extern servicepartner som kan hantera tilldelade aggregat, kontroller och servicehändelser.
                </p>
              </div>
              <button
                aria-label="Stäng"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                type="button"
                onClick={() => setIsInviteOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={handleInviteSubmit}>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                E-post
                <input
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                />
              </label>

              {inviteError && (
                <p className="text-sm font-semibold text-red-700">{inviteError}</p>
              )}
              {inviteSuccess && (
                <p className="text-sm font-semibold text-green-700">{inviteSuccess}</p>
              )}
              {inviteLink && (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  Inbjudningslänk:{" "}
                  <code className="break-all text-slate-950 dark:text-slate-100">
                    {inviteLink}
                  </code>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className={buttonClassName({ variant: "secondary" })}
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={isSubmittingInvite}
                >
                  Stäng
                </button>
                <button
                  className={buttonClassName({ variant: "primary" })}
                  type="submit"
                  disabled={isSubmittingInvite}
                >
                  {isSubmittingInvite ? "Skickar..." : "Skicka inbjudan"}
                </button>
              </div>
            </form>
          </div>
        </div>
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

function CertificationBadge({ status }: { status: CertificationStatusResult }) {
  return (
    <Badge
      title="Certifieringsuppgifter hanteras av servicepartnern."
      variant={status.variant}
    >
      {status.label}
    </Badge>
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
