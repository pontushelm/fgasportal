import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runNotificationDigest } from "@/lib/notifications/run-notification-digest"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const result = await runNotificationDigest({
      digestType: "DAILY",
      mode: "send",
      prisma,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Notification digest send error:", error)

    return NextResponse.json(
      { error: "Kunde inte skicka notifieringsdigest" },
      { status: 500 }
    )
  }
}
