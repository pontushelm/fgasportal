import { createElement } from "react"
import { renderToString } from "next/dist/server/ReactDOMServerPages"
import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { AnnualReportTemplate } from "@/components/reports/AnnualFgasReportTemplate"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { buildAnnualFgasReportData } from "@/lib/reports/buildAnnualFgasReportData"
import { buildAnnualFgasReportFilename } from "@/lib/reports/annualFgasReportFilename"
import { generatePdfFromHtml } from "@/lib/reports/generatePdf"
import { buildAnnualFgasSigningMetadata } from "@/lib/reports/annualFgasSigning"
import { buildAnnualFgasReportSnapshotHash, type ReportSnapshotScope } from "@/lib/reports/reportSnapshot"
import {
  deleteSignedReportPdfArtifact,
  SignedReportArtifactStorageConfigurationError,
  storeSignedReportPdfArtifact,
  type SignedReportPdfArtifactStorageMetadata,
} from "@/lib/reports/reportArtifactStorage"
import {
  ANNUAL_FGAS_TEMPLATE_VERSION,
  SIGNED_REPORT_RENDERER_VERSION,
} from "@/lib/reports/signedReportArtifacts"
import {
  buildSignedAnnualReportHistoryWhere,
  buildSignedAnnualReportCreateData,
  buildSigningMetadataFromHistory,
} from "@/lib/reports/signedAnnualFgasReports"
import { prisma } from "@/lib/db"

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

    const historyId = request.nextUrl.searchParams.get("historyId")?.trim()
    const historyRecord = historyId
        ? await prisma.signedAnnualFgasReport.findFirst({
            where: {
              id: historyId,
              ...buildSignedAnnualReportHistoryWhere({
                companyId: auth.user.companyId,
                isContractor: isContractor(auth.user),
                userId: auth.user.userId,
              }),
            },
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          })
      : null

    if (historyId && !historyRecord) {
      return NextResponse.json(
        { error: "Signerad rapport hittades inte" },
        { status: 404 }
      )
    }

    const requestedYear = parseReportYear(request.nextUrl.searchParams.get("year"))
    const year = historyRecord?.reportYear ?? requestedYear
    const municipality =
      historyRecord?.municipality ??
      request.nextUrl.searchParams.get("municipality")?.trim()
    const propertyId =
      historyRecord?.propertyId ??
      request.nextUrl.searchParams.get("propertyId")?.trim()
    const reportNotes = parseReportNotes(request.nextUrl.searchParams.get("reportNotes"))
    const signingUser = historyRecord
      ? null
      : await prisma.user.findUnique({
          where: { id: auth.user.userId },
          select: {
            email: true,
            name: true,
          },
        })
    const signing = historyRecord
      ? {
          ok: true as const,
          metadata: buildSigningMetadataFromHistory(historyRecord),
        }
      : signingUser
        ? buildAnnualFgasSigningMetadata({
            searchParams: request.nextUrl.searchParams,
            user: signingUser,
          })
        : {
            ok: false as const,
            errors: ["Inloggad användare hittades inte."],
          }

    if (!year) {
      return NextResponse.json({ error: "Ogiltigt årtal" }, { status: 400 })
    }

    if (!historyRecord && !propertyId) {
      return NextResponse.json(
        { error: "VÃ¤lj en fastighet innan Ã¥rsrapporten exporteras" },
        { status: 400 }
      )
    }

    if (!signing.ok) {
      return NextResponse.json(
        { error: "Ogiltiga signeringsuppgifter", details: signing.errors },
        { status: 400 }
      )
    }

    const artifactId =
      !historyRecord && signing.metadata ? crypto.randomUUID() : null
    const signingMetadataForReport =
      artifactId && signing.metadata
        ? {
            ...signing.metadata,
            signedReportId: artifactId,
          }
        : signing.metadata

    logAnnualReportRoute(requestId, "Building report data", {
      companyId: auth.user.companyId,
      isContractor: isContractor(auth.user),
      municipality: municipality || null,
      propertyId: propertyId || null,
      signed: Boolean(signingMetadataForReport),
      regeneratedFromHistory: Boolean(historyRecord),
      year,
    })

    const report = await buildAnnualFgasReportData({
      companyId: auth.user.companyId,
      assignedContractorId: isContractor(auth.user) ? auth.user.userId : undefined,
      contactUserId: historyRecord?.userId ?? auth.user.userId,
      municipality: municipality || undefined,
      propertyId: propertyId || undefined,
      reportNotes,
      signingMetadata: signingMetadataForReport,
      year,
    })
    logAnnualReportRoute(requestId, "Report data built", {
      certificateCount: report.certificateRegister.length,
      equipmentCount: report.equipment.length,
      leakageControlCount: report.leakageControls.length,
      refrigerantHandlingRows: report.refrigerantHandlingLog.length,
      scrappedEquipmentCount: report.scrappedEquipment.length,
    })

    const artifactScope =
      artifactId && signingMetadataForReport
        ? buildAnnualFgasArtifactScope({
            municipality: municipality || null,
            propertyId: propertyId || null,
            report,
            year,
          })
        : null
    if (artifactId) {
      logAnnualReportRoute(requestId, "Building signed report snapshot", {
        artifactId,
        scopeType: artifactScope?.type ?? null,
        scopeId: artifactScope?.id ?? null,
      })
    }
    const snapshotResult =
      artifactId && artifactScope && signingMetadataForReport
        ? buildAnnualFgasReportSnapshotHash(report, {
            artifactId,
            generatedAt: report.generatedAt,
            scope: artifactScope,
            signingMetadata: signingMetadataForReport,
          })
        : null
    if (snapshotResult) {
      logAnnualReportRoute(requestId, "Signed report snapshot built", {
        artifactId,
        snapshotSchema: snapshotResult.snapshot.snapshotSchema,
        snapshotSha256: snapshotResult.snapshotSha256,
      })
    }

    logAnnualReportRoute(requestId, "Rendering React report template", {
      artifactId,
      signed: Boolean(artifactId),
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
    const filename = buildAnnualFgasReportFilename(report, year)
    let signedHistoryRecord = historyRecord

    if (artifactId && artifactScope && snapshotResult && signingMetadataForReport) {
      logAnnualReportRoute(requestId, "Storing signed report PDF artifact", {
        artifactId,
        byteLength: pdf.length,
      })
      const storedPdf = await storeSignedReportPdfArtifact({
        artifactId,
        companyId: auth.user.companyId,
        fileName: filename,
        pdfBuffer: pdf,
        reportType: "ANNUAL_FGAS",
        reportYear: year,
      })
      logAnnualReportRoute(requestId, "Signed report PDF artifact stored", {
        artifactId,
        pdfSha256: storedPdf.pdfSha256,
        pdfStorageKey: storedPdf.pdfStorageKey,
      })

      try {
        logAnnualReportRoute(requestId, "Building signed annual report metadata", {
          artifactId,
        })
        const signedHistoryData = buildSignedAnnualReportCreateData({
          artifactId,
          companyId: auth.user.companyId,
          userId: auth.user.userId,
          report,
          reportYear: year,
          municipality: municipality || null,
          propertyId: propertyId || null,
        })

        if (!signedHistoryData) {
          throw new Error("Signed annual report metadata could not be built")
        }

        logAnnualReportRoute(requestId, "Persisting signed report artifact records", {
          artifactId,
        })
        signedHistoryRecord = await prisma.$transaction(async (tx) => {
          await tx.signedReportArtifact.create({
            data: {
              id: artifactId,
              companyId: auth.user.companyId,
              signedByUserId: auth.user.userId,
              reportType: "ANNUAL_FGAS",
              scopeType: artifactScope.type,
              scopeId: artifactScope.id ?? null,
              scopeLabel: artifactScope.label ?? null,
              reportYear: year,
              periodStart: report.period.startDate,
              periodEnd: report.period.endDate,
              status: "STORED",
              signingMethod: "FGASPORTAL_ELECTRONIC",
              signerName: signingMetadataForReport.signerName,
              signerEmail: signingMetadataForReport.signerEmail,
              signerRole: signingMetadataForReport.signerRole,
              signingText: signingMetadataForReport.attestationText,
              signedAt: signingMetadataForReport.signingDate,
              pdfStorageKey: storedPdf.pdfStorageKey,
              pdfFileName: storedPdf.pdfFileName,
              pdfContentType: storedPdf.pdfContentType,
              pdfSizeBytes: storedPdf.pdfSizeBytes,
              pdfSha256: storedPdf.pdfSha256,
              snapshot: snapshotResult.snapshot as Prisma.InputJsonValue,
              snapshotSha256: snapshotResult.snapshotSha256,
              snapshotVersion: snapshotResult.snapshot.snapshotVersion,
              snapshotSchema: snapshotResult.snapshot.snapshotSchema,
              templateVersion: ANNUAL_FGAS_TEMPLATE_VERSION,
              rendererVersion: SIGNED_REPORT_RENDERER_VERSION,
            },
          })

          return tx.signedAnnualFgasReport.create({
            data: signedHistoryData,
            include: {
              user: {
                select: {
                  email: true,
                },
              },
            },
          })
        })
        logAnnualReportRoute(requestId, "Signed report artifact records persisted", {
          artifactId,
          signedAnnualReportId: signedHistoryRecord.id,
        })
      } catch (error) {
        logAnnualReportRouteError(requestId, error, {
          artifactId,
          message: "Signed report artifact persistence failed; rolling back stored PDF",
          pdfStorageKey: storedPdf.pdfStorageKey,
        })
        await rollbackStoredSignedReportPdf(storedPdf)
        throw error
      }
    }

    const exportActivityLogId = await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "report_exported",
      entityType: "report",
      entityId: artifactId ?? signedHistoryRecord?.id ?? `annual-fgas-${year}`,
      metadata: {
        reportType: "annual_fgas_control_required_equipment",
        year,
        municipality: municipality || null,
        propertyId: propertyId || null,
        signed: Boolean(signingMetadataForReport),
        signedReportId: signedHistoryRecord?.id ?? null,
        signedReportArtifactId: artifactId,
        signerName: signing.metadata?.signerName ?? null,
        signerEmail: signing.metadata?.signerEmail ?? null,
        regeneratedFromHistory: Boolean(historyRecord),
        format: "pdf",
      },
    })

    let signedActivityLogId: string | null = null
    if (!historyRecord && signedHistoryRecord) {
      signedActivityLogId = await logActivity({
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        action: "annual_report_signed",
        entityType: "report",
        entityId: artifactId ?? signedHistoryRecord.id,
        metadata: {
          reportType: "annual_fgas_control_required_equipment",
          year,
          municipality: municipality || null,
          propertyId: propertyId || null,
          signedReportId: signedHistoryRecord.id,
          signedReportArtifactId: artifactId,
          signerName: signing.metadata?.signerName ?? null,
          signerEmail: signing.metadata?.signerEmail ?? null,
          readinessStatus: report.qualitySummary.status,
          blockingIssueCount: report.qualitySummary.blockingIssueCount,
          reviewWarningCount: report.qualitySummary.warningCount,
        },
      })
    }

    if (artifactId && (exportActivityLogId || signedActivityLogId)) {
      try {
        await prisma.signedReportArtifact.update({
          where: {
            id: artifactId,
          },
          data: {
            exportActivityLogId,
            signedActivityLogId,
          },
        })
      } catch (activityReferenceError) {
        console.error("[annual-fgas-pdf]", {
          message: "Failed to attach activity log references to signed report artifact",
          artifactId,
          error: serializeError(activityReferenceError),
        })
      }
    }
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

    if (error instanceof SignedReportArtifactStorageConfigurationError) {
      return NextResponse.json(
        {
          error:
            "Blob storage är inte konfigurerat. Signerade årsrapporter kräver BLOB_READ_WRITE_TOKEN.",
          code: "SIGNED_REPORT_BLOB_STORAGE_NOT_CONFIGURED",
        },
        {
          status: 500,
          headers: {
            "X-Annual-Fgas-Pdf-Request-Id": requestId,
          },
        }
      )
    }

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

function parseReportNotes(value: string | null) {
  const text = value?.trim()
  if (!text) return null

  return text.slice(0, 2000)
}

function buildAnnualFgasArtifactScope({
  municipality,
  propertyId,
  report,
  year,
}: {
  municipality: string | null
  propertyId: string | null
  report: {
    facility: {
      municipality: string | null
      name: string
      propertyDesignation: string | null
    }
  }
  year: number
}): ReportSnapshotScope {
  if (propertyId) {
    return {
      type: "PROPERTY",
      id: propertyId,
      label: report.facility.name,
      reportYear: year,
      municipality: report.facility.municipality,
      propertyName: report.facility.name,
      propertyDesignation: report.facility.propertyDesignation,
    }
  }

  if (municipality) {
    return {
      type: "MUNICIPALITY",
      id: municipality,
      label: municipality,
      reportYear: year,
      municipality,
      propertyName: report.facility.name,
      propertyDesignation: report.facility.propertyDesignation,
    }
  }

  return {
    type: "COMPANY",
    id: null,
    label: report.facility.name,
    reportYear: year,
    municipality: report.facility.municipality,
    propertyName: report.facility.name,
    propertyDesignation: report.facility.propertyDesignation,
  }
}

async function rollbackStoredSignedReportPdf(
  storedPdf: SignedReportPdfArtifactStorageMetadata
) {
  try {
    await deleteSignedReportPdfArtifact(storedPdf.pdfStorageKey)
  } catch (rollbackError) {
    console.error("[annual-fgas-pdf]", {
      message: "Failed to roll back stored signed report PDF",
      storageKey: storedPdf.pdfStorageKey,
      error: serializeError(rollbackError),
    })
  }
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
    historyId: searchParams.get("historyId"),
    municipality: searchParams.get("municipality"),
    propertyId: searchParams.get("propertyId"),
    signed: searchParams.get("signed"),
    year: searchParams.get("year"),
  }
}
