import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import {
  getImportSessionForCompany,
  rollbackImportSession,
  toImportSessionSummary,
} from "@/lib/import-sessions"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const result = await rollbackImportSession({
      companyId: auth.user.companyId,
      importSessionId: id,
      userId: auth.user.userId,
    })

    if (!result) {
      return NextResponse.json({ error: "Importen hittades inte" }, { status: 404 })
    }

    const session = await getImportSessionForCompany(id, auth.user.companyId)

    return NextResponse.json(
      {
        alreadyRolledBack: result.alreadyRolledBack,
        rollback: result.rollback,
        session: session ? await toImportSessionSummary(session) : null,
      },
      { status: !result.rolledBack && !result.alreadyRolledBack ? 409 : 200 }
    )
  } catch (error) {
    console.error("Rollback import session error:", error)
    return NextResponse.json(
      { error: "Kunde inte ångra importen" },
      { status: 500 }
    )
  }
}
