import { Prisma } from "@prisma/client"
import { buildActionQueueUrl } from "@/lib/actions/action-links"
import { getAppUrl } from "@/lib/app-url"
import { prisma } from "@/lib/db"
import { sendOperationalDigestEmail } from "@/lib/email"
import {
  addDays,
  classifyInspectionStatus,
  startOfDay,
  type InspectionStatus,
} from "@/lib/inspection-status"
import { getReminderRecipients } from "@/lib/notification-recipient-selection"

export type InspectionReminderStatus = Extract<
  InspectionStatus,
  "OK" | "DUE_SOON" | "OVERDUE"
>
type ReminderType = Exclude<InspectionReminderStatus, "OK">

type ReminderSummary = {
  found: number
  sent: number
  skipped: number
  errors: Array<{ installationId: string; error: string }>
}

const DUE_SOON_DAYS = 30

export async function sendInspectionReminders(
  today = new Date()
): Promise<ReminderSummary> {
  const currentDate = startOfDay(today)
  const dueSoonLimit = addDays(currentDate, DUE_SOON_DAYS)
  const installations = await prisma.installation.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      scrappedAt: null,
      nextInspection: {
        not: null,
        lte: dueSoonLimit,
      },
    },
    include: {
      company: {
        include: {
          memberships: {
            where: {
              isActive: true,
              role: {
                in: ["OWNER", "ADMIN", "MEMBER"],
              },
              user: {
                isActive: true,
                email: {
                  not: "",
                },
                notifyInspectionReminderEmails: true,
              },
            },
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  notifyInspectionReminderEmails: true,
                },
              },
            },
          },
        },
      },
      assignedContractor: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          notifyInspectionReminderEmails: true,
          memberships: {
            where: {
              role: "CONTRACTOR",
              isActive: true,
            },
            select: {
              companyId: true,
              servicePartnerCompany: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })
  const summary: ReminderSummary = {
    found: installations.length,
    sent: 0,
    skipped: 0,
    errors: [],
  }
  const appUrl = getAppUrl()
  const digestByEmail = new Map<
    string,
    {
      userId: string
      email: string
      actionQueueUrl: string
      items: Array<{
        installationId: string
        installationName: string
        location: string | null
        nextInspection: Date
        status: ReminderType
        reminderKey: string
        installationUrl: string
        servicePartnerCompanyName?: string | null
      }>
    }
  >()

  for (const installation of installations) {
    if (!installation.nextInspection) {
      summary.skipped += 1
      continue
    }

    const status = classifyInspectionReminderStatus(
      installation.nextInspection,
      currentDate
    )

    if (status === "OK") {
      summary.skipped += 1
      continue
    }

    const recipients = getReminderRecipients(installation)

    if (recipients.length === 0) {
      summary.skipped += 1
      continue
    }

    for (const user of recipients) {
      const isAssignedContractor = user.id === installation.assignedContractor?.id
      const servicePartnerCompany =
        isAssignedContractor
          ? getAssignedServicePartnerCompany(installation)
          : null
      const reminderKey = createReminderKey(status, installation.nextInspection)
      const alreadySent = await prisma.reminderLog.findUnique({
        where: {
          installationId_email_type_reminderKey: {
            installationId: installation.id,
            email: user.email,
            type: status,
            reminderKey,
          },
        },
      })

      if (alreadySent) {
        summary.skipped += 1
        continue
      }

      const emailKey = user.email.toLowerCase()
      const digest = digestByEmail.get(emailKey) ?? {
        userId: user.id,
        email: user.email,
        actionQueueUrl: buildActionQueueUrl(appUrl, {
          serviceContactId: isAssignedContractor ? user.id : null,
          servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
        }),
        items: [],
      }

      digest.items.push({
        installationId: installation.id,
        installationName: installation.name,
        location: installation.location,
        nextInspection: installation.nextInspection,
        status,
        reminderKey,
        installationUrl: `${appUrl}/dashboard/installations/${installation.id}`,
        servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      })
      digestByEmail.set(emailKey, digest)
    }
  }

  for (const digest of digestByEmail.values()) {
    try {
      await sendOperationalDigestEmail({
        to: digest.email,
        actionQueueUrl: digest.actionQueueUrl,
        inspectionReminders: digest.items.map((item) => ({
          installationName: item.installationName,
          location: item.location,
          nextInspection: item.nextInspection,
          status: item.status,
          installationUrl: item.installationUrl,
          servicePartnerCompanyName: item.servicePartnerCompanyName,
        })),
      })

      await prisma.reminderLog.createMany({
        data: digest.items.map((item) => ({
          installationId: item.installationId,
          userId: digest.userId,
          email: digest.email,
          type: item.status,
          reminderKey: item.reminderKey,
        })),
        skipDuplicates: true,
      })

      summary.sent += 1
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        summary.skipped += digest.items.length
        continue
      }

      console.error("Inspection reminder digest email failed", {
        userId: digest.userId,
        email: digest.email,
        error,
      })

      summary.errors.push({
        installationId: "digest",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return summary
}

type ReminderInstallation = {
  nextInspection: Date | null
  company: {
    id: string
  }
  assignedContractor: {
    memberships: Array<{
      companyId: string
      servicePartnerCompany: {
        id: string
        name: string
      } | null
    }>
  } | null
}

function getAssignedServicePartnerCompany(installation: ReminderInstallation) {
  return (
    installation.assignedContractor?.memberships.find(
      (membership) => membership.companyId === installation.company.id
    )?.servicePartnerCompany ?? null
  )
}

export function classifyInspectionReminderStatus(
  nextInspection: Date,
  today: Date
): InspectionReminderStatus {
  const { status } = classifyInspectionStatus({
    inspectionRequired: true,
    nextInspection,
    today,
  })

  if (status === "OVERDUE" || status === "DUE_SOON") return status
  return "OK"
}

function createReminderKey(type: ReminderType, nextInspection: Date) {
  return `${type}:${formatDate(startOfDay(nextInspection))}`
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}
