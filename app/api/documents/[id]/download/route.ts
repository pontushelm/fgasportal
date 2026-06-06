import { get } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolveDocumentAccess } from "@/lib/documents/documentAccess"

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
    const document = await prisma.document.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        companyId: true,
        originalFileName: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        storageKey: true,
        category: true,
        status: true,
        links: {
          select: {
            entityType: true,
            entityId: true,
            role: true,
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

    if (document.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Dokumentet kan inte laddas ner" },
        { status: 410 }
      )
    }

    const access = await resolveDocumentAccess(auth.user, document)
    if (!access.allowed) {
      return forbiddenResponse()
    }

    const storedDocument = await get(document.storageKey, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    if (
      !storedDocument ||
      storedDocument.statusCode !== 200 ||
      !storedDocument.stream
    ) {
      return NextResponse.json(
        { error: "Dokumentet kunde inte hämtas från lagringen" },
        { status: 502 }
      )
    }

    const file = await streamToUint8Array(storedDocument.stream)
    const grantedBy = access.grantedBy ?? document.links[0] ?? null

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "document_downloaded_generic",
      entityType: "document",
      entityId: document.id,
      metadata: {
        documentId: document.id,
        category: document.category,
        entityType: grantedBy?.entityType ?? null,
        entityId: grantedBy?.entityId ?? null,
      },
    })

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${sanitizeHeaderFileName(
          document.originalFileName || document.fileName
        )}"`,
        "Content-Type": document.contentType || "application/octet-stream",
      },
    })
  } catch (error) {
    console.error("Download generic document error:", error)

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
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "dokument"
  )
}
