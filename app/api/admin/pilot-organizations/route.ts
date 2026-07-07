import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { buildAppUrl } from "@/lib/app-url"
import { authenticateApiRequest } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendInvitationEmail } from "@/lib/email"
import { isInternalAdminEmail } from "@/lib/internal-admin-config"

const INVITATION_TTL_DAYS = 7

const createPilotOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  contactEmail: z.string().trim().email().max(240).transform((value) => value.toLowerCase()),
  sendInvitationEmail: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const internalAdmin = await prisma.user.findUnique({
      where: {
        id: auth.user.userId,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    })

    if (!internalAdmin?.isActive || !isInternalAdminEmail(internalAdmin.email)) {
      return NextResponse.json({ error: "Behörighet saknas" }, { status: 404 })
    }

    const validatedData = createPilotOrganizationSchema.parse(await request.json())
    const duplicateCompany = await prisma.company.findFirst({
      where: {
        name: {
          equals: validatedData.organizationName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicateCompany) {
      return NextResponse.json(
        { error: "En organisation med detta namn finns redan." },
        { status: 409 }
      )
    }

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS)

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: validatedData.organizationName,
          orgNumber: generatePilotOrgNumber(),
          contactPerson: validatedData.contactName,
          contactEmail: validatedData.contactEmail,
          planType: "pilot",
        },
        select: {
          id: true,
          name: true,
        },
      })
      const existingUser = await tx.user.findUnique({
        where: {
          email: validatedData.contactEmail,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      })
      const membership = existingUser
        ? await tx.companyMembership.upsert({
            where: {
              userId_companyId: {
                userId: existingUser.id,
                companyId: company.id,
              },
            },
            create: {
              userId: existingUser.id,
              companyId: company.id,
              role: "OWNER",
              isActive: true,
            },
            update: {
              role: "OWNER",
              isActive: true,
            },
            select: {
              id: true,
            },
          })
        : null
      const invitation = existingUser
        ? null
        : await tx.invitation.create({
            data: {
              email: validatedData.contactEmail,
              role: "OWNER",
              token,
              companyId: company.id,
              invitedByUserId: internalAdmin.id,
              expiresAt,
            },
            select: {
              id: true,
              email: true,
              token: true,
            },
          })

      return {
        company,
        existingUser,
        invitation,
        membership,
      }
    })
    const inviteLink = result.invitation
      ? buildAppUrl(`/register?invite=${result.invitation.token}`)
      : null
    let emailSent = false
    let emailError: string | null = null

    if (validatedData.sendInvitationEmail && result.invitation && inviteLink) {
      try {
        await sendInvitationEmail({
          to: result.invitation.email,
          inviteUrl: inviteLink,
          companyName: result.company.name,
          role: "OWNER",
        })
        emailSent = true
      } catch (error) {
        console.error("Internal pilot invitation email failed", {
          companyId: result.company.id,
          invitationId: result.invitation.id,
          email: result.invitation.email,
          error,
        })
        emailError = "Inbjudan skapades, men e-post kunde inte skickas."
      }
    }

    return NextResponse.json(
      {
        company: result.company,
        contactEmail: validatedData.contactEmail,
        emailSent,
        emailError,
        existingUserReused: Boolean(result.existingUser),
        inviteLink:
          result.invitation && !emailSent ? inviteLink : null,
        invitationCreated: Boolean(result.invitation),
        membershipId: result.membership?.id ?? null,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create pilot organization error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Organisationen eller kopplingen finns redan." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function generatePilotOrgNumber() {
  return `PILOT-${crypto.randomUUID()}`
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}
