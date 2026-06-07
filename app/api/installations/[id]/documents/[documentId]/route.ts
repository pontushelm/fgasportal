import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { canDeleteInstallationDocument } from "@/lib/document-access"
import {
  buildFutureDocumentLinksFromInstallationDocument,
  buildFutureDocumentMetadataFromInstallationDocument,
} from "@/lib/documents/documentHelpers"
import { logActivity } from "@/lib/activity-log"

type RouteContext = {
  params: Promise<{
    id: string
    documentId: string
  }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id, documentId } = await context.params
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

    const genericDocument = await prisma.document.findFirst({
      where: {
        companyId: auth.user.companyId,
        OR: [
          {
            id: documentId,
          },
          {
            legacyInstallationDocumentId: documentId,
          },
        ],
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
        fileName: true,
        category: true,
        status: true,
        legacyInstallationDocumentId: true,
        links: {
          select: {
            entityType: true,
            entityId: true,
            role: true,
          },
        },
      },
    })

    const legacyDocumentId =
      genericDocument?.legacyInstallationDocumentId &&
      genericDocument.id === documentId
        ? genericDocument.legacyInstallationDocumentId
        : documentId
    const legacyDocument = await prisma.installationDocument.findFirst({
      where: {
        id: legacyDocumentId,
        installationId: installation.id,
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

    if (!genericDocument && !legacyDocument) {
      return NextResponse.json(
        { error: "Dokumentet hittades inte" },
        { status: 404 }
      )
    }

    const permissionRecord = legacyDocument
      ? legacyDocument
      : {
          uploadedById: genericDocument?.uploadedByUserId ?? "",
          installation,
        }

    if (!canDeleteInstallationDocument(auth.user, permissionRecord)) {
      return forbiddenResponse()
    }

    const deletedAt = new Date()
    const deletedDocument = await prisma.$transaction(async (tx) => {
      if (genericDocument) {
        return tx.document.update({
          where: {
            id: genericDocument.id,
          },
          data: {
            status: "DELETED",
            deletedAt,
            deletedByUserId: auth.user.userId,
          },
          select: {
            id: true,
            originalFileName: true,
            fileName: true,
            category: true,
            links: {
              select: {
                entityType: true,
                entityId: true,
                role: true,
              },
            },
          },
        })
      }

      if (!legacyDocument) {
        throw new Error("Legacy document missing for generic tombstone")
      }

      const document = await tx.document.create({
        data: {
          ...buildFutureDocumentMetadataFromInstallationDocument(
            legacyDocument
          ),
          status: "DELETED",
          deletedAt,
          deletedByUserId: auth.user.userId,
        },
        select: {
          id: true,
          originalFileName: true,
          fileName: true,
          category: true,
          links: {
            select: {
              entityType: true,
              entityId: true,
              role: true,
            },
          },
        },
      })

      const links = buildFutureDocumentLinksFromInstallationDocument(
        legacyDocument
      )
      for (const link of links) {
        await tx.documentLink.create({
          data: {
            documentId: document.id,
            ...link,
          },
        })
      }

      return {
        ...document,
        links: links.map((link) => ({
          entityType: link.entityType,
          entityId: link.entityId,
          role: link.role,
        })),
      }
    })
    const installationLink =
      deletedDocument.links.find(
        (link) => link.entityType === "INSTALLATION"
      ) ?? deletedDocument.links[0] ?? null

    await logActivity({
      companyId: auth.user.companyId,
      installationId: id,
      userId: auth.user.userId,
      action: "document_deleted",
      entityType: "document",
      entityId: deletedDocument.id,
      metadata: {
        documentId: deletedDocument.id,
        category: deletedDocument.category,
        fileName: deletedDocument.originalFileName || deletedDocument.fileName,
        entityType: installationLink?.entityType ?? null,
        entityId: installationLink?.entityId ?? null,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: unknown) {
    console.error("Delete installation document error:", error)

    return NextResponse.json(
      { error: "Kunde inte ta bort dokumentet" },
      { status: 500 }
    )
  }
}
