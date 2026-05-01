"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Badge, Button } from "@/components/ui"
import type { UserRole } from "@/lib/auth"
import { formatRoleLabel } from "@/lib/roles"

type CurrentUser = {
  userId: string
  companyId: string
  role: UserRole
}

type NavigationItem = {
  href: string
  label: string
  roles?: UserRole[]
}

const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["OWNER", "ADMIN", "MEMBER"] },
  {
    href: "/dashboard/installations",
    label: "Installationer",
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
  { href: "/dashboard/service", label: "Serviceuppdrag", roles: ["CONTRACTOR"] },
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
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

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
    () => filterNavigationByRole(primaryNavigation, currentUser?.role),
    [currentUser?.role]
  )
  const visibleSecondaryItems = useMemo(
    () => filterNavigationByRole(secondaryNavigation, currentUser?.role),
    [currentUser?.role]
  )

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            className="inline-flex items-center gap-2 font-bold tracking-tight text-slate-950 dark:text-slate-100"
            href={currentUser?.role === "CONTRACTOR" ? "/dashboard/service" : "/dashboard"}
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
          </nav>
        )}
      </div>

      <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="flex h-full flex-col px-4 py-5">
          <div className="px-2">
            <Link
              className="inline-flex items-center gap-3 text-xl font-bold tracking-tight text-slate-950 dark:text-slate-100"
              href={currentUser?.role === "CONTRACTOR" ? "/dashboard/service" : "/dashboard"}
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
              <Badge variant="info">F-gas</Badge>
              {currentUser?.role && (
                <Badge variant="neutral">{formatRoleLabel(currentUser.role)}</Badge>
              )}
            </div>
          </div>

          <nav className="mt-8 grid gap-1">
            <NavigationLinks
              pathname={pathname}
              primaryItems={visiblePrimaryItems}
              secondaryItems={visibleSecondaryItems}
            />
          </nav>
        </div>
      </aside>
    </>
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
