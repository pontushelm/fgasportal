import type { NotificationDigestType, PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/auth"
import { loadDashboardActions } from "@/lib/actions/load-dashboard-actions"
import { buildNotificationDigest } from "@/lib/notifications/build-notification-digest"
import { shouldSendDigest } from "@/lib/notifications/digest-log"

export type NotificationDigestRunnerClient = {
  company: Pick<PrismaClient["company"], "findMany">
  notificationDigestLog: Pick<PrismaClient["notificationDigestLog"], "findUnique">
}

export type NotificationDigestDecision =
  | "WOULD_SEND"
  | "SKIP_NO_ITEMS"
  | "SKIP_ALREADY_SENT"
  | "SKIP_DISABLED"

export type NotificationDigestDryRunRecipientResult = {
  companyId: string
  decision: NotificationDigestDecision
  email: string
  totalItems: number
  userId: string
}

export type NotificationDigestDryRunResult = {
  companiesChecked: number
  digestDate: string
  digestType: NotificationDigestType
  eligibleRecipients: number
  recipientsChecked: number
  results: NotificationDigestDryRunRecipientResult[]
  skippedAlreadySent: number
  skippedDisabled: number
  skippedNoItems: number
}

type DigestCompany = {
  id: string
  sendAnnualReportReminders: boolean
  sendCertificateReminders: boolean
  sendInspectionRemindersToContractors: boolean
  users: DigestUser[]
}

type DigestUser = {
  id: string
  email: string
  memberships: Array<{
    companyId: string
    id: string
    isServicePartnerAdmin: boolean
    role: UserRole
    servicePartnerCompany: {
      serviceOrganizationId: string | null
    } | null
    servicePartnerCompanyId: string | null
  }>
  notifyAnnualReportDeadlineEmails: boolean
  notifyInspectionReminderEmails: boolean
  notifyLeakEmails: boolean
}

export async function runNotificationDigestDryRun({
  digestDate = new Date(),
  digestType = "DAILY",
  loadActions = loadDashboardActions,
  prisma,
}: {
  digestDate?: Date
  digestType?: NotificationDigestType
  loadActions?: typeof loadDashboardActions
  prisma: NotificationDigestRunnerClient
}): Promise<NotificationDigestDryRunResult> {
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      sendAnnualReportReminders: true,
      sendCertificateReminders: true,
      sendInspectionRemindersToContractors: true,
      users: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          notifyAnnualReportDeadlineEmails: true,
          notifyInspectionReminderEmails: true,
          notifyLeakEmails: true,
          memberships: {
            where: {
              isActive: true,
            },
            select: {
              companyId: true,
              id: true,
              role: true,
              servicePartnerCompanyId: true,
              isServicePartnerAdmin: true,
              servicePartnerCompany: {
                select: {
                  serviceOrganizationId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const results: NotificationDigestDryRunRecipientResult[] = []

  for (const company of companies as DigestCompany[]) {
    for (const user of company.users) {
      const recipientResult = await evaluateRecipient({
        company,
        digestDate,
        digestType,
        loadActions,
        prisma,
        user,
      })
      results.push(recipientResult)
    }
  }

  return {
    companiesChecked: companies.length,
    digestDate: digestDate.toISOString(),
    digestType,
    eligibleRecipients: results.filter((result) => result.decision === "WOULD_SEND")
      .length,
    recipientsChecked: results.length,
    results,
    skippedAlreadySent: results.filter(
      (result) => result.decision === "SKIP_ALREADY_SENT"
    ).length,
    skippedDisabled: results.filter((result) => result.decision === "SKIP_DISABLED")
      .length,
    skippedNoItems: results.filter((result) => result.decision === "SKIP_NO_ITEMS")
      .length,
  }
}

async function evaluateRecipient({
  company,
  digestDate,
  digestType,
  loadActions,
  prisma,
  user,
}: {
  company: DigestCompany
  digestDate: Date
  digestType: NotificationDigestType
  loadActions: typeof loadDashboardActions
  prisma: NotificationDigestRunnerClient
  user: DigestUser
}): Promise<NotificationDigestDryRunRecipientResult> {
  if (!isUserNotificationEnabled(user)) {
    return buildRecipientResult(company.id, user, 0, "SKIP_DISABLED")
  }

  if (!isCompanyNotificationEnabled(company)) {
    return buildRecipientResult(company.id, user, 0, "SKIP_DISABLED")
  }

  const membership = selectDigestMembership(user, company.id)
  if (!membership) {
    return buildRecipientResult(company.id, user, 0, "SKIP_DISABLED")
  }

  const actions = await loadActions({
    companyId: company.id,
    isServicePartnerAdmin: membership.isServicePartnerAdmin,
    membershipId: membership.id,
    role: membership.role,
    serviceOrganizationId:
      membership.servicePartnerCompany?.serviceOrganizationId ?? null,
    servicePartnerCompanyId: membership.servicePartnerCompanyId,
    userId: user.id,
  })
  const digest = buildNotificationDigest({
    actions,
    enabled: {
      certificates: company.sendCertificateReminders,
      inspections: company.sendInspectionRemindersToContractors,
      reports: company.sendAnnualReportReminders,
    },
    today: digestDate,
  })

  if (digest.totalItems === 0) {
    return buildRecipientResult(company.id, user, 0, "SKIP_NO_ITEMS")
  }

  const canSend = await shouldSendDigest({
    companyId: company.id,
    digestDate,
    digestType,
    prisma,
    userId: user.id,
  })

  return buildRecipientResult(
    company.id,
    user,
    digest.totalItems,
    canSend ? "WOULD_SEND" : "SKIP_ALREADY_SENT"
  )
}

function buildRecipientResult(
  companyId: string,
  user: Pick<DigestUser, "email" | "id">,
  totalItems: number,
  decision: NotificationDigestDecision
): NotificationDigestDryRunRecipientResult {
  return {
    companyId,
    decision,
    email: user.email,
    totalItems,
    userId: user.id,
  }
}

function isUserNotificationEnabled(user: DigestUser) {
  return (
    user.notifyAnnualReportDeadlineEmails ||
    user.notifyInspectionReminderEmails ||
    user.notifyLeakEmails
  )
}

function isCompanyNotificationEnabled(company: DigestCompany) {
  return (
    company.sendAnnualReportReminders ||
    company.sendCertificateReminders ||
    company.sendInspectionRemindersToContractors
  )
}

function selectDigestMembership(user: DigestUser, companyId: string) {
  const companyMemberships = user.memberships.filter(
    (membership) => membership.companyId === companyId
  )

  return (
    companyMemberships.find((membership) => membership.role === "OWNER") ??
    companyMemberships.find((membership) => membership.role === "ADMIN") ??
    companyMemberships.find((membership) => membership.role === "MEMBER") ??
    companyMemberships.find((membership) => membership.role === "CONTRACTOR") ??
    null
  )
}
