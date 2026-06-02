import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"
import { getSignedReportPdfArtifact } from "@/lib/reports/reportArtifactStorage"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const artifact = await prisma.signedReportArtifact.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
        ...(isContractor(auth.user)
          ? {
              annualFgasReport: {
                userId: auth.user.userId,
              },
            }
          : {}),
      },
      select: {
        id: true,
        companyId: true,
        reportType: true,
        reportYear: true,
        scopeLabel: true,
        status: true,
        pdfStorageKey: true,
        pdfFileName: true,
        pdfContentType: true,
        annualFgasReport: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    })

    if (!artifact) {
      return NextResponse.json(
        { error: "Signerad rapport hittades inte" },
        { status: 404 }
      )
    }

    if (artifact.reportType === "ANNUAL_FGAS" && !artifact.annualFgasReport) {
      return NextResponse.json(
        { error: "Signerad årsrapport saknar årsrapportmetadata" },
        { status: 404 }
      )
    }

    if (
      (artifact.status !== "STORED" && artifact.status !== "SUPERSEDED") ||
      !artifact.pdfStorageKey
    ) {
      return NextResponse.json(
        { error: "Signerad PDF finns inte sparad för den här rapporten" },
        { status: 409 }
      )
    }

    const storedPdf = await getSignedReportPdfArtifact(artifact.pdfStorageKey)
    if (!storedPdf || storedPdf.statusCode !== 200 || !storedPdf.stream) {
      return NextResponse.json(
        { error: "Signerad PDF kunde inte hämtas från lagringen" },
        { status: 502 }
      )
    }

    const pdf = await streamToUint8Array(storedPdf.stream)
    const fileName = artifact.pdfFileName || buildFallbackFileName(artifact)

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "signed_report_downloaded",
      entityType: "signed_report_artifact",
      entityId: artifact.id,
      metadata: {
        reportType: artifact.reportType,
        reportYear: artifact.reportYear,
        annualReportId: artifact.annualFgasReport?.id ?? null,
      },
    })

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFileName(fileName)}"`,
        "Content-Type": artifact.pdfContentType || "application/pdf",
      },
    })
  } catch (error) {
    console.error("Download signed report artifact error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta signerad PDF" },
      { status: 500 }
    )
  }
}

async function streamToUint8Array(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.byteLength
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

function buildFallbackFileName(artifact: {
  reportType: string
  reportYear: number | null
  scopeLabel: string | null
}) {
  const year = artifact.reportYear ?? new Date().getFullYear()
  const scope = artifact.scopeLabel ? `-${safeFileNameSegment(artifact.scopeLabel)}` : ""

  if (artifact.reportType === "ANNUAL_FGAS") {
    return `fgas-arsrapport-${year}${scope}-signerad.pdf`
  }

  return `signerad-rapport-${year}${scope}.pdf`
}

function safeFileNameSegment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "rapport"
  )
}

function sanitizeHeaderFileName(value: string) {
  const fileName = safeFileNameSegment(value)
  return fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`
}
