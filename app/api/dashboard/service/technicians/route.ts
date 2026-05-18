import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canManageServicepartnerTechnicianAssignments } from "@/lib/access/installation-access"

export async function GET(request: NextRequest) {
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

    const technicians = await prisma.companyMembership.findMany({
      where: {
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
        isServicePartnerAdmin: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          user: {
            name: "asc",
          },
        },
        {
          user: {
            email: "asc",
          },
        },
      ],
    })

    return NextResponse.json(
      technicians.map((membership) => ({
        membershipId: membership.id,
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        isServicePartnerAdmin: membership.isServicePartnerAdmin,
      })),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get servicepartner technicians error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
