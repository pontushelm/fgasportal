import { del } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isValidPermanentDeleteConfirmation } from "@/lib/installations/permanent-delete"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const { id } = await context.params
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        equipmentId: true,
        scrapCertificateBlobPath: true,
        documents: {
          select: {
            blobPath: true,
          },
        },
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirmation?: unknown
    }

    if (!isValidPermanentDeleteConfirmation(body.confirmation, installation)) {
      return NextResponse.json(
        {
          error:
            "Bekräfta permanent borttagning genom att skriva aggregatets ID eller namn.",
        },
        { status: 400 }
      )
    }

    const blobPaths = [
      installation.scrapCertificateBlobPath,
      ...installation.documents.map((document) => document.blobPath),
    ].filter((path): path is string => Boolean(path))
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    if (blobPaths.length > 0) {
      if (!blobToken) {
        return NextResponse.json(
          {
            error:
              "Aggregatet har dokument. Blob storage måste vara konfigurerat för permanent borttagning.",
          },
          { status: 400 }
        )
      }

      for (const blobPath of blobPaths) {
        await del(blobPath, {
          token: blobToken,
        })
      }
    }

    await prisma.installation.delete({
      where: {
        id: installation.id,
      },
    })

    return NextResponse.json({ deleted: true }, { status: 200 })
  } catch (error: unknown) {
    console.error("Permanent delete installation error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
