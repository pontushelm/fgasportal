import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createInvitationSchema } from "@/lib/validations"

const INVITATION_TTL_DAYS = 7

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId } = auth.user

    const [users, invitations] = await Promise.all([
      prisma.user.findMany({
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "asc",
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
      prisma.invitation.findMany({
        where: {
          companyId,
          acceptedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          invitedByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ])

    return NextResponse.json({ users, invitations }, { status: 200 })
  } catch (error: unknown) {
    console.error("Get company invitations error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId, userId } = auth.user
    const body = await request.json()
    const validatedData = createInvitationSchema.parse(body)
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "En användare med denna e-post finns redan" },
        { status: 400 }
      )
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS)

    const invitation = await prisma.invitation.create({
      data: {
        email: validatedData.email,
        role: validatedData.role,
        token,
        companyId,
        invitedByUserId: userId,
        expiresAt,
      },
    })
    const inviteLink = `${request.nextUrl.origin}/register?invite=${token}`

    return NextResponse.json(
      {
        invitation,
        inviteLink,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create company invitation error:", error)

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
