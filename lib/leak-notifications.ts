import { prisma } from "@/lib/db"
import { sendLeakNotificationEmail } from "@/lib/email"
import { selectLeakNotificationRecipients } from "@/lib/notification-recipient-selection"

export async function notifyAdminsAboutLeakEvent({
  companyId,
  event,
  installation,
}: {
  companyId: string
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
}) {
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

    const installationUrl = `${getAppUrl()}/dashboard/installations/${installation.id}`
    const propertyName = installation.property?.name ?? installation.propertyName

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await sendLeakNotificationEmail({
            to: recipient.email,
            installationName: installation.name,
            equipmentId: installation.equipmentId,
            propertyName,
            eventDate: event.date,
            leakageAmountKg: event.refrigerantAddedKg,
            installationUrl,
          })
        } catch (error) {
          console.error("Leak notification email failed", {
            companyId,
            eventId: event.id,
            installationId: installation.id,
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
      eventId: event.id,
      installationId: installation.id,
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
