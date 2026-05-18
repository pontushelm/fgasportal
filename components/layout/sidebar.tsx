"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  activeMembershipId: string | null
  companyId: string
  companyName: string | null
  email: string | null
  name: string | null
  role: UserRole
  servicePartnerCompanyId: string | null
  isServicePartnerAdmin: boolean
  memberships: UserMembership[]
}

type UserMembership = {
  id: string
  companyId: string
  companyName: string
  role: UserRole
  servicePartnerCompanyId: string | null
  isServicePartnerAdmin: boolean
}

type NavigationItem = {
  href: string
  label: string
  roles?: UserRole[]
}

type FeedbackType = "BUG" | "IMPROVEMENT" | "QUESTION" | "OTHER"

const feedbackTypeOptions: Array<{ value: FeedbackType; label: string }> = [
  { value: "BUG", label: "Bug" },
  { value: "IMPROVEMENT", label: "Förbättringsförslag" },
  { value: "QUESTION", label: "Fråga" },
  { value: "OTHER", label: "Annat" },
]

const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["OWNER", "ADMIN", "MEMBER"] },
  { href: "/dashboard/actions", label: "Åtgärder", roles: ["OWNER", "ADMIN", "MEMBER"] },
  {
    href: "/dashboard/installations",
    label: "Aggregat",
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    href: "/dashboard/properties",
    label: "Fastigheter",
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    href: "/dashboard/reports",
    label: "Rapporter",
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    href: "/dashboard/contractors",
    label: "Servicepartners",
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    href: "/dashboard/activity",
    label: "Aktivitetslogg",
    roles: ["OWNER", "ADMIN", "MEMBER"],
  },
  { href: "/dashboard/service", label: "Serviceuppdrag", roles: ["CONTRACTOR"] },
  { href: "/dashboard/installations", label: "Mina aggregat", roles: ["CONTRACTOR"] },
]

const secondaryNavigation: NavigationItem[] = [
  {
    href: "/dashboard/company",
    label: "Företagsinställningar",
    roles: ["OWNER", "ADMIN"],
  },
  {
    href: "/dashboard/settings",
    label: "Mina inställningar",
  },
  {
    href: "/dashboard/help",
    label: "Hjälp",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isSwitchingCompany, setIsSwitchingCompany] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

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

      if (!response.ok || !isMounted) return

      const user: CurrentUser = await response.json()
      setCurrentUser(user)
    }

    void fetchCurrentUser()

    return () => {
      isMounted = false
    }
  }, [router])

  const visiblePrimaryItems = useMemo(
    () => getPrimaryNavigation(currentUser),
    [currentUser]
  )
  const visibleSecondaryItems = useMemo(
    () => getSecondaryNavigation(currentUser),
    [currentUser]
  )
  const homeHref =
    currentUser?.role === "CONTRACTOR" ? "/dashboard/installations" : "/dashboard"

  async function handleCompanyChange(membershipId: string) {
    if (!membershipId || membershipId === currentUser?.activeMembershipId) return

    setIsSwitchingCompany(true)
    const response = await fetch("/api/auth/switch-company", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ membershipId }),
    })

    if (response.status === 401) {
      router.push("/login")
      return
    }

    if (response.ok) {
      const result: { membership?: { role?: UserRole } } = await response.json()
      const nextHref =
        result.membership?.role === "CONTRACTOR"
          ? "/dashboard/installations"
          : "/dashboard"
      router.refresh()
      window.location.assign(nextHref)
      return
    }

    setIsSwitchingCompany(false)
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })

    if (response.ok || response.status === 401) {
      router.refresh()
      router.push("/login")
      return
    }

    setIsLoggingOut(false)
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 font-bold tracking-tight text-slate-950 dark:text-slate-100"
            href={homeHref}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:ring-slate-700">
              <Image
                alt="FgasPortal"
                className="h-7 w-7"
                height={256}
                priority
                src="/logo-mark.png"
                width={256}
              />
            </span>
            <span>FgasPortal</span>
          </Link>
          <CompanySwitcher
            currentUser={currentUser}
            disabled={isSwitchingCompany}
            onChange={handleCompanyChange}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsMobileOpen((current) => !current)}
          >
            Meny
          </Button>
        </div>
        {isMobileOpen && (
          <nav className="mt-3 grid gap-1 border-t border-slate-200 pt-3 dark:border-slate-800">
            <NavigationLinks
              onNavigate={() => setIsMobileOpen(false)}
              pathname={pathname}
              primaryItems={visiblePrimaryItems}
              secondaryItems={visibleSecondaryItems}
            />
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <SidebarUserInfo
                currentUser={currentUser}
                isLoggingOut={isLoggingOut}
                onOpenFeedback={() => setIsFeedbackOpen(true)}
                onLogout={handleLogout}
              />
            </div>
          </nav>
        )}
      </div>

      <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="flex h-full flex-col px-4 py-5">
          <div className="px-2">
            <Link
              className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-slate-950 dark:text-slate-100"
              href={homeHref}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 dark:ring-slate-700">
                <Image
                  alt="FgasPortal"
                  className="h-8 w-8"
                  height={256}
                  priority
                  src="/logo-mark.png"
                  width={256}
                />
              </span>
              <span>FgasPortal</span>
            </Link>
            <div className="mt-2 flex items-center gap-2">
              {currentUser?.role && (
                <Badge variant="neutral">{formatRoleLabel(currentUser.role)}</Badge>
              )}
            </div>
            <CompanySwitcher
              currentUser={currentUser}
              disabled={isSwitchingCompany}
              onChange={handleCompanyChange}
            />
          </div>

          <nav className="mt-8 grid gap-1">
            <NavigationLinks
              pathname={pathname}
              primaryItems={visiblePrimaryItems}
              secondaryItems={visibleSecondaryItems}
            />
          </nav>

          <SidebarUserInfo
            currentUser={currentUser}
            isLoggingOut={isLoggingOut}
            onOpenFeedback={() => setIsFeedbackOpen(true)}
            onLogout={handleLogout}
          />
        </div>
      </aside>
      <FeedbackDialog
        currentUser={currentUser}
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  )
}

function SidebarUserInfo({
  currentUser,
  isLoggingOut,
  onOpenFeedback,
  onLogout,
}: {
  currentUser: CurrentUser | null
  isLoggingOut: boolean
  onOpenFeedback: () => void
  onLogout: () => void
}) {
  return (
    <div className="mt-auto border-t border-slate-200 px-2 pt-4 text-sm dark:border-slate-800">
      {currentUser ? (
        <>
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
            {currentUser.name || "Användare"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {currentUser.email || ""}
          </p>
          <button
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50"
            type="button"
            onClick={onOpenFeedback}
          >
            Skicka feedback
          </button>
          <button
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Loggar ut..." : "Logga ut"}
          </button>
        </>
      ) : (
        <div className="grid gap-2">
          <div className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      )}
    </div>
  )
}

function FeedbackDialog({
  currentUser,
  isOpen,
  onClose,
}: {
  currentUser: CurrentUser | null
  isOpen: boolean
  onClose: () => void
}) {
  const [type, setType] = useState<FeedbackType>("BUG")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    setSuccess("")
    setIsSubmitting(true)

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        type,
        title,
        description,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
      }),
    })
    const result: { error?: string; message?: string } = await response.json()

    if (response.status === 401) {
      window.location.assign("/login")
      return
    }

    if (!response.ok) {
      setError(result.error || "Kunde inte skicka feedback")
      setIsSubmitting(false)
      return
    }

    setSuccess(result.message || "Tack, din feedback har skickats.")
    setTitle("")
    setDescription("")
    setType("BUG")
    setIsSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-100">
              Skicka feedback
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Rapportera en bug, fråga eller förbättring. Vi skickar med sida,
              användare och företag automatiskt.
            </p>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
            onClick={onClose}
          >
            Stäng
          </button>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Typ
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={type}
              onChange={(event) => setType(event.target.value as FeedbackType)}
            >
              {feedbackTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Rubrik
            <input
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              maxLength={120}
              placeholder="Kort sammanfattning"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Beskrivning
            <textarea
              className="min-h-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              maxLength={4000}
              placeholder="Vad hände, vad saknas eller vad vill du fråga om?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </label>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            Skickas från {currentUser?.companyName || "aktivt företag"} på aktuell sida.
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              {success}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Skickar..." : "Skicka feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CompanySwitcher({
  currentUser,
  disabled,
  onChange,
}: {
  currentUser: CurrentUser | null
  disabled: boolean
  onChange: (membershipId: string) => void
}) {
  if (!currentUser) {
    return (
      <div className="mt-3 h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
    )
  }

  if (currentUser.memberships.length <= 1) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
          {currentUser.companyName || "Företag"}
        </div>
      </div>
    )
  }

  return (
    <label className="mt-3 block">
      <span className="sr-only">Byt företag</span>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={currentUser.activeMembershipId || ""}
      >
        {currentUser.memberships.map((membership) => (
          <option key={membership.id} value={membership.id}>
            {membership.companyName} - {formatRoleLabel(membership.role)}
          </option>
        ))}
      </select>
    </label>
  )
}

function NavigationLinks({
  onNavigate,
  pathname,
  primaryItems,
  secondaryItems,
}: {
  onNavigate?: () => void
  pathname: string
  primaryItems: NavigationItem[]
  secondaryItems: NavigationItem[]
}) {
  return (
    <>
      {primaryItems.map((item) => (
        <NavigationLink
          item={item}
          key={item.href}
          onNavigate={onNavigate}
          pathname={pathname}
        />
      ))}

      {secondaryItems.length > 0 && (
        <>
          <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
          {secondaryItems.map((item) => (
            <NavigationLink
              item={item}
              key={item.href}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ))}
        </>
      )}
    </>
  )
}

function NavigationLink({
  item,
  onNavigate,
  pathname,
}: {
  item: NavigationItem
  onNavigate?: () => void
  pathname: string
}) {
  const isActive =
    item.href === "/dashboard"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        isActive
          ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      }`}
      href={item.href}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  )
}

function filterNavigationByRole(
  items: NavigationItem[],
  role: UserRole | undefined
) {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)))
}

function getPrimaryNavigation(currentUser: CurrentUser | null) {
  if (currentUser?.role !== "CONTRACTOR") {
    return filterNavigationByRole(primaryNavigation, currentUser?.role)
  }

  const items: NavigationItem[] = [
    {
      href: "/dashboard/installations",
      label: "Tilldelade aggregat",
    },
  ]

  return items
}

function getSecondaryNavigation(currentUser: CurrentUser | null) {
  if (currentUser?.role === "CONTRACTOR") {
    const items: NavigationItem[] = []

    if (currentUser.servicePartnerCompanyId || currentUser.isServicePartnerAdmin) {
      items.push({
        href: "/dashboard/company",
        label: "Företagsinställningar",
      })
    }

    items.push(
      {
        href: "/dashboard/settings",
        label: "Mina inställningar",
      },
      {
        href: "/dashboard/help",
        label: "Hjälp",
      }
    )

    return items
  }

  return filterNavigationByRole(secondaryNavigation, currentUser?.role)
}
