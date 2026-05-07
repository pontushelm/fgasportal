import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isContractor } from "@/lib/auth"
import { prisma } from "@/lib/db"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
        archivedAt: null,
      },
      select: {
        id: true,
        assignedContractorId: true,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    if (
      isContractor(auth.user) &&
      installation.assignedContractorId !== auth.user.userId
    ) {
      return forbiddenResponse()
    }

    const activity = await prisma.activityLog.findMany({
      where: {
        companyId: auth.user.companyId,
        installationId: installation.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    })

    return NextResponse.json(
      activity.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        user: entry.user,
      })),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get installation activity error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
