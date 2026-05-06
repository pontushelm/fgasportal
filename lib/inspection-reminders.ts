import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { sendInspectionReminderEmail } from "@/lib/email"
import {
  addDays,
  classifyInspectionStatus,
  startOfDay,
  type InspectionStatus,
} from "@/lib/inspection-status"

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
type ReminderRecipient = {
  id: string
  email: string
  notifyInspectionReminderEmails: boolean
}

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
                in: ["OWNER", "ADMIN"],
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

      try {
        await sendInspectionReminderEmail({
          to: user.email,
          installationName: installation.name,
          location: installation.location,
          nextInspection: installation.nextInspection,
          status,
          installationUrl: `${appUrl}/dashboard/installations/${installation.id}`,
        })

        await prisma.reminderLog.create({
          data: {
            installationId: installation.id,
            userId: user.id,
            email: user.email,
            type: status,
            reminderKey,
          },
        })

        summary.sent += 1
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          summary.skipped += 1
          continue
        }

        console.error("Inspection reminder email failed", {
          installationId: installation.id,
          userId: user.id,
          email: user.email,
          error,
        })

        summary.errors.push({
          installationId: installation.id,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }
  }

  return summary
}

function getReminderRecipients(installation: {
  company: {
    sendInspectionRemindersToContractors: boolean
    memberships: Array<{ user: ReminderRecipient }>
    id: string
  }
  assignedContractor: {
    id: string
    email: string
    role: string
    isActive: boolean
    notifyInspectionReminderEmails: boolean
    memberships: Array<{ companyId: string }>
  } | null
}) {
  const recipientsByEmail = new Map<string, ReminderRecipient>()

  for (const { user: admin } of installation.company.memberships) {
    if (admin.email) {
      recipientsByEmail.set(admin.email.toLowerCase(), admin)
    }
  }

  const contractor = installation.assignedContractor

  if (
    installation.company.sendInspectionRemindersToContractors &&
    contractor?.email &&
    contractor.isActive &&
    contractor.memberships.some(
      (membership) => membership.companyId === installation.company.id
    ) &&
    contractor.notifyInspectionReminderEmails
  ) {
    recipientsByEmail.set(contractor.email.toLowerCase(), {
      id: contractor.id,
      email: contractor.email,
      notifyInspectionReminderEmails: contractor.notifyInspectionReminderEmails,
    })
  }

  return Array.from(recipientsByEmail.values())
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

function getAppUrl() {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error("APP_URL is required")
  }

  return appUrl.replace(/\/$/, "")
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
