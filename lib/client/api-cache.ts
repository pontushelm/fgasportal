"use client"

import useSWR, { mutate as mutateGlobal, type SWRConfiguration } from "swr"

export const API_CACHE_KEYS = {
  actions: "/api/dashboard/actions",
  activity: (queryString: string) =>
    `/api/activity${queryString ? `?${queryString}` : ""}`,
  authMe: "/api/auth/me",
  dashboard: "/api/dashboard/compliance",
  dataQuality: "/api/dashboard/data-quality",
  notifications: "/api/dashboard/notifications",
  company: "/api/company",
  companyInvitations: "/api/company/invitations",
  contractorCertification: (userId: string) =>
    `/api/company/contractors/${userId}/certification`,
  contractorsOverview: "/api/contractors/overview",
  properties: "/api/properties",
  propertiesOverview: "/api/properties/overview",
  savedFilters: (page: string) => `/api/saved-filters?page=${page}`,
  serviceCompany: "/api/dashboard/service/company",
  serviceCompanyCertificationDocument:
    "/api/dashboard/service/company/certification/document",
  serviceDashboard: "/api/dashboard/service",
  servicePartnerCompany: (companyId: string) =>
    `/api/service-partner-companies/${companyId}`,
  serviceTechnicians: "/api/dashboard/service/technicians",
  technicianCertificationDocument: (userId: string) =>
    `/api/dashboard/service/technicians/${userId}/certification/document`,
  userTechnicianCertification: "/api/user/technician-certification",
  userTechnicianCertificationDocument:
    "/api/user/technician-certification/document",
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

export function isForbiddenApiError(error: unknown) {
  return error instanceof ApiFetchError && error.status === 403
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

export async function invalidateServicepartnerCaches(companyId?: string | null) {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.contractorsOverview),
    mutateGlobal(API_CACHE_KEYS.serviceDashboard),
    mutateGlobal(API_CACHE_KEYS.serviceTechnicians),
    mutateGlobal(API_CACHE_KEYS.actions),
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
    companyId ? mutateGlobal(API_CACHE_KEYS.servicePartnerCompany(companyId)) : Promise.resolve(),
  ])
}

export async function invalidateSettingsCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.authMe),
    mutateGlobal(API_CACHE_KEYS.notifications),
    mutateGlobal(API_CACHE_KEYS.userTechnicianCertification),
    mutateGlobal(API_CACHE_KEYS.userTechnicianCertificationDocument),
  ])
}

export async function invalidateCompanySettingsCaches() {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.authMe),
    mutateGlobal(API_CACHE_KEYS.company),
    mutateGlobal(API_CACHE_KEYS.companyInvitations),
    mutateGlobal(API_CACHE_KEYS.serviceCompany),
    mutateGlobal(API_CACHE_KEYS.serviceCompanyCertificationDocument),
    mutateGlobal(API_CACHE_KEYS.notifications),
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
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
