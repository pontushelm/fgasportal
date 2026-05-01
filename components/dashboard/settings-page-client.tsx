"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge, Card, PageHeader, SectionHeader } from "@/components/ui"
import { ThemeSelect } from "@/components/theme/theme-select"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
  email?: string | null
  name?: string | null
}

export default function SettingsPageClient() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchCurrentUser() {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        if (!isMounted) return
        setError("Kunde inte hämta dina inställningar")
        setIsLoading(false)
        return
      }

      const user: CurrentUser = await response.json()

      if (!isMounted) return
      setCurrentUser(user)
      setIsLoading(false)
    }

    void fetchCurrentUser()

    return () => {
      isMounted = false
    }
  }, [router])

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Personligt"
        title="Mina inställningar"
        subtitle="Hantera inställningar som bara gäller för ditt eget användarkonto."
      />

      {isLoading && (
        <p className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Laddar inställningar...
        </p>
      )}
      {error && <p className="mt-8 font-semibold text-red-700">{error}</p>}

      {!isLoading && !error && currentUser && (
        <div className="mt-8 grid gap-6">
          <Card className="p-5">
            <SectionHeader
              title="Konto"
              subtitle="Grunduppgifter för den inloggade användaren."
            />
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <ReadOnlyItem label="E-post" value={currentUser.email || "-"} />
              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Roll
                </dt>
                <dd className="mt-2">
                  <Badge variant="neutral">{formatRoleLabel(currentUser.role)}</Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <SectionHeader
              title="Utseende"
              subtitle="Välj om FgasPortal ska visas i ljust eller mörkt läge."
            />
            <div className="mt-5">
              <ThemeSelect />
            </div>
          </Card>
        </div>
      )}
    </main>
  )
}

function ReadOnlyItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </dd>
    </div>
  )
}
