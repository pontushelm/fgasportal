import type { DashboardAction, DashboardActionType } from "@/lib/actions/generate-actions"

export type ActionFilter =
  | "ALL"
  | "OVERDUE_INSPECTIONS"
  | "UPCOMING_INSPECTIONS"
  | "LEAKAGE"
  | "HIGH_RISK"
  | "NO_SERVICE_PARTNER"

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
