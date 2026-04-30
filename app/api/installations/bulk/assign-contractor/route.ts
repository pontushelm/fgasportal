import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const bulkAssignSchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(500),
  contractorId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { contractorId, installationIds } = bulkAssignSchema.parse(body)
    const uniqueInstallationIds = Array.from(new Set(installationIds))

    const contractor = await prisma.user.findFirst({
      where: {
        id: contractorId,
        companyId,
        role: "CONTRACTOR",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!contractor) {
      return NextResponse.json(
        { error: "Ogiltig servicepartner" },
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

    await prisma.installation.updateMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId,
        archivedAt: null,
      },
      data: {
        assignedContractorId: contractor.id,
      },
    })

    await Promise.all(
      installations.map((installation) =>
        logActivity({
          companyId,
          installationId: installation.id,
          userId,
          action: "service_partner_assigned",
          entityType: "installation",
          entityId: installation.id,
          metadata: {
            bulkAction: true,
            contractorId: contractor.id,
            contractorName: contractor.name,
            contractorEmail: contractor.email,
          },
        })
      )
    )

    return NextResponse.json(
      {
        updated: installations.length,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Bulk assign contractor error:", error)

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
