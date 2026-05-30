import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import {
  type FgasReportData,
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
    const overviewOnly = request.nextUrl.searchParams.get("overviewOnly") === "1"

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
    if (reportType === "annual" && overviewOnly && includeAnnualOverview) {
      const overviewStartTime = getDevelopmentTimingStart()
      const annualReportOverview = await getAnnualFgasReportPropertyOverview({
        companyId: auth.user.companyId,
        assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
        signedReportUserId: isContractor(auth.user) ? auth.user.userId : undefined,
        year,
      })
      logDevelopmentTiming(
        "GET /api/reports/fgas annual overview only",
        overviewStartTime
      )

      return NextResponse.json(
        {
          ...buildOverviewOnlyReportData(year),
          annualReportOverview,
        },
        { status: 200 }
      )
    }

    const reportStartTime = getDevelopmentTimingStart()
    const report =
      reportType === "annual"
        ? await getAnnualFgasReportPreview(reportParams)
        : await getFgasAnnualReport(reportParams)
    logDevelopmentTiming("GET /api/reports/fgas report data", reportStartTime)

    const overviewStartTime = getDevelopmentTimingStart()
    const annualReportOverview =
      reportType === "annual" && includeAnnualOverview
        ? await getAnnualFgasReportPropertyOverview({
            companyId: auth.user.companyId,
            assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
            signedReportUserId: isContractor(auth.user) ? auth.user.userId : undefined,
            year,
          })
        : undefined
    logDevelopmentTiming("GET /api/reports/fgas annual overview", overviewStartTime)

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

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}

function buildOverviewOnlyReportData(year: number): FgasReportData {
  return {
    year,
    period: {
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year + 1, 0, 1)),
    },
    metrics: {
      totalInstallations: 0,
      totalRefrigerantAmountKg: 0,
      totalCo2eTon: 0,
      knownCo2eTon: 0,
      unknownCo2eInstallations: 0,
      requiringInspection: 0,
      inspectionsPerformed: 0,
      leakageEvents: 0,
      refilledAmountKg: 0,
      serviceEvents: 0,
    },
    warnings: [],
    qualitySummary: {
      status: "READY",
      blockingIssueCount: 0,
      warningCount: 0,
      totalIssueCount: 0,
    },
    refrigerants: [],
    events: [],
  }
}
