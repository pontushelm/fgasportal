"use client"

import { mutate as mutateGlobal } from "swr"
import { API_CACHE_KEYS, apiFetcher } from "@/lib/client/api-cache"

export const DASHBOARD_CACHE_WARMUP_SESSION_KEY =
  "fgasportal-cache-warmed"

type WarmupStorage = Pick<Storage, "getItem" | "setItem">

type DashboardCacheWarmupOptions = {
  reportYear?: number
  storage?: WarmupStorage | null
}

export type DashboardCacheWarmupResult = {
  attempted: boolean
  keys: string[]
  fulfilled: number
  rejected: number
}

export function getDashboardCacheWarmupKeys({
  reportYear = new Date().getFullYear(),
}: { reportYear?: number } = {}) {
  const annualOverviewQuery = new URLSearchParams({
    reportType: "annual",
    year: String(reportYear),
    overviewOnly: "1",
  }).toString()

  return [
    API_CACHE_KEYS.dashboard,
    API_CACHE_KEYS.actions,
    API_CACHE_KEYS.dataQuality,
    API_CACHE_KEYS.properties,
    API_CACHE_KEYS.propertiesOverview,
    API_CACHE_KEYS.installations,
    API_CACHE_KEYS.installationsFilterSource,
    API_CACHE_KEYS.contractorsOverview,
    API_CACHE_KEYS.reportsFgas(annualOverviewQuery),
    API_CACHE_KEYS.notifications,
  ]
}

export function shouldRunDashboardCacheWarmup(
  storage: WarmupStorage | null = getBrowserSessionStorage()
) {
  return storage?.getItem(DASHBOARD_CACHE_WARMUP_SESSION_KEY) !== "true"
}

export async function warmDashboardCache({
  reportYear,
  storage = getBrowserSessionStorage(),
}: DashboardCacheWarmupOptions = {}): Promise<DashboardCacheWarmupResult> {
  const keys = getDashboardCacheWarmupKeys({ reportYear })

  if (!shouldRunDashboardCacheWarmup(storage)) {
    return {
      attempted: false,
      fulfilled: 0,
      keys,
      rejected: 0,
    }
  }

  storage?.setItem(DASHBOARD_CACHE_WARMUP_SESSION_KEY, "true")

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      const data = await apiFetcher(key)

      await mutateGlobal(key, data, {
        populateCache: true,
        revalidate: false,
        throwOnError: false,
      })
    })
  )

  return {
    attempted: true,
    fulfilled: results.filter((result) => result.status === "fulfilled").length,
    keys,
    rejected: results.filter((result) => result.status === "rejected").length,
  }
}

function getBrowserSessionStorage() {
  if (typeof window === "undefined") return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
