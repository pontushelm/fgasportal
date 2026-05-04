"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
} from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type ActivityEntry = {
  id: string
  action: string
  label: string
  entityType: string
  entityId?: string | null
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
  installation?: {
    id: string
    name: string
    location: string
    property?: {
      id: string
      name: string | null
      municipality?: string | null
    } | null
  } | null
  property?: {
    id: string | null
    name: string | null
    municipality?: string | null
  } | null
  user?: {
    id: string
    name: string
    email: string
  } | null
}

type ActivityResponse = {
  entries: ActivityEntry[]
  filters: {
    eventTypes: Array<{ label: string; value: string }>
    installations: Array<{ id: string; name: string; location: string }>
    users: Array<{ id: string; name: string; email: string }>
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const pageSize = "25"

export default function ActivityPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const eventType = searchParams.get("eventType") || ""
  const userId = searchParams.get("userId") || ""
  const installationId = searchParams.get("installationId") || ""
  const fromDate = searchParams.get("fromDate") || ""
  const toDate = searchParams.get("toDate") || ""
  const page = Number.parseInt(searchParams.get("page") || "1", 10)

  useEffect(() => {
    let isMounted = true

    async function fetchActivity() {
      setIsLoading(true)
      setError("")

      const params = new URLSearchParams(searchParams.toString())
      params.set("pageSize", pageSize)

      const [activityRes, userRes] = await Promise.all([
        fetch(`/api/activity?${params.toString()}`, {
          credentials: "include",
        }),
        fetch("/api/auth/me", {
          credentials: "include",
        }),
      ])

      if (activityRes.status === 401 || userRes.status === 401) {
        router.push("/login")
        return
      }

      if (activityRes.status === 403) {
        router.replace("/dashboard/settings")
        return
      }

      if (!activityRes.ok || !userRes.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta aktivitetsloggen")
        setIsLoading(false)
        return
      }

      const activityData: ActivityResponse = await activityRes.json()
      const userData: CurrentUser = await userRes.json()

      if (!isMounted) return

      setData(activityData)
      setCurrentUser(userData)
      setIsLoading(false)
    }

    void fetchActivity()

    return () => {
      isMounted = false
    }
  }, [queryString, router, searchParams])

  const hasActiveFilters = useMemo(
    () => Boolean(eventType || userId || installationId || fromDate || toDate),
    [eventType, fromDate, installationId, toDate, userId]
  )

  function updateQueryParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")

    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }

    router.replace(`/dashboard/activity${params.toString() ? `?${params.toString()}` : ""}`)
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(nextPage))
    router.replace(`/dashboard/activity?${params.toString()}`)
  }

  function clearFilters() {
    router.replace("/dashboard/activity")
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Spårbarhet"
        title="Aktivitetslogg"
        subtitle="Se vad som har hänt i systemet, när det hände och vem som utförde åtgärden."
      />

      <Card className="mt-6 p-5">
        <SectionHeader
          title="Filter"
          subtitle="Filtrera aktivitetsloggen utan att ladda hela historiken."
          actions={
            hasActiveFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Rensa filter
              </Button>
            ) : null
          }
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Händelsetyp"
            value={eventType}
            onChange={(value) => updateQueryParam("eventType", value)}
          >
            <option value="">Alla händelser</option>
            {data?.filters.eventTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Användare"
            value={userId}
            onChange={(value) => updateQueryParam("userId", value)}
          >
            <option value="">Alla användare</option>
            {data?.filters.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Aggregat"
            value={installationId}
            onChange={(value) => updateQueryParam("installationId", value)}
          >
            <option value="">Alla aggregat</option>
            {data?.filters.installations.map((installation) => (
              <option key={installation.id} value={installation.id}>
                {installation.name}
              </option>
            ))}
          </FilterSelect>

          <DateInput
            label="Från datum"
            value={fromDate}
            onChange={(value) => updateQueryParam("fromDate", value)}
          />
          <DateInput
            label="Till datum"
            value={toDate}
            onChange={(value) => updateQueryParam("toDate", value)}
          />
        </div>
      </Card>

      {isLoading && (
        <p className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Laddar aktivitetslogg...
        </p>
      )}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && data && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                Händelser
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {data.pagination.total} loggposter i urvalet.
              </p>
            </div>
            {currentUser?.role && (
              <Badge variant="neutral">{formatRoleLabel(currentUser.role)}</Badge>
            )}
          </div>

          {data.entries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Inga händelser hittades"
                description="Justera filtren eller välj ett bredare datumintervall."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>
                    <TableHeader>Tidpunkt</TableHeader>
                    <TableHeader>Händelse</TableHeader>
                    <TableHeader>Aggregat</TableHeader>
                    <TableHeader>Fastighet</TableHeader>
                    <TableHeader>Användare</TableHeader>
                    <TableHeader>Detalj</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {data.entries.map((entry) => (
                    <ActivityRow entry={entry} key={entry.id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Sida {data.pagination.page} av {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={data.pagination.page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Föregående
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Nästa
              </Button>
            </div>
          </div>
        </Card>
      )}
    </main>
  )
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return (
    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-800">
      <TableCell>{formatTimestamp(entry.createdAt)}</TableCell>
      <TableCell>
        <Badge variant={getActionBadgeVariant(entry.action)}>{entry.label}</Badge>
      </TableCell>
      <TableCell>
        {entry.installation ? (
          <Link
            className="font-semibold text-slate-950 underline-offset-4 hover:underline dark:text-slate-100"
            href={`/dashboard/installations/${entry.installation.id}`}
          >
            {entry.installation.name}
          </Link>
        ) : (
          "-"
        )}
        {entry.installation?.location && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {entry.installation.location}
          </div>
        )}
      </TableCell>
      <TableCell>
        {entry.property?.name || "-"}
        {entry.property?.municipality && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {entry.property.municipality}
          </div>
        )}
      </TableCell>
      <TableCell>{formatUser(entry.user)}</TableCell>
      <TableCell>
        <div className="max-w-sm whitespace-normal text-slate-700 dark:text-slate-300">
          {entry.description || "-"}
        </div>
        <MetadataSummary metadata={entry.metadata} />
      </TableCell>
    </tr>
  )
}

function MetadataSummary({
  metadata,
}: {
  metadata?: Record<string, unknown> | null
}) {
  if (!metadata) return null

  const values = [
    formatMetadataValue("Format", metadata.format),
    formatMetadataValue("År", metadata.year),
    formatMetadataValue("Bulk", metadata.bulkAction === true ? "Ja" : undefined),
  ].filter(Boolean)

  if (values.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
      {values.map((value) => (
        <span
          className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800"
          key={value}
        >
          {value}
        </span>
      ))}
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
    <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  )
}

function DateInput({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      <input
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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

function getActionBadgeVariant(action: string) {
  if (action.includes("leak") || action.includes("overdue")) return "danger"
  if (action.includes("reminder") || action.includes("due")) return "warning"
  if (action.includes("document")) return "info"
  if (action.includes("report")) return "neutral"

  return "success"
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatUser(user?: ActivityEntry["user"]) {
  if (!user) return "-"

  return (
    <div>
      <div className="font-semibold text-slate-950 dark:text-slate-100">
        {user.name || user.email}
      </div>
      {user.name && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {user.email}
        </div>
      )}
    </div>
  )
}

function formatMetadataValue(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null
  return `${label}: ${String(value)}`
}
