"use client"

import useSWR, { mutate as mutateGlobal, type SWRConfiguration } from "swr"

export const API_CACHE_KEYS = {
  actions: "/api/dashboard/actions",
  authMe: "/api/auth/me",
  dashboard: "/api/dashboard/compliance",
  dataQuality: "/api/dashboard/data-quality",
  notifications: "/api/dashboard/notifications",
  company: "/api/company",
  properties: "/api/properties",
  propertiesOverview: "/api/properties/overview",
  savedFilters: (page: string) => `/api/saved-filters?page=${page}`,
} as const

export class ApiFetchError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiFetchError"
    this.status = status
  }
}

export async function apiFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
  })

  if (!response.ok) {
    throw new ApiFetchError(await getErrorMessage(response), response.status)
  }

  return response.json() as Promise<T>
}

export function useApiQuery<T>(
  key: string | null,
  options?: SWRConfiguration<T, ApiFetchError>
) {
  return useSWR<T, ApiFetchError>(key, apiFetcher<T>, {
    dedupingInterval: 10_000,
    keepPreviousData: true,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    ...options,
  })
}

export function isUnauthorizedApiError(error: unknown) {
  return error instanceof ApiFetchError && error.status === 401
}

export async function invalidateDashboardCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
  ])
}

export async function invalidatePropertyCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.properties),
    mutateGlobal(API_CACHE_KEYS.propertiesOverview),
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
  ])
}

export async function invalidateActionCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.actions),
    mutateGlobal(API_CACHE_KEYS.dashboard),
  ])
}

export async function invalidateNotificationCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.notifications),
    mutateGlobal(API_CACHE_KEYS.company),
    mutateGlobal(API_CACHE_KEYS.dashboard),
  ])
}

async function getErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error || `API request failed with ${response.status}`
  } catch {
    return `API request failed with ${response.status}`
  }
}
