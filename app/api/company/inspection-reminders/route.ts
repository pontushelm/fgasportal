import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

const inspectionReminderSettingsSchema = z.object({
  sendInspectionRemindersToContractors: z.boolean(),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const validation = inspectionReminderSettingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Ogiltiga påminnelseinställningar" },
        { status: 400 }
      )
    }

    const company = await prisma.company.update({
      where: {
        id: auth.user.companyId,
      },
      data: validation.data,
      select: {
        sendInspectionRemindersToContractors: true,
      },
    })

    return NextResponse.json(company, { status: 200 })
  } catch (error) {
    console.error("Update inspection reminder settings error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
