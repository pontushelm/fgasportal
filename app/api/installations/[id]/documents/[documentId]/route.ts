import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { prisma } from "@/lib/db"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { canDeleteInstallationDocument } from "@/lib/document-access"

type RouteContext = {
  params: Promise<{
    id: string
    documentId: string
  }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = authenticateApiRequest(request)
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

    if (!canDeleteInstallationDocument(auth.user, document)) {
      return forbiddenResponse()
    }

    await del(document.blobPath || document.fileUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    await prisma.installationDocument.delete({
      where: {
        id: document.id,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: unknown) {
    console.error("Delete installation document error:", error)

    return NextResponse.json(
      { error: "Kunde inte ta bort dokumentet från Blob storage" },
      { status: 500 }
    )
  }
}
