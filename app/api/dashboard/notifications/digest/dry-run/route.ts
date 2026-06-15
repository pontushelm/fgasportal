import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runNotificationDigestDryRun } from "@/lib/notifications/run-notification-digest"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const result = await runNotificationDigestDryRun({
      digestType: "DAILY",
      prisma,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Notification digest dry-run error:", error)

    return NextResponse.json(
      { error: "Kunde inte testa e-postsammanfattningen" },
      { status: 500 }
    )
  }
}
