import type { ComplianceStatus } from "@/lib/fgas-calculations"
import {
  getRefrigerantRegulatoryStatus,
  isRefrigerantRegulatoryFollowUpStatus,
} from "@/lib/refrigerant-regulatory-status"
import type { InstallationRiskLevel } from "@/lib/risk-classification"
import type {
  ServicepartnerLifecycle,
  ServicepartnerLifecycleStatus,
} from "@/lib/servicepartner-lifecycle"

export type DashboardActionType =
  | "OVERDUE_INSPECTION"
  | "DUE_SOON_INSPECTION"
  | "NOT_INSPECTED"
  | "HIGH_RISK"
  | "NO_SERVICE_PARTNER"
  | "RECENT_LEAKAGE"
  | "REFRIGERANT_REVIEW"
  | "SERVICEPARTNER_CERTIFICATE_MISSING"
  | "SERVICEPARTNER_CERTIFICATE_EXPIRING"
  | "SERVICEPARTNER_CERTIFICATE_EXPIRED"
  | "TECHNICIAN_CERTIFICATE_MISSING"
  | "TECHNICIAN_CERTIFICATE_EXPIRING"
  | "TECHNICIAN_CERTIFICATE_EXPIRED"
  | "SERVICEPARTNER_INVITE_EXPIRED"
  | "SERVICEPARTNER_NO_CONNECTED_ACCOUNT"
  | "SERVICEPARTNER_NO_ADMIN"
  | "SERVICEPARTNER_NEEDS_COMPLETION"

export type DashboardActionSeverity = "HIGH" | "MEDIUM" | "LOW"

export type DashboardActionSource =
  | "inspection"
  | "risk"
  | "service_contact"
  | "leakage"
  | "refrigerant"
  | "certification"
  | "servicepartner"

export type DashboardAction = {
  id: string
  type: DashboardActionType
  severity: DashboardActionSeverity
  priority: DashboardActionSeverity
  title: string
  description: string
  installationId: string
  installationName: string
  equipmentId: string | null
  propertyId: string | null
  propertyName: string | null
  assignedServiceContactId: string | null
  assignedServiceContactName: string | null
  assignedServiceContactEmail: string | null
  servicePartnerCompanyId: string | null
  servicePartnerCompanyName: string | null
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
  equipmentId?: string | null
  propertyId?: string | null
  propertyName?: string | null
  nextInspection: Date | null
  inspectionInterval: number | null
  complianceStatus: ComplianceStatus
  refrigerantType?: string | null
  refrigerantAmount?: number | null
  assignedContractorId: string | null
  assignedServiceContactId?: string | null
  assignedServiceContactName?: string | null
  assignedServiceContactEmail?: string | null
  servicePartnerCompanyId?: string | null
  servicePartnerCompanyName?: string | null
  risk: { level: InstallationRiskLevel; score: number }
}

export type ActionLeakageEventInput = {
  id: string
  installationId: string
  installationName: string
  equipmentId?: string | null
  propertyId?: string | null
  propertyName?: string | null
  assignedServiceContactId?: string | null
  assignedServiceContactName?: string | null
  assignedServiceContactEmail?: string | null
  servicePartnerCompanyId?: string | null
  servicePartnerCompanyName?: string | null
  date: Date
}

export type ActionServicePartnerCertificationInput = {
  id: string
  name: string
  certificateNumber?: string | null
  issuer?: string | null
  validUntil?: Date | string | null
}

export type ActionTechnicianCertificationInput = {
  id: string
  name: string
  email?: string | null
  certificateNumber?: string | null
  issuer?: string | null
  validUntil?: Date | string | null
  servicePartnerCompanyId?: string | null
  servicePartnerCompanyName?: string | null
  href?: string | null
}

export type ActionServicePartnerLifecycleInput = {
  id: string
  name: string
  lifecycle: ServicepartnerLifecycle
}

const RECENT_LEAKAGE_DAYS = 30
const SERVICEPARTNER_CERTIFICATE_EXPIRING_DAYS = 90

const SEVERITY_ORDER: Record<DashboardActionSeverity, number> = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const TYPE_ORDER: Record<DashboardActionType, number> = {
  OVERDUE_INSPECTION: 1,
  SERVICEPARTNER_CERTIFICATE_EXPIRED: 2,
  TECHNICIAN_CERTIFICATE_EXPIRED: 3,
  SERVICEPARTNER_CERTIFICATE_MISSING: 4,
  TECHNICIAN_CERTIFICATE_MISSING: 5,
  NOT_INSPECTED: 6,
  RECENT_LEAKAGE: 7,
  HIGH_RISK: 8,
  DUE_SOON_INSPECTION: 9,
  SERVICEPARTNER_CERTIFICATE_EXPIRING: 10,
  TECHNICIAN_CERTIFICATE_EXPIRING: 11,
  SERVICEPARTNER_INVITE_EXPIRED: 12,
  SERVICEPARTNER_NO_CONNECTED_ACCOUNT: 13,
  SERVICEPARTNER_NO_ADMIN: 14,
  SERVICEPARTNER_NEEDS_COMPLETION: 15,
  NO_SERVICE_PARTNER: 16,
  REFRIGERANT_REVIEW: 17,
}

export function generateDashboardActions({
  installations,
  leakageEvents,
  servicePartnerLifecycles = [],
  servicePartnerCompanies = [],
  technicians = [],
  today = new Date(),
}: {
  installations: ActionInstallationInput[]
  leakageEvents: ActionLeakageEventInput[]
  servicePartnerLifecycles?: ActionServicePartnerLifecycleInput[]
  servicePartnerCompanies?: ActionServicePartnerCertificationInput[]
  technicians?: ActionTechnicianCertificationInput[]
  today?: Date
}): DashboardAction[] {
  const actions: DashboardAction[] = []
  const recentLeakageThreshold = addDays(startOfDay(today), -RECENT_LEAKAGE_DAYS)
  const expiringCertificateThreshold = addDays(
    startOfDay(today),
    SERVICEPARTNER_CERTIFICATE_EXPIRING_DAYS
  )

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
          title: "Risk att följa upp",
          description: `${installation.name} har hög riskklassning och bör bevakas i planering och uppföljning`,
          installation,
          href,
          createdFrom: "risk",
        })
      )
    }

    if (installation.inspectionInterval && !installation.servicePartnerCompanyId) {
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

    const refrigerantStatus = getRefrigerantRegulatoryStatus({
      refrigerantType: installation.refrigerantType,
      refrigerantAmountKg: installation.refrigerantAmount,
    })
    if (
      installation.propertyId &&
      isRefrigerantRegulatoryFollowUpStatus(refrigerantStatus.status)
    ) {
      actions.push(
        createAction({
          type: "REFRIGERANT_REVIEW",
          severity: "LOW",
          title:
            refrigerantStatus.actionTitle ??
            "Kontrollera framtida krav för köldmedium",
          description:
            refrigerantStatus.actionDescription ??
            `${installation.name}: ${refrigerantStatus.label}`,
          installation,
          href,
          createdFrom: "refrigerant",
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
      title: "Följ upp registrerat läckage",
      description: `${event.installationName} har ett läckage registrerat ${formatDate(event.date)}. Kontrollera åtgärd och dokumentation.`,
      installationId: event.installationId,
      installationName: event.installationName,
      equipmentId: event.equipmentId ?? null,
      propertyId: event.propertyId ?? null,
      propertyName: event.propertyName ?? null,
      assignedServiceContactId: event.assignedServiceContactId ?? null,
      assignedServiceContactName: event.assignedServiceContactName ?? null,
      assignedServiceContactEmail: event.assignedServiceContactEmail ?? null,
      servicePartnerCompanyId: event.servicePartnerCompanyId ?? null,
      servicePartnerCompanyName: event.servicePartnerCompanyName ?? null,
      href: `/dashboard/installations/${event.installationId}`,
      dueDate: null,
      createdAt: event.date,
      createdFrom: "leakage",
      source: "leakage",
      sortPriority: getSortPriority("RECENT_LEAKAGE", "HIGH"),
    })
  })

  servicePartnerCompanies.forEach((servicePartnerCompany) => {
    const validUntil = parseOptionalDate(servicePartnerCompany.validUntil)
    const certificateNumber = servicePartnerCompany.certificateNumber?.trim() || null

    if (!certificateNumber || !validUntil) {
      actions.push(
        createServicePartnerCertificationAction({
          servicePartnerCompany,
          type: "SERVICEPARTNER_CERTIFICATE_MISSING",
          severity: "HIGH",
          title: "Servicepartner saknar giltigt företagscertifikat",
          description: buildServicePartnerCertificateDescription({
            certificateNumber,
            intro: `${servicePartnerCompany.name} saknar ett registrerat giltigt företagscertifikat.`,
            validUntil,
          }),
          dueDate: validUntil,
          today,
        })
      )
      return
    }

    const validUntilStart = startOfDay(validUntil)
    const todayStart = startOfDay(today)

    if (validUntilStart < todayStart) {
      actions.push(
        createServicePartnerCertificationAction({
          servicePartnerCompany,
          type: "SERVICEPARTNER_CERTIFICATE_EXPIRED",
          severity: "HIGH",
          title: "Servicepartners företagscertifikat har gått ut",
          description: buildServicePartnerCertificateDescription({
            certificateNumber,
            intro: `${servicePartnerCompany.name} har ett företagscertifikat som gick ut ${formatDate(validUntil)}.`,
            validUntil,
          }),
          dueDate: validUntil,
          today,
        })
      )
      return
    }

    if (validUntilStart <= expiringCertificateThreshold) {
      actions.push(
        createServicePartnerCertificationAction({
          servicePartnerCompany,
          type: "SERVICEPARTNER_CERTIFICATE_EXPIRING",
          severity: "MEDIUM",
          title: "Servicepartners företagscertifikat går snart ut",
          description: buildServicePartnerCertificateDescription({
            certificateNumber,
            intro: `${servicePartnerCompany.name} har ett företagscertifikat som går ut ${formatDate(validUntil)}.`,
            validUntil,
          }),
          dueDate: validUntil,
          today,
        })
      )
    }
  })

  technicians.forEach((technician) => {
    const validUntil = parseOptionalDate(technician.validUntil)
    const certificateNumber = technician.certificateNumber?.trim() || null

    if (!certificateNumber || !validUntil) {
      actions.push(
        createTechnicianCertificationAction({
          technician,
          type: "TECHNICIAN_CERTIFICATE_MISSING",
          severity: "HIGH",
          title: "Tekniker saknar personcertifikat",
          description: buildTechnicianCertificateDescription({
            certificateNumber,
            intro: `${technician.name} saknar ett registrerat giltigt personligt F-gascertifikat.`,
            validUntil,
          }),
          dueDate: validUntil,
        })
      )
      return
    }

    const validUntilStart = startOfDay(validUntil)
    const todayStart = startOfDay(today)

    if (validUntilStart < todayStart) {
      actions.push(
        createTechnicianCertificationAction({
          technician,
          type: "TECHNICIAN_CERTIFICATE_EXPIRED",
          severity: "HIGH",
          title: "Teknikers personcertifikat har gått ut",
          description: buildTechnicianCertificateDescription({
            certificateNumber,
            intro: `${technician.name} har ett personligt F-gascertifikat som gick ut ${formatDate(validUntil)}.`,
            validUntil,
          }),
          dueDate: validUntil,
        })
      )
      return
    }

    if (validUntilStart <= expiringCertificateThreshold) {
      actions.push(
        createTechnicianCertificationAction({
          technician,
          type: "TECHNICIAN_CERTIFICATE_EXPIRING",
          severity: "MEDIUM",
          title: "Teknikers personcertifikat går snart ut",
          description: buildTechnicianCertificateDescription({
            certificateNumber,
            intro: `${technician.name} har ett personligt F-gascertifikat som går ut ${formatDate(validUntil)}.`,
            validUntil,
          }),
          dueDate: validUntil,
        })
      )
    }
  })

  servicePartnerLifecycles.forEach((servicePartner) => {
    const actionMeta = getServicePartnerLifecycleActionMeta(
      servicePartner.lifecycle.status
    )
    if (!actionMeta) return

    actions.push(
      createServicePartnerLifecycleAction({
        description: buildServicePartnerLifecycleDescription({
          lifecycle: servicePartner.lifecycle,
          servicePartnerName: servicePartner.name,
        }),
        servicePartner,
        ...actionMeta,
      })
    )
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
    equipmentId: installation.equipmentId ?? null,
    propertyId: installation.propertyId ?? null,
    propertyName: installation.propertyName ?? null,
    assignedServiceContactId: installation.assignedServiceContactId ?? null,
    assignedServiceContactName: installation.assignedServiceContactName ?? null,
    assignedServiceContactEmail: installation.assignedServiceContactEmail ?? null,
    servicePartnerCompanyId: installation.servicePartnerCompanyId ?? null,
    servicePartnerCompanyName: installation.servicePartnerCompanyName ?? null,
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
  if (type === "REFRIGERANT_REVIEW") return `refrigerant-review-${installationId}`
  return `${type.toLowerCase()}-${installationId}`
}

function createServicePartnerCertificationAction({
  description,
  dueDate,
  servicePartnerCompany,
  severity,
  title,
  type,
}: {
  description: string
  dueDate: Date | null
  servicePartnerCompany: ActionServicePartnerCertificationInput
  severity: DashboardActionSeverity
  title: string
  type:
    | "SERVICEPARTNER_CERTIFICATE_MISSING"
    | "SERVICEPARTNER_CERTIFICATE_EXPIRING"
    | "SERVICEPARTNER_CERTIFICATE_EXPIRED"
  today: Date
}): DashboardAction {
  return {
    id: getServicePartnerCertificationActionId(type, servicePartnerCompany.id),
    type,
    severity,
    priority: severity,
    title,
    description,
    installationId: `servicepartner-${servicePartnerCompany.id}`,
    installationName: servicePartnerCompany.name,
    equipmentId: servicePartnerCompany.certificateNumber ?? null,
    propertyId: null,
    propertyName: null,
    assignedServiceContactId: null,
    assignedServiceContactName: null,
    assignedServiceContactEmail: null,
    servicePartnerCompanyId: servicePartnerCompany.id,
    servicePartnerCompanyName: servicePartnerCompany.name,
    href: `/dashboard/contractors/companies/${servicePartnerCompany.id}`,
    dueDate,
    createdAt: null,
    createdFrom: "certification",
    source: "certification",
    sortPriority: getSortPriority(type, severity),
  }
}

function getServicePartnerCertificationActionId(
  type: DashboardActionType,
  servicePartnerCompanyId: string
) {
  if (type === "SERVICEPARTNER_CERTIFICATE_MISSING") {
    return `servicepartner-certificate-missing-${servicePartnerCompanyId}`
  }
  if (type === "SERVICEPARTNER_CERTIFICATE_EXPIRING") {
    return `servicepartner-certificate-expiring-${servicePartnerCompanyId}`
  }
  if (type === "SERVICEPARTNER_CERTIFICATE_EXPIRED") {
    return `servicepartner-certificate-expired-${servicePartnerCompanyId}`
  }
  return `servicepartner-certificate-${servicePartnerCompanyId}`
}

function createTechnicianCertificationAction({
  description,
  dueDate,
  severity,
  technician,
  title,
  type,
}: {
  description: string
  dueDate: Date | null
  severity: DashboardActionSeverity
  technician: ActionTechnicianCertificationInput
  title: string
  type:
    | "TECHNICIAN_CERTIFICATE_MISSING"
    | "TECHNICIAN_CERTIFICATE_EXPIRING"
    | "TECHNICIAN_CERTIFICATE_EXPIRED"
}): DashboardAction {
  return {
    id: getTechnicianCertificationActionId(type, technician.id),
    type,
    severity,
    priority: severity,
    title,
    description,
    installationId: `technician-${technician.id}`,
    installationName: technician.name,
    equipmentId: technician.certificateNumber ?? null,
    propertyId: null,
    propertyName: null,
    assignedServiceContactId: technician.id,
    assignedServiceContactName: technician.name,
    assignedServiceContactEmail: technician.email ?? null,
    servicePartnerCompanyId: technician.servicePartnerCompanyId ?? null,
    servicePartnerCompanyName: technician.servicePartnerCompanyName ?? null,
    href: technician.href ?? "/dashboard/service",
    dueDate,
    createdAt: null,
    createdFrom: "certification",
    source: "certification",
    sortPriority: getSortPriority(type, severity),
  }
}

function getTechnicianCertificationActionId(
  type: DashboardActionType,
  technicianId: string
) {
  if (type === "TECHNICIAN_CERTIFICATE_MISSING") {
    return `technician-certificate-missing-${technicianId}`
  }
  if (type === "TECHNICIAN_CERTIFICATE_EXPIRING") {
    return `technician-certificate-expiring-${technicianId}`
  }
  if (type === "TECHNICIAN_CERTIFICATE_EXPIRED") {
    return `technician-certificate-expired-${technicianId}`
  }
  return `technician-certificate-${technicianId}`
}

function createServicePartnerLifecycleAction({
  description,
  servicePartner,
  severity,
  title,
  type,
}: {
  description: string
  servicePartner: ActionServicePartnerLifecycleInput
  severity: DashboardActionSeverity
  title: string
  type:
    | "SERVICEPARTNER_INVITE_EXPIRED"
    | "SERVICEPARTNER_NO_CONNECTED_ACCOUNT"
    | "SERVICEPARTNER_NO_ADMIN"
    | "SERVICEPARTNER_NEEDS_COMPLETION"
}): DashboardAction {
  return {
    id: getServicePartnerLifecycleActionId(type, servicePartner.id),
    type,
    severity,
    priority: severity,
    title,
    description,
    installationId: `servicepartner-lifecycle-${servicePartner.id}`,
    installationName: servicePartner.name,
    equipmentId: null,
    propertyId: null,
    propertyName: null,
    assignedServiceContactId: null,
    assignedServiceContactName: null,
    assignedServiceContactEmail: null,
    servicePartnerCompanyId: servicePartner.id,
    servicePartnerCompanyName: servicePartner.name,
    href: `/dashboard/contractors/companies/${servicePartner.id}`,
    dueDate: null,
    createdAt: null,
    createdFrom: "servicepartner",
    source: "servicepartner",
    sortPriority: getSortPriority(type, severity),
  }
}

function getServicePartnerLifecycleActionMeta(
  status: ServicepartnerLifecycleStatus
):
  | {
      severity: DashboardActionSeverity
      title: string
      type:
        | "SERVICEPARTNER_INVITE_EXPIRED"
        | "SERVICEPARTNER_NO_CONNECTED_ACCOUNT"
        | "SERVICEPARTNER_NO_ADMIN"
        | "SERVICEPARTNER_NEEDS_COMPLETION"
    }
  | null {
  if (status === "INVITE_EXPIRED") {
    return {
      severity: "HIGH",
      title: "Servicepartnerinbjudan har gått ut",
      type: "SERVICEPARTNER_INVITE_EXPIRED",
    }
  }

  if (status === "NEEDS_ACTION") {
    return {
      severity: "HIGH",
      title: "Servicepartner saknar kopplat konto",
      type: "SERVICEPARTNER_NO_CONNECTED_ACCOUNT",
    }
  }

  if (status === "ACCOUNT_CONNECTED") {
    return {
      severity: "MEDIUM",
      title: "Servicepartner saknar serviceansvarig",
      type: "SERVICEPARTNER_NO_ADMIN",
    }
  }

  if (status === "NEEDS_COMPLETION") {
    return {
      severity: "MEDIUM",
      title: "Servicepartner behöver kompletteras",
      type: "SERVICEPARTNER_NEEDS_COMPLETION",
    }
  }

  return null
}

function getServicePartnerLifecycleActionId(
  type: DashboardActionType,
  servicePartnerCompanyId: string
) {
  if (type === "SERVICEPARTNER_INVITE_EXPIRED") {
    return `servicepartner-invite-expired-${servicePartnerCompanyId}`
  }
  if (type === "SERVICEPARTNER_NO_CONNECTED_ACCOUNT") {
    return `servicepartner-no-connected-account-${servicePartnerCompanyId}`
  }
  if (type === "SERVICEPARTNER_NO_ADMIN") {
    return `servicepartner-no-admin-${servicePartnerCompanyId}`
  }
  if (type === "SERVICEPARTNER_NEEDS_COMPLETION") {
    return `servicepartner-needs-completion-${servicePartnerCompanyId}`
  }
  return `servicepartner-lifecycle-${servicePartnerCompanyId}`
}

function buildServicePartnerLifecycleDescription({
  lifecycle,
  servicePartnerName,
}: {
  lifecycle: ServicepartnerLifecycle
  servicePartnerName: string
}) {
  return `${servicePartnerName}: ${lifecycle.nextStep}`
}

function buildServicePartnerCertificateDescription({
  certificateNumber,
  intro,
  validUntil,
}: {
  certificateNumber: string | null
  intro: string
  validUntil: Date | null
}) {
  const details = [
    certificateNumber ? `Certifikat: ${certificateNumber}.` : null,
    validUntil ? `Giltigt till: ${formatDate(validUntil)}.` : null,
    "Kontrollera certifieringen med servicepartnern och be dem uppdatera uppgifterna i FgasPortal.",
  ]
    .filter(Boolean)
    .join(" ")

  return `${intro} ${details}`
}

function buildTechnicianCertificateDescription({
  certificateNumber,
  intro,
  validUntil,
}: {
  certificateNumber: string | null
  intro: string
  validUntil: Date | null
}) {
  const details = [
    certificateNumber ? `Certifikat: ${certificateNumber}.` : null,
    validUntil ? `Giltigt till: ${formatDate(validUntil)}.` : "Giltighet saknas.",
    "Uppdatera personcertifikatet i FgasPortal.",
  ]
    .filter(Boolean)
    .join(" ")

  return `${intro} ${details}`
}

function parseOptionalDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
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
