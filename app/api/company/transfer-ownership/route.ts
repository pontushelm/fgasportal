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
    const auth = await authenticateApiRequest(request)
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

    const targetMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: targetUserId,
        companyId: auth.user.companyId,
        isActive: true,
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
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

    const previousMembership = auth.user.membershipId
      ? await prisma.companyMembership.findFirst({
          where: {
            id: auth.user.membershipId,
            userId: auth.user.userId,
            companyId: auth.user.companyId,
          },
          select: {
            id: true,
            userId: true,
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
      : await prisma.companyMembership.findFirst({
          where: {
            userId: auth.user.userId,
            companyId: auth.user.companyId,
          },
          select: {
            id: true,
            userId: true,
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

    if (!previousMembership) {
      return NextResponse.json(
        { error: "Företagskopplingen hittades inte" },
        { status: 404 }
      )
    }

    const [newOwnerUser, previousOwnerUser] = await prisma.$transaction(
      async (tx) => {
        await tx.companyMembership.update({
          where: {
            id: targetMembership.id,
          },
          data: {
            role: "OWNER",
          },
        })
        await tx.companyMembership.update({
          where: {
            id: previousMembership.id,
          },
          data: {
            role: "ADMIN",
          },
        })

        const newOwner =
          targetMembership.user.companyId === auth.user.companyId
            ? await tx.user.update({
                where: {
                  id: targetMembership.userId,
                },
                data: {
                  role: "OWNER",
                },
                select: userResponseSelect,
              })
            : targetMembership.user
        const previousOwner =
          previousMembership.user.companyId === auth.user.companyId
            ? await tx.user.update({
                where: {
                  id: auth.user.userId,
                },
                data: {
                  role: "ADMIN",
                },
                select: userResponseSelect,
              })
            : previousMembership.user

        return [newOwner, previousOwner]
      }
    )
    const newOwner = { ...newOwnerUser, role: "OWNER" }
    const previousOwner = { ...previousOwnerUser, role: "ADMIN" }

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
      value: generateToken(
        previousOwner.id,
        auth.user.companyId,
        previousOwner.role,
        previousMembership.id
      ),
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

const userResponseSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
} as const
