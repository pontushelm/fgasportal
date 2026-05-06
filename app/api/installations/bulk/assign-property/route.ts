import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

const bulkAssignPropertySchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(500),
  propertyId: z.string().min(1).nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { installationIds, propertyId } = bulkAssignPropertySchema.parse(body)
    const uniqueInstallationIds = Array.from(new Set(installationIds))

    const property = propertyId
      ? await prisma.property.findFirst({
          where: {
            id: propertyId,
            companyId,
          },
          select: {
            id: true,
            name: true,
            municipality: true,
          },
        })
      : null

    if (propertyId && !property) {
      return NextResponse.json(
        { error: "Ogiltig fastighet" },
        { status: 400 }
      )
    }

    const installations = await prisma.installation.findMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId,
        archivedAt: null,
        scrappedAt: null,
      },
      select: {
        id: true,
        name: true,
        propertyId: true,
      },
    })

    if (installations.length !== uniqueInstallationIds.length) {
      return NextResponse.json(
        { error: "Ett eller flera aggregat hittades inte" },
        { status: 400 }
      )
    }

    const changedInstallations = installations.filter(
      (installation) => installation.propertyId !== propertyId
    )
    const changedInstallationIds = changedInstallations.map(
      (installation) => installation.id
    )

    if (changedInstallationIds.length > 0) {
      await prisma.installation.updateMany({
        where: {
          id: {
            in: changedInstallationIds,
          },
          companyId,
          archivedAt: null,
          scrappedAt: null,
        },
        data: {
          propertyId,
        },
      })
    }

    await Promise.all(
      changedInstallations.map((installation) =>
        logActivity({
          companyId,
          installationId: installation.id,
          userId,
          action: propertyId ? "property_assigned" : "property_removed",
          entityType: "installation",
          entityId: installation.id,
          metadata: {
            bulkAction: true,
            previousPropertyId: installation.propertyId,
            propertyId,
            propertyName: property?.name ?? null,
            municipality: property?.municipality ?? null,
            installationName: installation.name,
          },
        })
      )
    )

    return NextResponse.json(
      {
        updated: changedInstallations.length,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Bulk assign property error:", error)

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
