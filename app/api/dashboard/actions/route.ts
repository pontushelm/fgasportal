import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { loadDashboardActions } from "@/lib/actions/load-dashboard-actions"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const loadStartTime = getDevelopmentTimingStart()
    const actions = await loadDashboardActions(auth.user)
    logDevelopmentTiming("GET /api/dashboard/actions load actions", loadStartTime)

    return NextResponse.json({ actions }, { status: 200 })
  } catch (error: unknown) {
    console.error("Get dashboard actions error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}
