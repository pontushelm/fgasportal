import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { notifyContractorsAboutNewAssignments } from "@/lib/contractor-assignment-notifications"
import { prisma } from "@/lib/db"

const bulkAssignSchema = z.object({
  installationIds: z.array(z.string().min(1)).min(1).max(500),
  servicePartnerCompanyId: z.string().optional().nullable(),
  contractorId: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const { contractorId, servicePartnerCompanyId, installationIds } = bulkAssignSchema.parse(body)
    const uniqueInstallationIds = Array.from(new Set(installationIds))
    const normalizedCompanyId = servicePartnerCompanyId?.trim() || null
    const normalizedContractorId = contractorId?.trim() || null

    const servicePartnerCompany = normalizedCompanyId
      ? await prisma.servicePartnerCompany.findFirst({
          where: {
            id: normalizedCompanyId,
            companyId,
          },
          select: {
            id: true,
            name: true,
          },
        })
      : null

    if (normalizedCompanyId && !servicePartnerCompany) {
      return NextResponse.json(
        { error: "Ogiltigt servicepartnerföretag" },
        { status: 400 }
      )
    }

    const contractorMembership = normalizedContractorId
      ? await prisma.companyMembership.findFirst({
          where: {
            OR: [
              { userId: normalizedContractorId },
              { id: normalizedContractorId },
            ],
            companyId,
            role: "CONTRACTOR",
            isActive: true,
            ...(normalizedCompanyId ? { servicePartnerCompanyId: normalizedCompanyId } : {}),
            user: {
              isActive: true,
            },
          },
          select: {
            servicePartnerCompanyId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : null

    if (normalizedContractorId && !contractorMembership) {
      return NextResponse.json(
        { error: "Ogiltig servicekontakt" },
        { status: 400 }
      )
    }

    const contractor = contractorMembership?.user ?? null
    const targetServicePartnerCompanyId =
      servicePartnerCompany?.id ?? contractorMembership?.servicePartnerCompanyId ?? null

    if (!targetServicePartnerCompanyId && !contractor) {
      return NextResponse.json(
        { error: "Välj servicepartnerföretag eller servicekontakt" },
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
        assignedContractorId: true,
        assignedServicePartnerCompanyId: true,
      },
    })

    if (installations.length !== uniqueInstallationIds.length) {
      const selectedInstallations = await prisma.installation.findMany({
        where: {
          id: {
            in: uniqueInstallationIds,
          },
          companyId,
        },
        select: {
          archivedAt: true,
          scrappedAt: true,
        },
      })
      const hasInactiveInstallations = selectedInstallations.some(
        (installation) => installation.archivedAt || installation.scrappedAt
      )

      return NextResponse.json(
        {
          error: hasInactiveInstallations
            ? "Arkiverade eller skrotade aggregat kan inte tilldelas servicepartner. Välj aktiva aggregat och försök igen."
            : "Ett eller flera aggregat hittades inte. Välj aktiva aggregat och försök igen.",
        },
        { status: 400 }
      )
    }

    const changedInstallations = installations.filter(
      (installation) =>
        installation.assignedContractorId !== (contractor?.id ?? null) ||
        installation.assignedServicePartnerCompanyId !== targetServicePartnerCompanyId
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
          assignedContractorId: contractor?.id ?? null,
          assignedServicePartnerCompanyId: targetServicePartnerCompanyId,
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
            previousAssignedServicePartnerCompanyId:
              installation.assignedServicePartnerCompanyId,
            assignedServicePartnerCompanyId: targetServicePartnerCompanyId,
            servicePartnerCompanyName: servicePartnerCompany?.name,
            contractorId: contractor?.id ?? null,
            contractorName: contractor?.name ?? null,
            contractorEmail: contractor?.email ?? null,
          },
        })
      )
    )

    await notifyContractorsAboutNewAssignments(
      companyId,
      changedInstallationIds.length > 0 && contractor ? [contractor.id] : []
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
