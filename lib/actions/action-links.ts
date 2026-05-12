import type { ActionDueDateFilter, ActionFilter } from "@/lib/actions/action-filters"

export type ActionQueueLinkParams = {
  filter?: ActionFilter
  due?: ActionDueDateFilter
  serviceContactId?: string | null
  servicePartnerCompanyId?: string | null
}

export function buildActionQueueUrl(
  appUrl: string,
  { due, filter, serviceContactId, servicePartnerCompanyId }: ActionQueueLinkParams = {}
) {
  const url = new URL("/dashboard/actions", normalizeAppUrl(appUrl))

  if (filter && filter !== "ALL") url.searchParams.set("filter", filter)
  if (due && due !== "ALL") url.searchParams.set("due", due)
  if (serviceContactId) url.searchParams.set("serviceContact", serviceContactId)
  if (servicePartnerCompanyId) {
    url.searchParams.set("servicePartnerCompany", servicePartnerCompanyId)
  }

  return url.toString()
}

export function getInspectionActionQueueUrl({
  appUrl,
  serviceContactId,
  servicePartnerCompanyId,
  status,
}: {
  appUrl: string
  serviceContactId?: string | null
  servicePartnerCompanyId?: string | null
  status: "DUE_SOON" | "OVERDUE"
}) {
  return buildActionQueueUrl(appUrl, {
    filter: status === "OVERDUE" ? "OVERDUE_INSPECTIONS" : "UPCOMING_INSPECTIONS",
    due: status === "OVERDUE" ? "OVERDUE" : "NEXT_30_DAYS",
    serviceContactId: servicePartnerCompanyId ? null : serviceContactId,
    servicePartnerCompanyId,
  })
}

export function getLeakageActionQueueUrl(appUrl: string) {
  return buildActionQueueUrl(appUrl, {
    filter: "LEAKAGE",
  })
}

export function getMissingServiceContactActionQueueUrl(appUrl: string) {
  return buildActionQueueUrl(appUrl, {
    filter: "NO_SERVICE_PARTNER",
  })
}

function normalizeAppUrl(appUrl: string) {
  return appUrl.endsWith("/") ? appUrl : `${appUrl}/`
}
