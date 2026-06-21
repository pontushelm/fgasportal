import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { runNotificationDigest } from "@/lib/notifications/run-notification-digest"

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY is required" },
        { status: 500 }
      )
    }

    const result = await runNotificationDigest({
      digestType: "DAILY",
      mode: "send",
      prisma,
    })

    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (error) {
    console.error("Notification digest cron failed", error)

    return NextResponse.json(
      {
        ok: false,
        error: "Cron job failed",
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : getErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

function isAuthorizedCronRequest(request: NextRequest) {
  const expectedToken = process.env.CRON_SECRET
  if (!expectedToken) return false

  const authHeader = request.headers.get("authorization")
  const cronSecretHeader = request.headers.get("x-cron-secret")

  return (
    authHeader === `Bearer ${expectedToken}` ||
    cronSecretHeader === expectedToken
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}
