import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { canManageServicepartnerTechnicianAssignments } from "@/lib/access/installation-access"
import { prisma } from "@/lib/db"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"
import {
  toTechnicianCertificationResponse,
  upsertTechnicianPersonalFgasCertification,
} from "@/lib/technician-certifications"

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

const technicianCertificationSchema = z.object({
  certificateNumber: optionalText(120),
  issuer: optionalText(160),
  category: optionalText(120),
  validUntil: optionalDate(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const { userId: technicianUserId } = await context.params
    const body = await request.json()
    const data = technicianCertificationSchema.parse(body)
    const bridge = await ensureServiceOrganizationForLegacyCompany({
      companyId: auth.user.companyId,
      servicePartnerCompanyId: auth.user.servicePartnerCompanyId!,
    })

    if (!bridge) return forbiddenResponse()

    const technicianMembership = await prisma.serviceOrganizationMembership.findFirst({
      where: {
        serviceOrganizationId: bridge.serviceOrganizationId,
        userId: technicianUserId,
        isActive: true,
        user: {
          isActive: true,
          memberships: {
            some: {
              companyId: auth.user.companyId,
              role: "CONTRACTOR",
              isActive: true,
              servicePartnerCompanyId: auth.user.servicePartnerCompanyId,
            },
          },
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            memberships: {
              where: {
                companyId: auth.user.companyId,
                role: "CONTRACTOR",
                isActive: true,
                servicePartnerCompanyId: auth.user.servicePartnerCompanyId,
              },
              select: {
                id: true,
                certificationNumber: true,
                certificationOrganization: true,
                certificationValidUntil: true,
              },
              take: 1,
            },
          },
        },
      },
    })

    if (!technicianMembership) {
      return NextResponse.json(
        { error: "Teknikern hittades inte inom er serviceorganisation." },
        { status: 404 }
      )
    }

    const legacyMembership = technicianMembership.user.memberships[0]
    if (!legacyMembership) {
      return NextResponse.json(
        { error: "Teknikern saknar aktiv medlemskoppling till servicepartnern." },
        { status: 404 }
      )
    }

    const certification = await prisma.$transaction((tx) =>
      upsertTechnicianPersonalFgasCertification({
        companyId: auth.user.companyId,
        input: data,
        membershipId: legacyMembership.id,
        prisma: tx,
        serviceOrganizationId: bridge.serviceOrganizationId,
        updatedByUserId: auth.user.userId,
        userId: technicianUserId,
      })
    )

    return NextResponse.json(
      toTechnicianCertificationResponse(certification),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Update technician certification error:", error)

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

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null)
}

function optionalDate() {
  return z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || Number.isFinite(new Date(value).getTime()), {
      message: "Ange ett giltigt datum",
    })
    .transform((value) => (value ? new Date(value) : null))
}
