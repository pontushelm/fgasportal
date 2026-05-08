import type { ComplianceStatus } from "@/lib/fgas-calculations"
import type { InstallationRiskLevel } from "@/lib/risk-classification"

export type DashboardActionType =
  | "OVERDUE_INSPECTION"
  | "DUE_SOON_INSPECTION"
  | "NOT_INSPECTED"
  | "HIGH_RISK"
  | "NO_SERVICE_PARTNER"
  | "RECENT_LEAKAGE"

export type DashboardActionSeverity = "HIGH" | "MEDIUM" | "LOW"

export type DashboardActionSource =
  | "inspection"
  | "risk"
  | "service_contact"
  | "leakage"

export type DashboardAction = {
  id: string
  type: DashboardActionType
  severity: DashboardActionSeverity
  priority: DashboardActionSeverity
  title: string
  description: string
  installationId: string
  installationName: string
  propertyName: string | null
  href: string
  dueDate: Date | null
  createdAt: Date | null
  createdFrom: DashboardActionSource
  source: DashboardActionSource
  sortPriority: number
}

export type ActionInstallationInput = {
  id: string
  name: string
  propertyName?: string | null
  nextInspection: Date | null
  inspectionInterval: number | null
  complianceStatus: ComplianceStatus
  assignedContractorId: string | null
  risk: { level: InstallationRiskLevel; score: number }
}

export type ActionLeakageEventInput = {
  id: string
  installationId: string
  installationName: string
  propertyName?: string | null
  date: Date
}

const RECENT_LEAKAGE_DAYS = 30

const SEVERITY_ORDER: Record<DashboardActionSeverity, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const TYPE_ORDER: Record<DashboardActionType, number> = {
  OVERDUE_INSPECTION: 1,
  NOT_INSPECTED: 2,
  RECENT_LEAKAGE: 3,
  HIGH_RISK: 4,
  DUE_SOON_INSPECTION: 5,
  NO_SERVICE_PARTNER: 6,
}

export function generateDashboardActions({
  installations,
  leakageEvents,
  today = new Date(),
}: {
  installations: ActionInstallationInput[]
  leakageEvents: ActionLeakageEventInput[]
  today?: Date
}): DashboardAction[] {
  const actions: DashboardAction[] = []
  const recentLeakageThreshold = addDays(startOfDay(today), -RECENT_LEAKAGE_DAYS)

  installations.forEach((installation) => {
    const href = `/dashboard/installations/${installation.id}`

    if (installation.complianceStatus === "OVERDUE" && installation.nextInspection) {
      actions.push(
        createAction({
          type: "OVERDUE_INSPECTION",
          severity: "HIGH",
          title: "Försenad kontroll",
          description: `${installation.name} skulle ha kontrollerats ${formatDate(installation.nextInspection)}`,
          installation,
          href,
          dueDate: installation.nextInspection,
          createdFrom: "inspection",
        })
      )
    }

    if (installation.complianceStatus === "DUE_SOON" && installation.nextInspection) {
      actions.push(
        createAction({
          type: "DUE_SOON_INSPECTION",
          severity: "MEDIUM",
          title: "Kontroll inom 30 dagar",
          description: `${installation.name} ska kontrolleras ${formatDate(installation.nextInspection)}`,
          installation,
          href,
          dueDate: installation.nextInspection,
          createdFrom: "inspection",
        })
      )
    }

    if (installation.complianceStatus === "NOT_INSPECTED") {
      actions.push(
        createAction({
          type: "NOT_INSPECTED",
          severity: installation.inspectionInterval ? "HIGH" : "LOW",
          title: "Aggregat saknar kontroll",
          description: `${installation.name} saknar registrerad kontroll`,
          installation,
          href,
          createdFrom: "inspection",
        })
      )
    }

    if (installation.risk.level === "HIGH") {
      actions.push(
        createAction({
          type: "HIGH_RISK",
          severity: "HIGH",
          title: "Aggregat med hög risk",
          description: `${installation.name} har hög klimat- eller compliance-risk`,
          installation,
          href,
          createdFrom: "risk",
        })
      )
    }

    if (installation.inspectionInterval && !installation.assignedContractorId) {
      actions.push(
        createAction({
          type: "NO_SERVICE_PARTNER",
          severity: "MEDIUM",
          title: "Servicepartner saknas",
          description: `${installation.name} saknar tilldelad servicepartner`,
          installation,
          href,
          createdFrom: "service_contact",
        })
      )
    }
  })

  leakageEvents.forEach((event) => {
    const eventDate = startOfDay(event.date)
    if (eventDate < recentLeakageThreshold) return

    actions.push({
      id: `recent-leakage-${event.id}`,
      type: "RECENT_LEAKAGE",
      severity: "HIGH",
      priority: "HIGH",
      title: "Nyligt läckage registrerat",
      description: `${event.installationName} har läckage registrerat ${formatDate(event.date)}`,
      installationId: event.installationId,
      installationName: event.installationName,
      propertyName: event.propertyName ?? null,
      href: `/dashboard/installations/${event.installationId}`,
      dueDate: null,
      createdAt: event.date,
      createdFrom: "leakage",
      source: "leakage",
      sortPriority: getSortPriority("RECENT_LEAKAGE", "HIGH"),
    })
  })

  return sortDashboardActions(actions)
}

export function sortDashboardActions(actions: DashboardAction[]) {
  return [...actions].sort(compareDashboardActions)
}

export function compareDashboardActions(first: DashboardAction, second: DashboardAction) {
  const priorityDiff = first.sortPriority - second.sortPriority
  if (priorityDiff !== 0) return priorityDiff

  if (first.type === "RECENT_LEAKAGE" && second.type === "RECENT_LEAKAGE") {
    return compareOptionalDatesDesc(first.createdAt, second.createdAt)
  }

  return compareOptionalDates(first.dueDate ?? first.createdAt, second.dueDate ?? second.createdAt)
}

function createAction({
  type,
  severity,
  title,
  description,
  installation,
  href,
  dueDate = null,
  createdAt = null,
  createdFrom,
}: {
  type: DashboardActionType
  severity: DashboardActionSeverity
  title: string
  description: string
  installation: ActionInstallationInput
  href: string
  dueDate?: Date | null
  createdAt?: Date | null
  createdFrom: DashboardActionSource
}): DashboardAction {
  return {
    id: getActionId(type, installation.id),
    type,
    severity,
    priority: severity,
    title,
    description,
    installationId: installation.id,
    installationName: installation.name,
    propertyName: installation.propertyName ?? null,
    href,
    dueDate,
    createdAt,
    createdFrom,
    source: createdFrom,
    sortPriority: getSortPriority(type, severity),
  }
}

function getActionId(type: DashboardActionType, installationId: string) {
  if (type === "OVERDUE_INSPECTION") return `overdue-${installationId}`
  if (type === "DUE_SOON_INSPECTION") return `due-soon-${installationId}`
  if (type === "NOT_INSPECTED") return `not-inspected-${installationId}`
  if (type === "HIGH_RISK") return `high-risk-${installationId}`
  if (type === "NO_SERVICE_PARTNER") return `no-service-partner-${installationId}`
  return `${type.toLowerCase()}-${installationId}`
}

function getSortPriority(
  type: DashboardActionType,
  severity: DashboardActionSeverity
) {
  return SEVERITY_ORDER[severity] * 100 + TYPE_ORDER[type]
}

function compareOptionalDates(firstDate?: Date | null, secondDate?: Date | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return firstDate.getTime() - secondDate.getTime()
}

function compareOptionalDatesDesc(firstDate?: Date | null, secondDate?: Date | null) {
  if (!firstDate && !secondDate) return 0
  if (!firstDate) return 1
  if (!secondDate) return -1

  return secondDate.getTime() - firstDate.getTime()
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sv-SE").format(value)
}
