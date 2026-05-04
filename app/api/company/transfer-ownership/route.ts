import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logActivity } from "@/lib/activity-log"
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  authenticateApiRequest,
  forbiddenResponse,
  generateToken,
} from "@/lib/auth"
import { prisma } from "@/lib/db"

const transferOwnershipSchema = z.object({
  targetUserId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const body = await request.json()
    const validation = transferOwnershipSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Ogiltig användare" },
        { status: 400 }
      )
    }

    const { targetUserId } = validation.data

    if (targetUserId === auth.user.userId) {
      return NextResponse.json(
        { error: "Du kan inte överföra ägarskap till dig själv" },
        { status: 400 }
      )
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: auth.user.companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "Användaren hittades inte" },
        { status: 404 }
      )
    }

    const [newOwner, previousOwner] = await prisma.$transaction([
      prisma.user.update({
        where: {
          id: targetUser.id,
        },
        data: {
          role: "OWNER",
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
      prisma.user.update({
        where: {
          id: auth.user.userId,
        },
        data: {
          role: "ADMIN",
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
          role: "OWNER",
        },
      }),
      prisma.companyMembership.updateMany({
        where: {
          userId: auth.user.userId,
          companyId: auth.user.companyId,
        },
        data: {
          role: "ADMIN",
        },
      }),
    ])

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "ownership_transferred",
      entityType: "user",
      entityId: newOwner.id,
      metadata: {
        previousOwnerEmail: previousOwner.email,
        previousOwnerName: previousOwner.name,
        newOwnerEmail: newOwner.email,
        newOwnerName: newOwner.name,
      },
    })

    const response = NextResponse.json(
      {
        newOwner,
        previousOwner,
      },
      { status: 200 }
    )

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: generateToken(previousOwner.id, auth.user.companyId, previousOwner.role),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Transfer ownership error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
