import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { loadDashboardActions } from "@/lib/actions/load-dashboard-actions"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildNotificationDigest } from "@/lib/notifications/build-notification-digest"
import { getLatestDigest } from "@/lib/notifications/digest-log"

const notificationSettingsSchema = z.object({
  company: z
    .object({
      inspectionReminders: z.boolean(),
      certificateReminders: z.boolean(),
      annualReportReminders: z.boolean(),
    })
    .optional(),
  user: z
    .object({
      receiveNotifications: z.boolean(),
    })
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const [actions, company, user, latestDigest] = await Promise.all([
      loadDashboardActions(auth.user),
      prisma.company.findUnique({
        where: {
          id: auth.user.companyId,
        },
        select: {
          sendAnnualReportReminders: true,
          sendCertificateReminders: true,
          sendInspectionRemindersToContractors: true,
        },
      }),
      prisma.user.findUnique({
        where: {
          id: auth.user.userId,
        },
        select: {
          notifyAnnualReportDeadlineEmails: true,
          notifyInspectionReminderEmails: true,
          notifyLeakEmails: true,
        },
      }),
      getLatestDigest({
        companyId: auth.user.companyId,
        prisma,
        userId: auth.user.userId,
      }),
    ])

    const companySettings = {
      annualReportReminders: company?.sendAnnualReportReminders ?? true,
      certificateReminders: company?.sendCertificateReminders ?? true,
      inspectionReminders:
        company?.sendInspectionRemindersToContractors ?? false,
    }
    const userSettings = {
      receiveNotifications:
        (user?.notifyAnnualReportDeadlineEmails ?? true) ||
        (user?.notifyInspectionReminderEmails ?? true) ||
        (user?.notifyLeakEmails ?? true),
    }

    return NextResponse.json(
      {
        digest: buildNotificationDigest({
          actions,
          enabled: {
            certificates: companySettings.certificateReminders,
            inspections: companySettings.inspectionReminders,
            reports: companySettings.annualReportReminders,
          },
        }),
        settings: {
          canManageCompanySettings: auth.user.role === "OWNER",
          company: companySettings,
          user: userSettings,
        },
        latestDigest: latestDigest
          ? {
              digestType: latestDigest.digestType,
              sentAt: latestDigest.sentAt,
              totalItems: latestDigest.totalItems,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get notification center error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta notifieringar" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const validation = notificationSettingsSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: "Ogiltiga notifieringsinställningar" },
        { status: 400 }
      )
    }

    if (validation.data.company && auth.user.role !== "OWNER") {
      return forbiddenResponse()
    }

    const [company, user] = await Promise.all([
      validation.data.company
        ? prisma.company.update({
            where: {
              id: auth.user.companyId,
            },
            data: {
              sendAnnualReportReminders:
                validation.data.company.annualReportReminders,
              sendCertificateReminders:
                validation.data.company.certificateReminders,
              sendInspectionRemindersToContractors:
                validation.data.company.inspectionReminders,
            },
            select: {
              sendAnnualReportReminders: true,
              sendCertificateReminders: true,
              sendInspectionRemindersToContractors: true,
            },
          })
        : prisma.company.findUnique({
            where: {
              id: auth.user.companyId,
            },
            select: {
              sendAnnualReportReminders: true,
              sendCertificateReminders: true,
              sendInspectionRemindersToContractors: true,
            },
          }),
      validation.data.user
        ? prisma.user.update({
            where: {
              id: auth.user.userId,
            },
            data: {
              notifyAnnualReportDeadlineEmails:
                validation.data.user.receiveNotifications,
              notifyInspectionReminderEmails:
                validation.data.user.receiveNotifications,
              notifyLeakEmails: validation.data.user.receiveNotifications,
            },
            select: {
              notifyAnnualReportDeadlineEmails: true,
              notifyInspectionReminderEmails: true,
              notifyLeakEmails: true,
            },
          })
        : prisma.user.findUnique({
            where: {
              id: auth.user.userId,
            },
            select: {
              notifyAnnualReportDeadlineEmails: true,
              notifyInspectionReminderEmails: true,
              notifyLeakEmails: true,
            },
          }),
    ])

    return NextResponse.json(
      {
        settings: {
          canManageCompanySettings: auth.user.role === "OWNER",
          company: {
            annualReportReminders: company?.sendAnnualReportReminders ?? true,
            certificateReminders: company?.sendCertificateReminders ?? true,
            inspectionReminders:
              company?.sendInspectionRemindersToContractors ?? false,
          },
          user: {
            receiveNotifications:
              (user?.notifyAnnualReportDeadlineEmails ?? true) ||
              (user?.notifyInspectionReminderEmails ?? true) ||
              (user?.notifyLeakEmails ?? true),
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Update notification center settings error:", error)

    return NextResponse.json(
      { error: "Kunde inte spara notifieringsinställningar" },
      { status: 500 }
    )
  }
}
