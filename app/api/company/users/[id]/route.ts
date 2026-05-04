import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const { id } = await params

    if (id === auth.user.userId) {
      return NextResponse.json(
        { error: "Du kan inte ta bort dig själv" },
        { status: 400 }
      )
    }

    const targetMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        isActive: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            companyId: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    })

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Användaren hittades inte" },
        { status: 404 }
      )
    }

    if (targetMembership.role === "OWNER") {
      const activeOwnerCount = await prisma.companyMembership.count({
        where: {
          companyId: auth.user.companyId,
          role: "OWNER",
          isActive: true,
          user: {
            isActive: true,
          },
        },
      })

      if (targetMembership.isActive && activeOwnerCount <= 1) {
        return NextResponse.json(
          { error: "Företaget måste ha minst en ägare" },
          { status: 400 }
        )
      }
    }

    const shouldSyncLegacyUser =
      targetMembership.user.companyId === auth.user.companyId
    const updatedUser = shouldSyncLegacyUser
      ? await prisma.$transaction(async (tx) => {
          const user = await tx.user.update({
            where: {
              id: targetMembership.userId,
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
          })

          await tx.companyMembership.update({
            where: {
              id: targetMembership.id,
            },
            data: {
              isActive: false,
            },
          })

          return user
        })
      : await prisma.$transaction(async (tx) => {
          await tx.companyMembership.update({
            where: {
              id: targetMembership.id,
            },
            data: {
              isActive: false,
            },
          })

          return targetMembership.user
        })
    const responseUser = {
      ...updatedUser,
      role: targetMembership.role,
      isActive: false,
    }

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "user_removed",
      entityType: "user",
      entityId: responseUser.id,
      metadata: {
        targetUserEmail: responseUser.email,
        targetUserName: responseUser.name,
        previousRole: targetMembership.role,
        removalType: "deactivated",
      },
    })

    return NextResponse.json(responseUser, { status: 200 })
  } catch (error) {
    console.error("Remove company user error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
