import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { COMPANY_SETTINGS_ASSIGNABLE_ROLES } from "@/lib/company-settings-users"
import { prisma } from "@/lib/db"

const updateUserRoleSchema = z.object({
  role: z.enum(COMPANY_SETTINGS_ASSIGNABLE_ROLES),
})

export async function PATCH(
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
        { error: "Du kan inte ändra din egen roll här" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validation = updateUserRoleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: "Ogiltig roll" }, { status: 400 })
    }

    const targetMembership = await prisma.companyMembership.findFirst({
      where: {
        companyId: auth.user.companyId,
        userId: id,
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
              role: validation.data.role,
            },
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          })

          await tx.companyMembership.update({
            where: {
              id: targetMembership.id,
            },
            data: {
              role: validation.data.role,
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
              role: validation.data.role,
            },
          })

          return targetMembership.user
        })
    const responseUser = {
      ...updatedUser,
      role: validation.data.role,
    }

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "user_role_changed",
      entityType: "user",
      entityId: responseUser.id,
      metadata: {
        targetUserEmail: responseUser.email,
        targetUserName: responseUser.name,
        previousRole: targetMembership.role,
        newRole: responseUser.role,
      },
    })

    return NextResponse.json(responseUser, { status: 200 })
  } catch (error) {
    console.error("Update company user role error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
