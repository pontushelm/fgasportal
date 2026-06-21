import type { ServicePartnerCompanyCertification } from "@/lib/service-partner-company-certifications"

export type ServicepartnerLifecycleStatus =
  | "ADDED"
  | "INVITED"
  | "INVITE_EXPIRED"
  | "ACCOUNT_CONNECTED"
  | "NEEDS_COMPLETION"
  | "READY"
  | "ACTIVE"
  | "NEEDS_ACTION"

export type ServicepartnerLifecycleSeverity =
  | "success"
  | "warning"
  | "danger"
  | "neutral"

export type ServicepartnerLifecycleChecklistItem = {
  key: string
  label: string
  completed: boolean
  severity: ServicepartnerLifecycleSeverity
  helperText: string
}

export type ServicepartnerLifecycle = {
  status: ServicepartnerLifecycleStatus
  label: string
  severity: ServicepartnerLifecycleSeverity
  nextStep: string
  checklist: ServicepartnerLifecycleChecklistItem[]
}

export type ServicepartnerLifecycleInput = {
  servicepartner: {
    contactEmail?: string | null
    name: string
    organizationNumber?: string | null
  }
  activeContractorMembershipsCount?: number
  activeServiceOrganizationMembershipsCount?: number
  activeServiceOrganizationAdminMembershipsCount?: number
  assignedInstallationsCount?: number
  certification?: ServicePartnerCompanyCertification | null
  certificateDocumentPresent?: boolean
  expiredInvitesCount?: number
  latestActivityDate?: Date | string | null
  pendingInvitesCount?: number
}

export function buildServicepartnerLifecycle({
  activeContractorMembershipsCount = 0,
  activeServiceOrganizationAdminMembershipsCount = 0,
  activeServiceOrganizationMembershipsCount = 0,
  assignedInstallationsCount = 0,
  certification,
  certificateDocumentPresent = false,
  expiredInvitesCount = 0,
  latestActivityDate = null,
  pendingInvitesCount = 0,
  servicepartner,
}: ServicepartnerLifecycleInput): ServicepartnerLifecycle {
  const hasConnectedAccount =
    activeContractorMembershipsCount > 0 ||
    activeServiceOrganizationMembershipsCount > 0
  const hasAdminAccount = activeServiceOrganizationAdminMembershipsCount > 0
  const hasActiveInvite = pendingInvitesCount > 0
  const hasExpiredInvite = expiredInvitesCount > 0
  const hasAssignments = assignedInstallationsCount > 0
  const hasCoreInfo = Boolean(servicepartner.name.trim() && servicepartner.contactEmail)
  const certificationStatus = certification?.status.status ?? "MISSING"
  const hasValidCertificate =
    certificationStatus === "VALID" || certificationStatus === "EXPIRING_SOON"
  const hasBlockingCertificateIssue =
    certificationStatus === "MISSING" ||
    certificationStatus === "EXPIRED" ||
    certificationStatus === "INACTIVE"

  const checklist = [
    checklistItem({
      completed: hasConnectedAccount,
      helperText: hasConnectedAccount
        ? "Minst ett servicepartnerkonto är kopplat."
        : "Bjud in serviceansvarig så att servicepartnern kan logga in.",
      key: "account",
      label: "Konto kopplat",
      severity: hasConnectedAccount ? "success" : "warning",
    }),
    checklistItem({
      completed: hasAdminAccount,
      helperText: hasAdminAccount
        ? "Servicepartnern har en serviceansvarig."
        : "Minst en serviceansvarig behövs för att hantera tekniker och certifikat.",
      key: "admin",
      label: "Serviceansvarig finns",
      severity: hasAdminAccount ? "success" : "warning",
    }),
    checklistItem({
      completed: hasValidCertificate,
      helperText: hasValidCertificate
        ? "Företagscertifikatet är registrerat."
        : "Servicepartnern behöver registrera ett giltigt företagscertifikat.",
      key: "company-certificate",
      label: "Företagscertifikat",
      severity: hasValidCertificate ? "success" : "danger",
    }),
    checklistItem({
      completed: certificateDocumentPresent,
      helperText: certificateDocumentPresent
        ? "Certifikatdokument finns uppladdat."
        : "Certifikatdokument saknas. Det är inte blockerande i v1, men stärker spårbarheten.",
      key: "certificate-document",
      label: "Certifikatdokument",
      severity: certificateDocumentPresent ? "success" : "neutral",
    }),
    checklistItem({
      completed: hasCoreInfo,
      helperText: hasCoreInfo
        ? "Grundläggande kontaktuppgifter finns."
        : "Komplettera kontaktuppgifter för servicepartnern.",
      key: "core-info",
      label: "Kontaktuppgifter",
      severity: hasCoreInfo ? "success" : "warning",
    }),
    checklistItem({
      completed: hasAssignments,
      helperText: hasAssignments
        ? `${assignedInstallationsCount} aggregat är tilldelade.`
        : "Tilldela aggregat när servicepartnern ska börja arbeta.",
      key: "assignments",
      label: "Aggregat tilldelade",
      severity: hasAssignments ? "success" : "neutral",
    }),
  ]

  if (latestActivityDate) {
    checklist.push(
      checklistItem({
        completed: true,
        helperText: "Servicepartnern har registrerad aktivitet i Polar.",
        key: "latest-activity",
        label: "Senaste aktivitet",
        severity: "success",
      })
    )
  }

  if (hasAssignments && !hasConnectedAccount) {
    return lifecycle({
      checklist,
      nextStep:
        "Aggregat är tilldelade, men servicepartnern saknar kopplat konto. Skicka eller förnya inbjudan.",
      status: "NEEDS_ACTION",
    })
  }

  if (!hasConnectedAccount && hasActiveInvite) {
    return lifecycle({
      checklist,
      nextStep: "Vänta på att servicepartnern accepterar inbjudan.",
      status: "INVITED",
    })
  }

  if (!hasConnectedAccount && hasExpiredInvite) {
    return lifecycle({
      checklist,
      nextStep: "Skicka en ny inbjudan till serviceansvarig.",
      status: "INVITE_EXPIRED",
    })
  }

  if (!hasConnectedAccount) {
    return lifecycle({
      checklist,
      nextStep: "Bjud in servicepartnerns serviceansvarig.",
      status: "ADDED",
    })
  }

  if (!hasAdminAccount) {
    return lifecycle({
      checklist,
      nextStep: "Utse eller bjud in en serviceansvarig för servicepartnern.",
      status: "ACCOUNT_CONNECTED",
    })
  }

  if (hasBlockingCertificateIssue || !hasCoreInfo) {
    return lifecycle({
      checklist,
      nextStep:
        "Be servicepartnern komplettera konto, kontaktuppgifter och certifiering.",
      status: "NEEDS_COMPLETION",
    })
  }

  if (hasAssignments || latestActivityDate) {
    return lifecycle({
      checklist,
      nextStep: "Följ upp servicepartnerns åtgärder och tilldelade aggregat.",
      status: "ACTIVE",
    })
  }

  return lifecycle({
    checklist,
    nextStep: "Tilldela aggregat när servicepartnern ska börja arbeta.",
    status: "READY",
  })
}

function checklistItem(
  item: ServicepartnerLifecycleChecklistItem
): ServicepartnerLifecycleChecklistItem {
  return item
}

function lifecycle({
  checklist,
  nextStep,
  status,
}: {
  checklist: ServicepartnerLifecycleChecklistItem[]
  nextStep: string
  status: ServicepartnerLifecycleStatus
}): ServicepartnerLifecycle {
  return {
    checklist,
    nextStep,
    status,
    ...STATUS_META[status],
  }
}

const STATUS_META: Record<
  ServicepartnerLifecycleStatus,
  { label: string; severity: ServicepartnerLifecycleSeverity }
> = {
  ACCOUNT_CONNECTED: {
    label: "Konto kopplat",
    severity: "neutral",
  },
  ACTIVE: {
    label: "I drift",
    severity: "success",
  },
  ADDED: {
    label: "Tillagd",
    severity: "neutral",
  },
  INVITED: {
    label: "Inbjuden",
    severity: "warning",
  },
  INVITE_EXPIRED: {
    label: "Inbjudan har gått ut",
    severity: "danger",
  },
  NEEDS_ACTION: {
    label: "Åtgärd krävs",
    severity: "danger",
  },
  NEEDS_COMPLETION: {
    label: "Komplettering krävs",
    severity: "warning",
  },
  READY: {
    label: "Redo att arbeta",
    severity: "success",
  },
}
