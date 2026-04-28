import { NextRequest, NextResponse } from "next/server"
import { sendInspectionReminders } from "@/lib/inspection-reminders"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.CRON_SECRET

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const summary = await sendInspectionReminders()

    return NextResponse.json({ ok: true, ...summary }, { status: 200 })
  } catch (error) {
    console.error("Inspection reminder cron failed", error)

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}
