import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest } from "@/lib/auth"
import { loadDataQualityReport } from "@/lib/dashboard/load-data-quality-report"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const report = await loadDataQualityReport(auth.user)

    return NextResponse.json(report, { status: 200 })
  } catch (error: unknown) {
    console.error("Get data quality report error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
