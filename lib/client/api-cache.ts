"use client"

import useSWR, { mutate as mutateGlobal, type SWRConfiguration } from "swr"

export const API_CACHE_KEYS = {
  actions: "/api/dashboard/actions",
  activity: (queryString: string) =>
    `/api/activity${queryString ? `?${queryString}` : ""}`,
  authMe: "/api/auth/me",
  dashboard: "/api/dashboard/compliance",
  dataQuality: "/api/dashboard/data-quality",
  installations: "/api/installations",
  installationsFilterSource: "/api/installations?mode=filter-source",
  installationActivity: (installationId: string) =>
    `/api/installations/${installationId}/activity`,
  installationDetail: (installationId: string) =>
    `/api/installations/${installationId}`,
  installationDocuments: (installationId: string) =>
    `/api/installations/${installationId}/documents`,
  installationEvents: (installationId: string) =>
    `/api/installations/${installationId}/events`,
  notifications: "/api/dashboard/notifications",
  reportsFgas: (queryString: string) =>
    `/api/reports/fgas${queryString ? `?${queryString}` : ""}`,
  reportsAnnualFgasHistory: (queryString: string) =>
    `/api/reports/annual-fgas/history${queryString ? `?${queryString}` : ""}`,
  company: "/api/company",
  companyContractors: "/api/company/contractors",
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
  servicePartnerCompanies: "/api/service-partner-companies",
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

export function isNotFoundApiError(error: unknown) {
  return error instanceof ApiFetchError && error.status === 404
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

export async function invalidateInstallationCaches(installationId?: string) {
  await Promise.all([
    mutateGlobal(API_CACHE_KEYS.installations),
    mutateGlobal(API_CACHE_KEYS.installationsFilterSource),
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.actions),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
    mutateGlobal(API_CACHE_KEYS.properties),
    mutateGlobal(API_CACHE_KEYS.propertiesOverview),
    mutateGlobal(API_CACHE_KEYS.contractorsOverview),
    mutateGlobal(API_CACHE_KEYS.serviceDashboard),
    mutateGlobal(API_CACHE_KEYS.serviceTechnicians),
    mutateGlobal((key) =>
      typeof key === "string" && key.startsWith("/api/reports/fgas")
    ),
    mutateGlobal((key) =>
      typeof key === "string" &&
      key.startsWith("/api/reports/annual-fgas/history")
    ),
    installationId
      ? mutateGlobal(API_CACHE_KEYS.installationDetail(installationId))
      : Promise.resolve(),
    installationId
      ? mutateGlobal(API_CACHE_KEYS.installationEvents(installationId))
      : Promise.resolve(),
    installationId
      ? mutateGlobal(API_CACHE_KEYS.installationDocuments(installationId))
      : Promise.resolve(),
    installationId
      ? mutateGlobal(API_CACHE_KEYS.installationActivity(installationId))
      : Promise.resolve(),
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

export async function invalidateReportCaches(queryString?: string) {
  await Promise.all([
    queryString
      ? mutateGlobal(API_CACHE_KEYS.reportsFgas(queryString))
      : mutateGlobal((key) =>
          typeof key === "string" && key.startsWith("/api/reports/fgas")
        ),
    queryString
      ? mutateGlobal(API_CACHE_KEYS.reportsAnnualFgasHistory(queryString))
      : mutateGlobal((key) =>
          typeof key === "string" &&
          key.startsWith("/api/reports/annual-fgas/history")
        ),
    mutateGlobal(API_CACHE_KEYS.dashboard),
    mutateGlobal(API_CACHE_KEYS.dataQuality),
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
    mutateGlobal(API_CACHE_KEYS.actions),
    mutateGlobal(API_CACHE_KEYS.contractorsOverview),
    mutateGlobal(API_CACHE_KEYS.serviceDashboard),
    mutateGlobal(API_CACHE_KEYS.serviceTechnicians),
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
