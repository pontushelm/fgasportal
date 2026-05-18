import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"
import { canAssignServicepartnerTechnician } from "@/lib/servicepartner-technician-assignment"

const assignTechnicianSchema = z.object({
  installationId: z.string().min(1),
  technicianId: z.string().optional().nullable(),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const { installationId, technicianId } = assignTechnicianSchema.parse(body)
    const normalizedTechnicianId = technicianId?.trim() || null

    const installation = await prisma.installation.findFirst({
      where: {
        id: installationId,
        companyId: auth.user.companyId,
        assignedServicePartnerCompanyId: auth.user.servicePartnerCompanyId ?? "__none__",
        archivedAt: null,
        scrappedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        assignedContractorId: true,
        assignedServicePartnerCompanyId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte eller tillhör inte ert servicepartnerföretag." },
        { status: 404 }
      )
    }

    const technicianMembership = normalizedTechnicianId
      ? await prisma.companyMembership.findFirst({
          where: {
            OR: [
              { userId: normalizedTechnicianId },
              { id: normalizedTechnicianId },
            ],
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

    if (
      !canAssignServicepartnerTechnician({
        user: auth.user,
        installation,
        technicianMembership,
      })
    ) {
      return forbiddenResponse()
    }

    if (normalizedTechnicianId && !technicianMembership) {
      return NextResponse.json(
        { error: "Teknikern hittades inte inom ert servicepartnerföretag." },
        { status: 400 }
      )
    }

    const updatedInstallation = await prisma.installation.update({
      where: {
        id: installation.id,
      },
      data: {
        assignedContractorId: technicianMembership?.userId ?? null,
      },
      select: {
        id: true,
        assignedContractorId: true,
        assignedContractor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await logActivity({
      companyId: auth.user.companyId,
      installationId: installation.id,
      userId: auth.user.userId,
      action: "service_partner_technician_assigned",
      entityType: "installation",
      entityId: installation.id,
      metadata: {
        previousAssignedContractorId: installation.assignedContractorId,
        assignedContractorId: updatedInstallation.assignedContractorId,
        assignedServicePartnerCompanyId:
          installation.assignedServicePartnerCompanyId,
      },
    })

    return NextResponse.json(
      {
        installationId: updatedInstallation.id,
        assignedContractorId: updatedInstallation.assignedContractorId,
        assignedContractor: updatedInstallation.assignedContractor,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Assign servicepartner technician error:", error)

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
