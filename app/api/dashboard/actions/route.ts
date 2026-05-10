import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { loadDashboardActions } from "@/lib/actions/load-dashboard-actions"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const actions = await loadDashboardActions(auth.user)

    return NextResponse.json({ actions }, { status: 200 })
  } catch (error: unknown) {
    console.error("Get dashboard actions error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
