import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const updateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "CONTRACTOR"]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const { id } = await params
    const body = await request.json()
    const validation = updateUserRoleSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Ogiltig roll" },
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

    const updatedUser = await prisma.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        role: validation.data.role,
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

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "user_role_changed",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        targetUserEmail: updatedUser.email,
        targetUserName: updatedUser.name,
        previousRole: targetUser.role,
        newRole: updatedUser.role,
      },
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    console.error("Update company user role error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
