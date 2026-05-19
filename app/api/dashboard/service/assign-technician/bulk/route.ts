import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { canManageServicepartnerTechnicianAssignments } from "@/lib/access/installation-access"
import { prisma } from "@/lib/db"
import { canAssignServicepartnerTechnician } from "@/lib/servicepartner-technician-assignment"

const bulkAssignTechnicianSchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(200),
  technicianId: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    if (
      !canManageServicepartnerTechnicianAssignments(
        auth.user,
        auth.user.servicePartnerCompanyId
      )
    ) {
      return forbiddenResponse()
    }

    const body = await request.json()
    const { installationIds, technicianId } =
      bulkAssignTechnicianSchema.parse(body)
    const normalizedTechnicianId = technicianId?.trim() || null
    const uniqueInstallationIds = Array.from(new Set(installationIds))

    const installations = await prisma.installation.findMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId: auth.user.companyId,
        assignedServicePartnerCompanyId:
          auth.user.servicePartnerCompanyId ?? "__none__",
        archivedAt: null,
        scrappedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        assignedServicePartnerCompanyId: true,
      },
    })

    if (installations.length !== uniqueInstallationIds.length) {
      return NextResponse.json(
        {
          error:
            "Ett eller flera aggregat hittades inte eller tillhör inte ert servicepartnerföretag.",
        },
        { status: 404 }
      )
    }

    const technicianMembership = normalizedTechnicianId
      ? await prisma.companyMembership.findFirst({
          where: {
            OR: [{ userId: normalizedTechnicianId }, { id: normalizedTechnicianId }],
            companyId: auth.user.companyId,
            role: "CONTRACTOR",
            isActive: true,
            servicePartnerCompanyId: auth.user.servicePartnerCompanyId,
            user: {
              isActive: true,
            },
          },
          select: {
            id: true,
            userId: true,
            companyId: true,
            role: true,
            isActive: true,
            servicePartnerCompanyId: true,
            isServicePartnerAdmin: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
              },
            },
          },
        })
      : null

    if (normalizedTechnicianId && !technicianMembership) {
      return NextResponse.json(
        { error: "Teknikern hittades inte inom ert servicepartnerföretag." },
        { status: 400 }
      )
    }

    const canAssignAll = installations.every((installation) =>
      canAssignServicepartnerTechnician({
        user: auth.user,
        installation,
        technicianMembership,
      })
    )

    if (!canAssignAll) return forbiddenResponse()

    const updated = await prisma.installation.updateMany({
      where: {
        id: {
          in: uniqueInstallationIds,
        },
        companyId: auth.user.companyId,
      },
      data: {
        assignedContractorId: technicianMembership?.userId ?? null,
      },
    })

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "service_partner_technician_bulk_assigned",
      entityType: "installation",
      metadata: {
        installationIds: uniqueInstallationIds,
        assignedContractorId: technicianMembership?.userId ?? null,
        assignedServicePartnerCompanyId: auth.user.servicePartnerCompanyId,
      },
    })

    return NextResponse.json(
      {
        updated: updated.count,
        assignedContractorId: technicianMembership?.userId ?? null,
        assignedContractor: technicianMembership?.user
          ? {
              id: technicianMembership.user.id,
              name: technicianMembership.user.name,
              email: technicianMembership.user.email,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Bulk assign servicepartner technician error:", error)

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
