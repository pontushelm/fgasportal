import { createElement } from "react"
import { renderToString } from "next/dist/server/ReactDOMServerPages"
import { NextRequest, NextResponse } from "next/server"
import { AnnualReportTemplate } from "@/components/reports/AnnualFgasReportTemplate"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { buildAnnualFgasReportData } from "@/lib/reports/buildAnnualFgasReportData"
import { generatePdfFromHtml } from "@/lib/reports/generatePdf"
import { parseAnnualFgasSigningMetadata } from "@/lib/reports/annualFgasSigning"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startedAt = Date.now()

  try {
    logAnnualReportRoute(requestId, "Request received", {
      searchParams: sanitizeSearchParams(request.nextUrl.searchParams),
    })

    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const year = parseReportYear(request.nextUrl.searchParams.get("year"))
    const municipality = request.nextUrl.searchParams.get("municipality")?.trim()
    const propertyId = request.nextUrl.searchParams.get("propertyId")?.trim()
    const signing = parseAnnualFgasSigningMetadata(request.nextUrl.searchParams)

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    if (!signing.ok) {
      return NextResponse.json(
        { error: "Ogiltiga signeringsuppgifter", details: signing.errors },
        { status: 400 }
      )
    }

    logAnnualReportRoute(requestId, "Building report data", {
      companyId: auth.user.companyId,
      isContractor: isContractor(auth.user),
      municipality: municipality || null,
      propertyId: propertyId || null,
      signed: Boolean(signing.metadata),
      year,
    })

    const report = await buildAnnualFgasReportData({
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      municipality: municipality || undefined,
      propertyId: propertyId || undefined,
      signingMetadata: signing.metadata,
      year,
    })
    logAnnualReportRoute(requestId, "Report data built", {
      certificateCount: report.certificateRegister.length,
      equipmentCount: report.equipment.length,
      leakageControlCount: report.leakageControls.length,
      refrigerantHandlingRows: report.refrigerantHandlingLog.length,
      scrappedEquipmentCount: report.scrappedEquipment.length,
    })

    const html = `<!doctype html>${renderToString(
      createElement(AnnualReportTemplate, { report })
    )}`
    logAnnualReportRoute(requestId, "React report template rendered", {
      htmlLength: html.length,
    })

    const pdf = await generatePdfFromHtml(html, {
      logger: (message, metadata) =>
        logAnnualReportRoute(requestId, message, metadata),
    })
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
        propertyId: propertyId || null,
        signed: Boolean(signing.metadata),
        format: "pdf",
      },
    })
    logAnnualReportRoute(requestId, "PDF response ready", {
      byteLength: pdf.length,
      durationMs: Date.now() - startedAt,
    })

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
        "X-Annual-Fgas-Pdf-Request-Id": requestId,
      },
    })
  } catch (error) {
    logAnnualReportRouteError(requestId, error, {
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod när årsrapporten skulle skapas" },
      {
        status: 500,
        headers: {
          "X-Annual-Fgas-Pdf-Request-Id": requestId,
        },
      }
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

function logAnnualReportRoute(
  requestId: string,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  console.info("[annual-fgas-pdf]", {
    message,
    requestId,
    ...metadata,
  })
}

function logAnnualReportRouteError(
  requestId: string,
  error: unknown,
  metadata: Record<string, unknown> = {}
) {
  console.error("[annual-fgas-pdf]", {
    message: "Annual F-gas PDF generation failed",
    requestId,
    error: serializeError(error),
    ...metadata,
  })
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  return error
}

function sanitizeSearchParams(searchParams: URLSearchParams) {
  return {
    municipality: searchParams.get("municipality"),
    propertyId: searchParams.get("propertyId"),
    signed: searchParams.get("signed"),
    year: searchParams.get("year"),
  }
}
