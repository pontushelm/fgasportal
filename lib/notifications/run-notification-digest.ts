import type { NotificationDigestType, PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/auth"
import { loadDashboardActions } from "@/lib/actions/load-dashboard-actions"
import { sendNotificationDigestEmail } from "@/lib/email"
import {
  buildNotificationDigest,
} from "@/lib/notifications/build-notification-digest"
import {
  recordDigestSent,
  shouldSendDigest,
} from "@/lib/notifications/digest-log"

export type NotificationDigestRunnerClient = {
  company: Pick<PrismaClient["company"], "findMany">
  notificationDigestLog: Pick<
    PrismaClient["notificationDigestLog"],
    "findUnique" | "upsert"
  >
}

export type NotificationDigestRunMode = "dry-run" | "send"

export type NotificationDigestDecision =
  | "WOULD_SEND"
  | "SENT"
  | "FAILED"
  | "SKIP_NO_ITEMS"
  | "SKIP_ALREADY_SENT"
  | "SKIP_DISABLED"

export type NotificationDigestDryRunRecipientResult = {
  companyId: string
  decision: NotificationDigestDecision
  email: string
  error?: string
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
  sent: number
  failed: number
  skippedAlreadySent: number
  skippedDisabled: number
  skippedNoItems: number
}

type DigestCompany = {
  id: string
  name: string
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

type DigestEmailSender = typeof sendNotificationDigestEmail

export async function runNotificationDigest({
  appUrl = process.env.APP_URL,
  digestDate = new Date(),
  digestType = "DAILY",
  loadActions = loadDashboardActions,
  mode = "dry-run",
  prisma,
  sendDigestEmail = sendNotificationDigestEmail,
}: {
  appUrl?: string
  digestDate?: Date
  digestType?: NotificationDigestType
  loadActions?: typeof loadDashboardActions
  mode?: NotificationDigestRunMode
  prisma: NotificationDigestRunnerClient
  sendDigestEmail?: DigestEmailSender
}): Promise<NotificationDigestDryRunResult> {
  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
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
        appUrl,
        digestDate,
        digestType,
        loadActions,
        mode,
        prisma,
        sendDigestEmail,
        user,
      })
      results.push(recipientResult)
    }
  }

  return {
    companiesChecked: companies.length,
    digestDate: digestDate.toISOString(),
    digestType,
    eligibleRecipients: results.filter((result) =>
      ["WOULD_SEND", "SENT", "FAILED"].includes(result.decision)
    ).length,
    failed: results.filter((result) => result.decision === "FAILED").length,
    recipientsChecked: results.length,
    results,
    sent: results.filter((result) => result.decision === "SENT").length,
    skippedAlreadySent: results.filter(
      (result) => result.decision === "SKIP_ALREADY_SENT"
    ).length,
    skippedDisabled: results.filter((result) => result.decision === "SKIP_DISABLED")
      .length,
    skippedNoItems: results.filter((result) => result.decision === "SKIP_NO_ITEMS")
      .length,
  }
}

export function runNotificationDigestDryRun(
  input: Omit<
    Parameters<typeof runNotificationDigest>[0],
    "mode" | "sendDigestEmail"
  >
) {
  return runNotificationDigest({
    ...input,
    mode: "dry-run",
  })
}

async function evaluateRecipient({
  appUrl,
  company,
  digestDate,
  digestType,
  loadActions,
  mode,
  prisma,
  sendDigestEmail,
  user,
}: {
  appUrl?: string
  company: DigestCompany
  digestDate: Date
  digestType: NotificationDigestType
  loadActions: typeof loadDashboardActions
  mode: NotificationDigestRunMode
  prisma: NotificationDigestRunnerClient
  sendDigestEmail: DigestEmailSender
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

  if (!canSend) {
    return buildRecipientResult(company.id, user, digest.totalItems, "SKIP_ALREADY_SENT")
  }

  if (mode === "dry-run") {
    return buildRecipientResult(company.id, user, digest.totalItems, "WOULD_SEND")
  }

  try {
    if (!appUrl) {
      throw new Error("APP_URL is required")
    }

    await sendDigestEmail({
      actionsUrl: buildAppUrl(appUrl, "/dashboard/actions"),
      companyName: company.name,
      digest,
      notificationsUrl: buildAppUrl(appUrl, "/dashboard/notifications"),
      to: user.email,
    })
    await recordDigestSent({
      companyId: company.id,
      digestDate,
      digestType,
      prisma,
      totalItems: digest.totalItems,
      userId: user.id,
    })

    return buildRecipientResult(company.id, user, digest.totalItems, "SENT")
  } catch (error) {
    return buildRecipientResult(
      company.id,
      user,
      digest.totalItems,
      "FAILED",
      error instanceof Error ? error.message : "Kunde inte skicka digest"
    )
  }
}

function buildAppUrl(appUrl: string, path: string) {
  return new URL(path, appUrl).toString()
}

function buildRecipientResult(
  companyId: string,
  user: Pick<DigestUser, "email" | "id">,
  totalItems: number,
  decision: NotificationDigestDecision,
  error?: string
): NotificationDigestDryRunRecipientResult {
  return {
    companyId,
    decision,
    email: user.email,
    ...(error ? { error } : {}),
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
