import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"

const notificationPreferencesSchema = z.object({
  notifyAssignmentEmails: z.boolean(),
  notifyInspectionReminderEmails: z.boolean(),
  notifyDocumentEmails: z.boolean(),
  notifyAnnualReportDeadlineEmails: z.boolean(),
  notifyLeakEmails: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const validation = notificationPreferencesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Ogiltiga notifieringsinställningar" },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: {
        id: auth.user.userId,
      },
      data: validation.data,
      select: {
        notifyAssignmentEmails: true,
        notifyInspectionReminderEmails: true,
        notifyDocumentEmails: true,
        notifyAnnualReportDeadlineEmails: true,
        notifyLeakEmails: true,
      },
    })

    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error("Update notification preferences error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
