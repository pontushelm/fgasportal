import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { notifyContractorsAboutNewAssignments } from "@/lib/contractor-assignment-notifications"
import { prisma } from "@/lib/db"

const bulkAssignSchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(500),
  contractorId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { contractorId, installationIds } = bulkAssignSchema.parse(body)
    const uniqueInstallationIds = Array.from(new Set(installationIds))

    const contractorMembership = await prisma.companyMembership.findFirst({
      where: {
        OR: [
          { userId: contractorId },
          { id: contractorId },
        ],
        companyId,
        role: "CONTRACTOR",
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!contractorMembership) {
      return NextResponse.json(
        { error: "Ogiltig servicepartner" },
        { status: 400 }
      )
    }
    const contractor = contractorMembership.user

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
        assignedContractorId: true,
      },
    })

    if (installations.length !== uniqueInstallationIds.length) {
      return NextResponse.json(
        { error: "Ett eller flera aggregat hittades inte" },
        { status: 400 }
      )
    }

    const changedInstallations = installations.filter(
      (installation) => installation.assignedContractorId !== contractor.id
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
        },
        data: {
          assignedContractorId: contractor.id,
        },
      })
    }

    await Promise.all(
      changedInstallations.map((installation) =>
        logActivity({
          companyId,
          installationId: installation.id,
          userId,
          action: "service_partner_assigned",
          entityType: "installation",
          entityId: installation.id,
          metadata: {
            bulkAction: true,
            previousAssignedContractorId: installation.assignedContractorId,
            contractorId: contractor.id,
            contractorName: contractor.name,
            contractorEmail: contractor.email,
          },
        })
      )
    )

    await notifyContractorsAboutNewAssignments(
      companyId,
      changedInstallationIds.length > 0 ? [contractor.id] : []
    )

    return NextResponse.json(
      {
        updated: changedInstallations.length,
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
