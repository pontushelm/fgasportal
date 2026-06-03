import { get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canAccessInstallationDocuments } from "@/lib/document-access"

type RouteContext = {
  params: Promise<{
    id: string
    documentId: string
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

    const { id, documentId } = await context.params
    const document = await prisma.installationDocument.findFirst({
      where: {
        id: documentId,
        installationId: id,
        companyId: auth.user.companyId,
      },
      include: {
        installation: {
          select: {
            companyId: true,
            assignedContractorId: true,
            assignedServicePartnerCompanyId: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: "Dokumentet hittades inte" },
        { status: 404 }
      )
    }

    if (!canAccessInstallationDocuments(auth.user, document.installation)) {
      return forbiddenResponse()
    }

    const storedDocument = await get(document.blobPath, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (!storedDocument || storedDocument.statusCode !== 200 || !storedDocument.stream) {
      return NextResponse.json(
        { error: "Dokumentet kunde inte hämtas från lagringen" },
        { status: 502 }
      )
    }

    const file = await streamToUint8Array(storedDocument.stream)

    await logActivity({
      companyId: auth.user.companyId,
      installationId: document.installationId,
      userId: auth.user.userId,
      action: "document_downloaded",
      entityType: "document",
      entityId: document.id,
      metadata: {
        documentId: document.id,
        installationId: document.installationId,
        fileName: document.originalFileName,
        documentType: document.documentType,
      },
    })

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFileName(
          document.originalFileName || document.fileName
        )}"`,
        "Content-Type": document.mimeType || "application/octet-stream",
      },
    })
  } catch (error) {
    console.error("Download installation document error:", error)

    return NextResponse.json(
      { error: "Kunde inte hämta dokumentet" },
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

function sanitizeHeaderFileName(value: string) {
  const fileName =
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "dokument"

  return fileName
}
