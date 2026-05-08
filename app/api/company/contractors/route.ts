import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const memberships = await prisma.companyMembership.findMany({
      where: {
        companyId: auth.user.companyId,
        role: "CONTRACTOR",
        isActive: true,
        user: {
          isActive: true,
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
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

    const contractors = memberships.map((membership) => ({
      ...membership.user,
      membershipId: membership.id,
      servicePartnerCompany: membership.servicePartnerCompany,
      certificationStatus: getCertificationStatus({
        isCertifiedCompany: membership.isCertifiedCompany,
        validUntil: membership.certificationValidUntil,
      }),
    }))

    return NextResponse.json(contractors, { status: 200 })
  } catch (error: unknown) {
    console.error("Get contractors error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
