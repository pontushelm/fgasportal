import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { prisma } from "@/lib/db"
import {
  ensureServiceOrganizationForLegacyCompany,
  mapServiceOrganizationRole,
} from "@/lib/service-organizations"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const linkServicePartnerCompanySchema = z.object({
  servicePartnerCompanyId: z.string().min(1).nullable(),
})

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const body = await request.json()
    const { servicePartnerCompanyId } =
      linkServicePartnerCompanySchema.parse(body)

    if (servicePartnerCompanyId) {
      const servicePartnerCompany = await ensureServiceOrganizationForLegacyCompany({
        companyId: auth.user.companyId,
        servicePartnerCompanyId,
      })

      if (!servicePartnerCompany) {
        return NextResponse.json(
          { error: "Serviceföretaget hittades inte" },
          { status: 404 }
        )
      }
    }

    const membership = await prisma.companyMembership.findFirst({
      where: {
        OR: [
          { userId: id },
          { id },
        ],
        companyId: auth.user.companyId,
        role: "CONTRACTOR",
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
        isServicePartnerAdmin: true,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Servicekontakten hittades inte" },
        { status: 404 }
      )
    }

    const updatedMembership = await prisma.companyMembership.update({
      where: {
        id: membership.id,
      },
      data: {
        servicePartnerCompanyId,
      },
      select: {
        id: true,
        isCertifiedCompany: true,
        certificationValidUntil: true,
        servicePartnerCompany: {
          select: {
            id: true,
            name: true,
            organizationNumber: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (servicePartnerCompanyId) {
      const bridge = await ensureServiceOrganizationForLegacyCompany({
        companyId: auth.user.companyId,
        servicePartnerCompanyId,
      })

      if (bridge) {
        await prisma.serviceOrganizationMembership.upsert({
          where: {
            serviceOrganizationId_userId: {
              serviceOrganizationId: bridge.serviceOrganizationId,
              userId: membership.userId,
            },
          },
          create: {
            serviceOrganizationId: bridge.serviceOrganizationId,
            userId: membership.userId,
            role: mapServiceOrganizationRole(membership.isServicePartnerAdmin),
            isActive: true,
          },
          update: {
            role: membership.isServicePartnerAdmin ? "ADMIN" : undefined,
            isActive: true,
          },
        })
      }
    }

    return NextResponse.json(
      {
        ...updatedMembership.user,
        membershipId: updatedMembership.id,
        servicePartnerCompany: updatedMembership.servicePartnerCompany,
        certificationStatus: getCertificationStatus({
          isCertifiedCompany: updatedMembership.isCertifiedCompany,
          validUntil: updatedMembership.certificationValidUntil,
        }),
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Link service partner company error:", error)

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
