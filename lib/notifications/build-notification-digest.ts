import type {
  DashboardAction,
  DashboardActionSeverity,
  DashboardActionType,
} from "@/lib/actions/generate-actions"

export type NotificationDigestGroupId = "inspections" | "certificates" | "reports"

export type NotificationDigestItem = {
  id: string
  label: string
  count: number
  severity: DashboardActionSeverity
  href: string
}

export type NotificationDigestGroup = {
  id: NotificationDigestGroupId
  title: string
  description: string
  items: NotificationDigestItem[]
  count: number
  severity: DashboardActionSeverity | null
}

export type NotificationDigest = {
  inspections: NotificationDigestGroup
  certificates: NotificationDigestGroup
  reports: NotificationDigestGroup
  totalItems: number
}

type BuildNotificationDigestInput = {
  actions: DashboardAction[]
  enabled?: {
    certificates?: boolean
    inspections?: boolean
    reports?: boolean
  }
  today?: Date
}

const SEVERITY_ORDER: Record<DashboardActionSeverity, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const INSPECTION_ACTIONS: Partial<Record<DashboardActionType, string>> = {
  DUE_SOON_INSPECTION: "Kontroller inom 30 dagar",
  OVERDUE_INSPECTION: "Försenade kontroller",
}

const CERTIFICATE_ACTIONS: Partial<Record<DashboardActionType, string>> = {
  SERVICEPARTNER_CERTIFICATE_EXPIRED: "Servicepartnercertifikat har gått ut",
  SERVICEPARTNER_CERTIFICATE_EXPIRING: "Servicepartnercertifikat går snart ut",
  TECHNICIAN_CERTIFICATE_EXPIRED: "Teknikercertifikat har gått ut",
  TECHNICIAN_CERTIFICATE_EXPIRING: "Teknikercertifikat går snart ut",
}

export function buildNotificationDigest({
  actions,
  enabled = {},
  today = new Date(),
}: BuildNotificationDigestInput): NotificationDigest {
  const inspections =
    enabled.inspections === false
      ? emptyGroup("inspections", "Kontroller", "Kontroller som behöver planeras eller följas upp.")
      : buildActionGroup({
          actionLabels: INSPECTION_ACTIONS,
          actions,
          description: "Kontroller som behöver planeras eller följas upp.",
          id: "inspections",
          title: "Kontroller",
        })
  const certificates =
    enabled.certificates === false
      ? emptyGroup("certificates", "Certifikat", "Certifikat som har gått ut eller behöver förnyas snart.")
      : buildActionGroup({
          actionLabels: CERTIFICATE_ACTIONS,
          actions,
          description: "Certifikat som har gått ut eller behöver förnyas snart.",
          id: "certificates",
          title: "Certifikat",
        })
  const reports =
    enabled.reports === false
      ? emptyGroup("reports", "Årsrapporter", "Påminnelser kopplade till årsrapportering.")
      : buildReportGroup(today)

  return {
    inspections,
    certificates,
    reports,
    totalItems: inspections.count + certificates.count + reports.count,
  }
}

function emptyGroup(
  id: NotificationDigestGroupId,
  title: string,
  description: string
): NotificationDigestGroup {
  return {
    id,
    title,
    description,
    items: [],
    count: 0,
    severity: null,
  }
}

function buildActionGroup({
  actionLabels,
  actions,
  description,
  id,
  title,
}: {
  actionLabels: Partial<Record<DashboardActionType, string>>
  actions: DashboardAction[]
  description: string
  id: NotificationDigestGroupId
  title: string
}): NotificationDigestGroup {
  const items = Object.entries(actionLabels)
    .map(([type, label]) => {
      const matchingActions = actions.filter((action) => action.type === type)
      if (matchingActions.length === 0) return null

      return {
        id: type,
        label,
        count: matchingActions.length,
        severity:
          highestSeverity(matchingActions.map((action) => action.severity)) ??
          matchingActions[0].severity,
        href: `/dashboard/actions?type=${type}`,
      } satisfies NotificationDigestItem
    })
    .filter((item): item is NotificationDigestItem => Boolean(item))

  return {
    id,
    title,
    description,
    items,
    count: items.reduce((sum, item) => sum + item.count, 0),
    severity: highestSeverity(items.map((item) => item.severity)),
  }
}

function buildReportGroup(today: Date): NotificationDigestGroup {
  const year = today.getFullYear()
  const month = today.getMonth()
  const items: NotificationDigestItem[] = []

  if (month >= 0 && month <= 2) {
    items.push({
      id: "annual-report-season",
      label: `Årsrapportering ${year} närmar sig`,
      count: 1,
      severity: "MEDIUM",
      href: "/dashboard/reports?type=annual",
    })
  } else if (month >= 3) {
    items.push({
      id: "annual-report-overdue",
      label: `Kontrollera om årsrapport ${year - 1} är färdig`,
      count: 1,
      severity: "HIGH",
      href: "/dashboard/reports?type=annual",
    })
  }

  return {
    id: "reports",
    title: "Årsrapporter",
    description: "Påminnelser kopplade till årsrapportering.",
    items,
    count: items.reduce((sum, item) => sum + item.count, 0),
    severity: highestSeverity(items.map((item) => item.severity)),
  }
}

function highestSeverity(
  severities: Array<DashboardActionSeverity | null>
): DashboardActionSeverity | null {
  const availableSeverities = severities.filter(
    (severity): severity is DashboardActionSeverity => Boolean(severity)
  )
  return (
    availableSeverities.sort(
      (first, second) => SEVERITY_ORDER[first] - SEVERITY_ORDER[second]
    )[0] ?? null
  )
}
