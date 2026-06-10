import { list } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import vercelConfig from "@/vercel.json"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildHealthReport } from "@/lib/health/health-checks"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const report = await buildHealthReport({
      blobList: list,
      cronConfig: vercelConfig,
      env: process.env,
      prisma,
    })

    return NextResponse.json(report, { status: 200 })
  } catch (error) {
    console.error("Get health report error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta systemhälsa" },
      { status: 500 }
    )
  }
}
