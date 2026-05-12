import type { DashboardAction, DashboardActionType } from "@/lib/actions/generate-actions"

export type ActionFilter =
  | "ALL"
  | "OVERDUE_INSPECTIONS"
  | "UPCOMING_INSPECTIONS"
  | "LEAKAGE"
  | "HIGH_RISK"
  | "NO_SERVICE_PARTNER"

export type ActionSeverityFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW"

export type ActionDueDateFilter =
  | "ALL"
  | "OVERDUE"
  | "NEXT_30_DAYS"
  | "NEXT_90_DAYS"
  | "NO_DUE_DATE"

export type ActionViewFilters = {
  category?: ActionFilter
  severity?: ActionSeverityFilter
  propertyId?: string
  serviceContactId?: string
  dueDate?: ActionDueDateFilter
  search?: string
  today?: Date
}

export type ActionSummaryCounts = {
  total: number
  highSeverity: number
  overdue: number
  dueSoon: number
  leakageFollowUp: number
  missingServiceContact: number
}

type FilterableAction = {
  type: DashboardActionType
  severity: DashboardAction["severity"]
  installationName: string
  equipmentId: string | null
  propertyId: string | null
  propertyName: string | null
  assignedServiceContactId: string | null
  title: string
  dueDate?: Date | string | null
}

type SummaryAction = {
  type: DashboardActionType
  severity: DashboardAction["severity"]
  dueDate?: Date | string | null
}

const ACTION_FILTER_TYPES: Record<Exclude<ActionFilter, "ALL">, DashboardActionType[]> = {
  OVERDUE_INSPECTIONS: ["OVERDUE_INSPECTION", "NOT_INSPECTED"],
  UPCOMING_INSPECTIONS: ["DUE_SOON_INSPECTION"],
  LEAKAGE: ["RECENT_LEAKAGE"],
  HIGH_RISK: ["HIGH_RISK"],
  NO_SERVICE_PARTNER: ["NO_SERVICE_PARTNER"],
}

export function filterDashboardActions<T extends Pick<DashboardAction, "type">>(
  actions: T[],
  filter: ActionFilter
) {
  if (filter === "ALL") return actions

  const allowedTypes = ACTION_FILTER_TYPES[filter]
  return actions.filter((action) => allowedTypes.includes(action.type))
}

export function filterActionWorkQueue<T extends FilterableAction>(
  actions: T[],
  filters: ActionViewFilters = {}
) {
  const today = startOfDay(filters.today ?? new Date())
  const normalizedSearch = normalizeSearch(filters.search)
  const propertyId = normalizeFilterValue(filters.propertyId)
  const serviceContactId = normalizeFilterValue(filters.serviceContactId)
  const category = filters.category ?? "ALL"
  const severity = filters.severity ?? "ALL"
  const dueDate = filters.dueDate ?? "ALL"

  return filterDashboardActions(actions, category).filter((action) => {
    if (severity !== "ALL" && action.severity !== severity) return false
    if (propertyId === "none" && action.propertyId) return false
    if (
      propertyId &&
      propertyId !== "none" &&
      normalizeFilterValue(action.propertyId) !== propertyId
    ) {
      return false
    }
    if (
      serviceContactId &&
      normalizeFilterValue(action.assignedServiceContactId) !== serviceContactId
    ) {
      return false
    }
    if (!matchesDueDateFilter(action.dueDate, dueDate, today)) return false

    if (normalizedSearch) {
      const searchableText = [
        action.installationName,
        action.equipmentId,
        action.propertyName,
        action.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      if (!searchableText.includes(normalizedSearch)) return false
    }

    return true
  })
}

export function getActionSummaryCounts<T extends SummaryAction>(
  actions: T[],
  today = new Date()
): ActionSummaryCounts {
  const currentDate = startOfDay(today)

  return actions.reduce<ActionSummaryCounts>(
    (summary, action) => {
      summary.total += 1
      if (action.severity === "HIGH") summary.highSeverity += 1
      if (isOverdue(action.dueDate, currentDate)) summary.overdue += 1
      if (isDueWithinDays(action.dueDate, 30, currentDate)) summary.dueSoon += 1
      if (action.type === "RECENT_LEAKAGE") summary.leakageFollowUp += 1
      if (action.type === "NO_SERVICE_PARTNER") summary.missingServiceContact += 1
      return summary
    },
    {
      total: 0,
      highSeverity: 0,
      overdue: 0,
      dueSoon: 0,
      leakageFollowUp: 0,
      missingServiceContact: 0,
    }
  )
}

export function getActionStableKey(
  action: Pick<DashboardAction, "id" | "type" | "installationId">
) {
  return `${action.type}:${action.installationId}:${action.id}`
}

function matchesDueDateFilter(
  dueDate: Date | string | null | undefined,
  filter: ActionDueDateFilter,
  today: Date
) {
  if (filter === "ALL") return true
  if (filter === "NO_DUE_DATE") return !dueDate
  if (filter === "OVERDUE") return isOverdue(dueDate, today)
  if (filter === "NEXT_30_DAYS") return isDueWithinDays(dueDate, 30, today)
  if (filter === "NEXT_90_DAYS") return isDueWithinDays(dueDate, 90, today)

  return true
}

function isOverdue(dueDate: Date | string | null | undefined, today: Date) {
  if (!dueDate) return false
  return startOfDay(new Date(dueDate)) < today
}

function isDueWithinDays(
  dueDate: Date | string | null | undefined,
  days: number,
  today: Date
) {
  if (!dueDate) return false
  const date = startOfDay(new Date(dueDate))
  const limit = addDays(today, days)
  return date >= today && date <= limit
}

function normalizeSearch(value?: string | null) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || ""
}

function normalizeFilterValue(value?: string | null) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || ""
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}
