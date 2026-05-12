import type { ActionDueDateFilter, ActionFilter } from "@/lib/actions/action-filters"

export type ActionQueueLinkParams = {
  filter?: ActionFilter
  due?: ActionDueDateFilter
  serviceContactId?: string | null
}

export function buildActionQueueUrl(
  appUrl: string,
  { due, filter, serviceContactId }: ActionQueueLinkParams = {}
) {
  const url = new URL("/dashboard/actions", normalizeAppUrl(appUrl))

  if (filter && filter !== "ALL") url.searchParams.set("filter", filter)
  if (due && due !== "ALL") url.searchParams.set("due", due)
  if (serviceContactId) url.searchParams.set("serviceContact", serviceContactId)

  return url.toString()
}

export function getInspectionActionQueueUrl({
  appUrl,
  serviceContactId,
  status,
}: {
  appUrl: string
  serviceContactId?: string | null
  status: "DUE_SOON" | "OVERDUE"
}) {
  return buildActionQueueUrl(appUrl, {
    filter: status === "OVERDUE" ? "OVERDUE_INSPECTIONS" : "UPCOMING_INSPECTIONS",
    due: status === "OVERDUE" ? "OVERDUE" : "NEXT_30_DAYS",
    serviceContactId,
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
