import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { logActivity } from "@/lib/activity-log"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { COMPANY_SETTINGS_USER_ROLES } from "@/lib/company-settings-users"
import { prisma } from "@/lib/db"
import { sendInvitationEmail } from "@/lib/email"
import {
  canInviteInternalUsers,
  canInviteServicePartners,
} from "@/lib/roles"
import { createInvitationSchema } from "@/lib/validations"

const INVITATION_TTL_DAYS = 7

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { companyId } = auth.user

    const [memberships, invitations] = await Promise.all([
      prisma.companyMembership.findMany({
        where: {
          companyId,
          isActive: true,
          role: {
            in: [...COMPANY_SETTINGS_USER_ROLES],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          role: true,
          isActive: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.invitation.findMany({
        where: {
          companyId,
          acceptedAt: null,
          role: {
            not: "CONTRACTOR",
          },
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

    const users = memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      isActive: membership.isActive && membership.user.isActive,
      createdAt: membership.user.createdAt,
    }))

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
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const body = await request.json()
    const validatedData = createInvitationSchema.parse(body)
    const isServicePartnerInvite = validatedData.role === "CONTRACTOR"

    if (
      isServicePartnerInvite
        ? !canInviteServicePartners(auth.user.role)
        : !canInviteInternalUsers(auth.user.role)
    ) {
      return forbiddenResponse()
    }
    const existingUser = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        companyId: true,
      },
    })

    if (existingUser) {
      const existingMembership = await prisma.companyMembership.findUnique({
        where: {
          userId_companyId: {
            userId: existingUser.id,
            companyId,
          },
        },
      })

      if (existingUser.companyId === companyId || existingMembership) {
        return NextResponse.json(
          { error: "Användaren tillhör redan detta företag" },
          { status: 400 }
        )
      }

      try {
        const membership = await prisma.companyMembership.create({
          data: {
            userId: existingUser.id,
            companyId,
            role: validatedData.role,
            isActive: true,
          },
        })

        await logActivity({
          companyId,
          userId,
          action: "user_added_to_company",
          entityType: "user",
          entityId: existingUser.id,
          metadata: {
            targetUserEmail: existingUser.email,
            targetUserName: existingUser.name,
            role: validatedData.role,
            membershipId: membership.id,
          },
        })

        return NextResponse.json(
          {
            message: "Användaren har lagts till i företaget",
            membership,
          },
          { status: 201 }
        )
      } catch (error) {
        if (isUniqueMembershipError(error)) {
          return NextResponse.json(
            { error: "Användaren tillhör redan detta företag" },
            { status: 400 }
          )
        }

        throw error
      }
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
    const company = await prisma.company.findUnique({
      where: {
        id: companyId,
      },
      select: {
        name: true,
      },
    })
    let emailSent = false

    try {
      await sendInvitationEmail({
        to: invitation.email,
        inviteUrl: inviteLink,
        companyName: company?.name || "FgasPortal",
      })
      emailSent = true
    } catch (error) {
      console.error("Invitation email failed", {
        invitationId: invitation.id,
        email: invitation.email,
        error,
      })
    }

    return NextResponse.json(
      {
        message: emailSent
          ? "Inbjudan skapad och e-post har skickats."
          : "Inbjudan skapad, men e-post kunde inte skickas. Använd inbjudningslänken nedan.",
        emailSent,
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

function isUniqueMembershipError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}
