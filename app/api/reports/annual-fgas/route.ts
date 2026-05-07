import { createElement } from "react"
import { renderToString } from "next/dist/server/ReactDOMServerPages"
import { NextRequest, NextResponse } from "next/server"
import { AnnualReportTemplate } from "@/components/reports/AnnualFgasReportTemplate"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { buildAnnualFgasReportData } from "@/lib/reports/buildAnnualFgasReportData"
import { generatePdfFromHtml } from "@/lib/reports/generatePdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const year = parseReportYear(request.nextUrl.searchParams.get("year"))
    const municipality = request.nextUrl.searchParams.get("municipality")?.trim()

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    const report = await buildAnnualFgasReportData({
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      municipality: municipality || undefined,
      year,
    })
    const html = `<!doctype html>${renderToString(
      createElement(AnnualReportTemplate, { report })
    )}`
    const pdf = await generatePdfFromHtml(html)
    const filename = `fgas-arsrapport-kontrollpliktiga-aggregat-${year}.pdf`

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "report_exported",
      entityType: "report",
      entityId: `annual-fgas-${year}`,
      metadata: {
        reportType: "annual_fgas_control_required_equipment",
        year,
        municipality: municipality || null,
        format: "pdf",
      },
    })

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (error) {
    console.error("Generate annual F-gas PDF error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod när årsrapporten skulle skapas" },
      { status: 500 }
    )
  }
}

function parseReportYear(value: string | null) {
  const currentYear = new Date().getFullYear()
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return null
  }

  return year
}
