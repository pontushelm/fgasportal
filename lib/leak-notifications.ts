import { getLeakageActionQueueUrl } from "@/lib/actions/action-links"
import { prisma } from "@/lib/db"
import { sendOperationalDigestEmail } from "@/lib/email"
import { selectLeakNotificationRecipients } from "@/lib/notification-recipient-selection"

type LeakNotificationEvent = {
  event: {
    id: string
    date: Date
    refrigerantAddedKg: number | null
  }
  installation: {
    id: string
    name: string
    equipmentId: string | null
    propertyName: string | null
    property?: { name: string } | null
  }
}

export async function notifyAdminsAboutLeakEvent({
  companyId,
  event,
  installation,
}: {
  companyId: string
} & LeakNotificationEvent) {
  await notifyAdminsAboutLeakEvents({
    companyId,
    events: [{ event, installation }],
  })
}

export async function notifyAdminsAboutLeakEvents({
  companyId,
  events,
}: {
  companyId: string
  events: LeakNotificationEvent[]
}) {
  if (events.length === 0) return

  try {
    const memberships = await prisma.companyMembership.findMany({
      where: {
        companyId,
        role: {
          in: ["OWNER", "ADMIN"],
        },
        isActive: true,
        user: {
          isActive: true,
          email: {
            not: "",
          },
          notifyLeakEmails: true,
        },
      },
      select: {
        role: true,
        isActive: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            notifyLeakEmails: true,
          },
        },
      },
    })
    const recipients = selectLeakNotificationRecipients(memberships)

    if (recipients.length === 0) return

    const appUrl = getAppUrl()
    const actionQueueUrl = getLeakageActionQueueUrl(appUrl)
    const leakEvents = events.map(({ event, installation }) => ({
      installationName: installation.name,
      equipmentId: installation.equipmentId,
      propertyName: installation.property?.name ?? installation.propertyName,
      eventDate: event.date,
      leakageAmountKg: event.refrigerantAddedKg,
      installationUrl: `${appUrl}/dashboard/installations/${installation.id}`,
    }))

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await sendOperationalDigestEmail({
            to: recipient.email,
            actionQueueUrl,
            leakEvents,
          })
        } catch (error) {
          console.error("Leak notification email failed", {
            companyId,
            eventIds: events.map(({ event }) => event.id),
            userId: recipient.id,
            email: recipient.email,
            error,
          })
        }
      })
    )
  } catch (error) {
    console.error("Leak notification lookup failed", {
      companyId,
      eventIds: events.map(({ event }) => event.id),
      error,
    })
  }
}

function getAppUrl() {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error("APP_URL is required")
  }

  return appUrl.replace(/\/$/, "")
}
