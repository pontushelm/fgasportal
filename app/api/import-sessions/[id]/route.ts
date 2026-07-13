import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import {
  getImportSessionForCompany,
  toImportSessionSummary,
} from "@/lib/import-sessions"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const session = await getImportSessionForCompany(id, auth.user.companyId)
    if (!session) {
      return NextResponse.json({ error: "Importen hittades inte" }, { status: 404 })
    }

    return NextResponse.json(
      { session: await toImportSessionSummary(session) },
      { status: 200 }
    )
  } catch (error) {
    console.error("Get import session error:", error)
    return NextResponse.json(
      { error: "Kunde inte hämta importen" },
      { status: 500 }
    )
  }
}
