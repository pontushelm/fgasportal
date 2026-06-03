import { get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { canAccessInstallation } from "@/lib/access/installation-access"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"

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

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Blob storage är inte konfigurerat" },
        { status: 500 }
      )
    }

    const { id } = await context.params
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        companyId: true,
        assignedContractorId: true,
        assignedServicePartnerCompanyId: true,
        scrapCertificateBlobPath: true,
        scrapCertificateFileName: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    if (!canAccessInstallation(auth.user, installation)) {
      return forbiddenResponse()
    }

    if (!installation.scrapCertificateBlobPath) {
      return NextResponse.json(
        { error: "Skrotningsintyg saknas" },
        { status: 404 }
      )
    }

    const storedCertificate = await get(installation.scrapCertificateBlobPath, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (
      !storedCertificate ||
      storedCertificate.statusCode !== 200 ||
      !storedCertificate.stream
    ) {
      return NextResponse.json(
        { error: "Skrotningsintyget kunde inte hämtas från lagringen" },
        { status: 502 }
      )
    }

    const file = await streamToUint8Array(storedCertificate.stream)
    const fileName =
      installation.scrapCertificateFileName || "skrotningsintyg.pdf"

    await logActivity({
      companyId: auth.user.companyId,
      installationId: installation.id,
      userId: auth.user.userId,
      action: "scrap_certificate_downloaded",
      entityType: "installation",
      entityId: installation.id,
      metadata: {
        installationId: installation.id,
        fileName,
        blobPath: installation.scrapCertificateBlobPath,
      },
    })

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFileName(
          fileName
        )}"`,
        "Content-Type": inferContentType(fileName),
      },
    })
  } catch (error) {
    console.error("Download scrap certificate error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta skrotningsintyget" },
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

function inferContentType(fileName: string) {
  const normalizedName = fileName.toLowerCase()
  if (normalizedName.endsWith(".pdf")) return "application/pdf"
  if (normalizedName.endsWith(".png")) return "image/png"
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) {
    return "image/jpeg"
  }
  if (normalizedName.endsWith(".webp")) return "image/webp"

  return "application/octet-stream"
}

function sanitizeHeaderFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "skrotningsintyg"
  )
}
