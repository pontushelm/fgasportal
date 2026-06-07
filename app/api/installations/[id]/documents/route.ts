import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { del, put } from "@vercel/blob"
import { prisma } from "@/lib/db"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import {
  canAccessInstallationDocuments,
  canUploadInstallationDocument,
} from "@/lib/document-access"
import {
  buildFutureDocumentLinksFromInstallationDocument,
  buildFutureDocumentMetadataFromInstallationDocument,
  buildGenericDocumentDownloadHref,
} from "@/lib/documents/documentHelpers"
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
      },
      select: {
        id: true,
        companyId: true,
        assignedContractorId: true,
        assignedServicePartnerCompanyId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    if (!canAccessInstallationDocuments(auth.user, installation)) {
      return forbiddenResponse()
    }

    const genericDocuments = await prisma.document.findMany({
      where: {
        companyId: auth.user.companyId,
        status: "ACTIVE",
        links: {
          some: {
            companyId: auth.user.companyId,
            entityType: "INSTALLATION",
            entityId: installation.id,
          },
        },
      },
      select: {
        id: true,
        uploadedByUserId: true,
        originalFileName: true,
        contentType: true,
        sizeBytes: true,
        category: true,
        description: true,
        createdAt: true,
        legacyInstallationDocumentId: true,
        uploadedBy: {
          select: {
            name: true,
            email: true,
          },
        },
        links: {
          select: {
            entityType: true,
            entityId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const eventIds = Array.from(
      new Set(
        genericDocuments.flatMap((document) =>
          document.links
            .filter((link) => link.entityType === "INSTALLATION_EVENT")
            .map((link) => link.entityId)
        )
      )
    )

    const linkedEvents = eventIds.length
      ? await prisma.installationEvent.findMany({
          where: {
            id: {
              in: eventIds,
            },
            installationId: installation.id,
            installation: {
              companyId: auth.user.companyId,
            },
          },
          select: {
            id: true,
            type: true,
            date: true,
          },
        })
      : []
    const eventById = new Map(linkedEvents.map((event) => [event.id, event]))

    const migratedLegacyDocumentIds = genericDocuments
      .map((document) => document.legacyInstallationDocumentId)
      .filter((documentId): documentId is string => Boolean(documentId))

    const legacyDocuments = await prisma.installationDocument.findMany({
      where: {
        installationId: installation.id,
        companyId: auth.user.companyId,
        ...(migratedLegacyDocumentIds.length
          ? {
              id: {
                notIn: migratedLegacyDocumentIds,
              },
            }
          : {}),
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

    const genericDocumentItems = genericDocuments.map((document) => {
      const linkedEventId = document.links.find(
        (link) => link.entityType === "INSTALLATION_EVENT"
      )?.entityId

      return {
        id: document.id,
        uploadedById: document.uploadedByUserId,
        originalFileName: document.originalFileName,
        downloadHref: buildGenericDocumentDownloadHref(document.id),
        mimeType: document.contentType,
        sizeBytes: document.sizeBytes,
        documentType: mapDocumentCategoryToLegacyDocumentType(
          document.category
        ),
        description: document.description,
        createdAt: document.createdAt,
        uploadedBy: document.uploadedBy,
        event: linkedEventId ? eventById.get(linkedEventId) ?? null : null,
      }
    })

    const legacyDocumentItems = legacyDocuments.map((document) => ({
      id: document.id,
      uploadedById: document.uploadedById,
      originalFileName: document.originalFileName,
      downloadHref: buildDocumentDownloadHref(installation.id, document.id),
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      documentType: document.documentType,
      description: document.description,
      createdAt: document.createdAt,
      uploadedBy: document.uploadedBy,
      event: document.event,
    }))

    return NextResponse.json(
      [...genericDocumentItems, ...legacyDocumentItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
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
        assignedServicePartnerCompanyId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
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
      document = await prisma.$transaction(async (tx) => {
        const legacyDocument = await tx.installationDocument.create({
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

        const genericDocument = await tx.document.create({
          data: buildFutureDocumentMetadataFromInstallationDocument(
            legacyDocument
          ),
        })

        for (const link of buildFutureDocumentLinksFromInstallationDocument(
          legacyDocument
        )) {
          await tx.documentLink.create({
            data: {
              documentId: genericDocument.id,
              ...link,
            },
          })
        }

        return legacyDocument
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
        downloadHref: buildDocumentDownloadHref(installation.id, document.id),
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

function buildDocumentDownloadHref(installationId: string, documentId: string) {
  return `/api/installations/${encodeURIComponent(
    installationId
  )}/documents/${encodeURIComponent(documentId)}/download`
}

function mapDocumentCategoryToLegacyDocumentType(
  category: string
): DocumentTypeValue {
  if (isLegacyDocumentType(category)) return category
  return "OTHER"
}

function isLegacyDocumentType(value: string): value is DocumentTypeValue {
  return DOCUMENT_TYPES.includes(value as DocumentTypeValue)
}
