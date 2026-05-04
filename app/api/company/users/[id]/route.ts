import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const { id } = await params

    if (id === auth.user.userId) {
      return NextResponse.json(
        { error: "Du kan inte ta bort dig själv" },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Användaren hittades inte" },
        { status: 404 }
      )
    }

    if (targetUser.role === "OWNER") {
      const activeOwnerCount = await prisma.user.count({
        where: {
          companyId: auth.user.companyId,
          role: "OWNER",
          isActive: true,
        },
      })

      if (targetUser.isActive && activeOwnerCount <= 1) {
        return NextResponse.json(
          { error: "Företaget måste ha minst en ägare" },
          { status: 400 }
        )
      }
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: {
          id: targetUser.id,
        },
        data: {
          isActive: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.companyMembership.updateMany({
        where: {
          userId: targetUser.id,
          companyId: auth.user.companyId,
        },
        data: {
          isActive: false,
        },
      }),
    ])

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "user_removed",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        targetUserEmail: updatedUser.email,
        targetUserName: updatedUser.name,
        previousRole: targetUser.role,
        removalType: "deactivated",
      },
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    console.error("Remove company user error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
