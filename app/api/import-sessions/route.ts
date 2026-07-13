import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { listImportSessions } from "@/lib/import-sessions"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Number(limitParam) : 50
    const sessions = await listImportSessions(auth.user.companyId, Number.isFinite(limit) ? limit : 50)

    return NextResponse.json({ sessions }, { status: 200 })
  } catch (error) {
    console.error("Get import sessions error:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta importhistorik" },
      { status: 500 }
    )
  }
}
