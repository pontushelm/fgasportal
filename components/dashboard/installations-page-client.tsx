"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { UserRole } from "@/lib/auth"
import type { ComplianceStatus } from "@/lib/fgas-calculations"

type Installation = {
  id: string
  name: string
  location: string
  refrigerantType: string
  refrigerantAmount: number
  complianceStatus: ComplianceStatus
  nextInspection?: string | null
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

type DashboardData = {
  installations: Installation[]
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

export default function InstallationsPage() {
  const router = useRouter()
  const [installations, setInstallations] = useState<Installation[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [contractorId, setContractorId] = useState("")
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      setIsLoading(true)
      setError("")

      const [dashboardRes, userRes] = await Promise.all([
        fetch("/api/dashboard/compliance", {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (dashboardRes.status === 401 || userRes.status === 401) {
        router.push("/login")
        return
      }

      if (!dashboardRes.ok || !userRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta aggregat")
        setIsLoading(false)
        return
      }

      const dashboardData: DashboardData = await dashboardRes.json()
      const userData: CurrentUser = await userRes.json()
      const contractorsData: Contractor[] =
        userData.role === "ADMIN"
          ? await fetch("/api/company/contractors", {
              credentials: "include",
            }).then((response) => (response.ok ? response.json() : []))
          : []

      if (!isMounted) return

      setInstallations(dashboardData.installations)
      setCurrentUser(userData)
      setContractors(contractorsData)
      setSelectedIds([])
      setIsLoading(false)
    }

    void fetchData()

    return () => {
      isMounted = false
    }
  }, [refreshKey, router])

  const canManage = currentUser?.role === "ADMIN"
  const allSelected = useMemo(
    () => installations.length > 0 && selectedIds.length === installations.length,
    [installations.length, selectedIds.length]
  )

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
      <Link className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline" href="/dashboard">
        Tillbaka till dashboard
      </Link>

      <div className="mt-6 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Aggregat
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Registrerade aggregat
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            Välj flera aggregat för att tilldela servicepartner eller markera dem som inaktiva.
          </p>
        </div>
        <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" href="/dashboard/installations/import">
          Import Excel
        </Link>
      </div>

      {isLoading && <p className="mt-8 text-slate-700">Laddar...</p>}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}
      {success && <p className="mt-8 font-semibold text-green-700">{success}</p>}

      {!isLoading && !canManage && (
        <p className="mt-8 text-slate-700">
          Endast administratörer kan använda bulkåtgärder.
        </p>
      )}

      {!isLoading && canManage && (
        <>
          {selectedIds.length > 0 && (
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

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      aria-label="Välj alla aggregat"
                      checked={allSelected}
                      onChange={toggleAll}
                      type="checkbox"
                    />
                  </th>
                  <TableHeader>Aggregat</TableHeader>
                  <TableHeader>Plats</TableHeader>
                  <TableHeader>Köldmedium</TableHeader>
                  <TableHeader>Mängd</TableHeader>
                  <TableHeader>Nästa kontroll</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {installations.map((installation) => (
                  <tr className="hover:bg-slate-50" key={installation.id}>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Välj ${installation.name}`}
                        checked={selectedIds.includes(installation.id)}
                        onChange={() => toggleInstallation(installation.id)}
                        type="checkbox"
                      />
                    </td>
                    <TableCell>
                      <Link className="font-semibold text-slate-950 underline-offset-4 hover:underline" href={`/dashboard/installations/${installation.id}`}>
                        {installation.name}
                      </Link>
                    </TableCell>
                    <TableCell>{installation.location}</TableCell>
                    <TableCell>{installation.refrigerantType}</TableCell>
                    <TableCell>{formatNumber(installation.refrigerantAmount)} kg</TableCell>
                    <TableCell>{formatOptionalDate(installation.nextInspection)}</TableCell>
                    <TableCell>
                      <StatusBadge status={installation.complianceStatus} />
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {installations.length === 0 && (
            <p className="mt-6 text-sm text-slate-700">Inga aggregat registrerade.</p>
          )}
        </>
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
    </main>
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

function formatOptionalDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE").format(new Date(value)) : "-"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 2,
  }).format(value)
}
