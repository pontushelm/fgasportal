import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { del, put } from "@vercel/blob"
import { prisma } from "@/lib/db"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import {
  canAccessInstallationDocuments,
  canUploadInstallationDocument,
} from "@/lib/document-access"
import { logActivity } from "@/lib/activity-log"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const DOCUMENT_TYPES = [
  "INSPECTION_REPORT",
  "SERVICE_REPORT",
  "LEAK_REPORT",
  "PHOTO",
  "AUTHORITY_DOCUMENT",
  "OTHER",
] as const
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
        archivedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        assignedContractorId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    if (!canAccessInstallationDocuments(auth.user, installation)) {
      return forbiddenResponse()
    }

    const documents = await prisma.installationDocument.findMany({
      where: {
        installationId: installation.id,
        companyId: auth.user.companyId,
      },
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            type: true,
            date: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(
      documents.map((document) => ({
        id: document.id,
        uploadedById: document.uploadedById,
        originalFileName: document.originalFileName,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        documentType: document.documentType,
        description: document.description,
        createdAt: document.createdAt,
        uploadedBy: document.uploadedBy,
        event: document.event,
      })),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("List installation documents error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
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
        archivedAt: null,
        scrappedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        assignedContractorId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    if (!canUploadInstallationDocument(auth.user, installation)) {
      return forbiddenResponse()
    }

    const formData = await request.formData()
    const file = formData.get("file")
    const documentType = formData.get("documentType")
    const description = formData.get("description")
    const eventId = formData.get("eventId")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fil saknas" }, { status: 400 })
    }

    if (!isDocumentType(documentType)) {
      return NextResponse.json(
        { error: "Ogiltig dokumenttyp" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Filen får vara max 10 MB" },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Filtypen stöds inte" },
        { status: 400 }
      )
    }

    const normalizedEventId = normalizeFormString(eventId)
    if (normalizedEventId) {
      const linkedEvent = await prisma.installationEvent.findFirst({
        where: {
          id: normalizedEventId,
          installationId: installation.id,
          installation: {
            companyId: auth.user.companyId,
          },
        },
        select: {
          id: true,
        },
      })

      if (!linkedEvent) {
        return NextResponse.json(
          { error: "Ogiltig kopplad händelse" },
          { status: 400 }
        )
      }
    }

    const documentId = randomUUID()
    const fileName = safeFileName(file.name)
    const path = `companies/${auth.user.companyId}/installations/${installation.id}/documents/${documentId}-${fileName}`
    const blob = await put(path, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    let document
    try {
      document = await prisma.installationDocument.create({
        data: {
          id: documentId,
          installationId: installation.id,
          eventId: normalizedEventId,
          companyId: auth.user.companyId,
          uploadedById: auth.user.userId,
          fileName,
          originalFileName: file.name,
          fileUrl: blob.url,
          blobPath: blob.pathname,
          mimeType: file.type,
          sizeBytes: file.size,
          documentType,
          description: normalizeFormString(description),
        },
        include: {
          uploadedBy: {
            select: {
              name: true,
              email: true,
            },
          },
          event: {
            select: {
              id: true,
              type: true,
              date: true,
            },
          },
        },
      })
    } catch (error) {
      await del(blob.pathname, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      throw error
    }

    await logActivity({
      companyId: auth.user.companyId,
      installationId: installation.id,
      userId: auth.user.userId,
      action: "document_uploaded",
      entityType: "document",
      entityId: document.id,
      metadata: {
        fileName: document.originalFileName,
        documentType: document.documentType,
        eventId: document.eventId,
      },
    })

    return NextResponse.json(
      {
        id: document.id,
        uploadedById: document.uploadedById,
        originalFileName: document.originalFileName,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        documentType: document.documentType,
        description: document.description,
        createdAt: document.createdAt,
        uploadedBy: document.uploadedBy,
        event: document.event,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Upload installation document error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function isDocumentType(value: FormDataEntryValue | null): value is DocumentTypeValue {
  return typeof value === "string" && DOCUMENT_TYPES.includes(value as DocumentTypeValue)
}

function normalizeFormString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "dokument"
}
