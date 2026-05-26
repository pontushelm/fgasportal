import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import {
  getAnnualFgasReportPropertyOverview,
  getAnnualFgasReportPreview,
  getFgasAnnualReport,
  parseReportYear,
} from "@/lib/fgas-report"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const year = parseReportYear(request.nextUrl.searchParams.get("year"))
    const municipality = request.nextUrl.searchParams.get("municipality")?.trim()
    const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim()
    const reportType = request.nextUrl.searchParams.get("reportType")?.trim()
    const includeAnnualOverview =
      request.nextUrl.searchParams.get("includeAnnualOverview") !== "0"

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    const reportParams = {
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      municipality: municipality || undefined,
      propertyId: propertyId || undefined,
      year,
    }
    const report =
      reportType === "annual"
        ? await getAnnualFgasReportPreview(reportParams)
        : await getFgasAnnualReport(reportParams)
    const annualReportOverview =
      reportType === "annual" && includeAnnualOverview
        ? await getAnnualFgasReportPropertyOverview({
            companyId: auth.user.companyId,
            assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
            signedReportUserId: isContractor(auth.user) ? auth.user.userId : undefined,
            year,
          })
        : undefined

    return NextResponse.json(
      annualReportOverview ? { ...report, annualReportOverview } : report,
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get F-gas report error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
