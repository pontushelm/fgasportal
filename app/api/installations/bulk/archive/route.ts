import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const bulkArchiveSchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(500),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { installationIds } = bulkArchiveSchema.parse(body)
    const uniqueInstallationIds = Array.from(new Set(installationIds))

    const installations = await prisma.installation.findMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (installations.length !== uniqueInstallationIds.length) {
      return NextResponse.json(
        { error: "Ett eller flera aggregat hittades inte" },
        { status: 400 }
      )
    }

    const archivedAt = new Date()

    await prisma.installation.updateMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId,
        archivedAt: null,
      },
      data: {
        archivedAt,
      },
    })

    await Promise.all(
      installations.map((installation) =>
        logActivity({
          companyId,
          installationId: installation.id,
          userId,
          action: "installation_archived",
          entityType: "installation",
          entityId: installation.id,
          metadata: {
            bulkAction: true,
            archivedAt: archivedAt.toISOString(),
            name: installation.name,
          },
        })
      )
    )

    return NextResponse.json(
      {
        archived: installations.length,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Bulk archive installations error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
