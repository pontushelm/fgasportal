import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendInvitationEmail } from "@/lib/email"
import { toServiceOrganizationBackedCompany } from "@/lib/service-organizations"

const INVITATION_TTL_DAYS = 7

const servicePartnerCompanySchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(160),
  organizationNumber: optionalText(40),
  contactEmail: z.string().trim().email("Ogiltig e-postadress").optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  certificateNumber: optionalText(120),
  responsibleContactEmail: z
    .string()
    .trim()
    .email("Ogiltig e-postadress")
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  notes: optionalText(1000),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const servicePartnerCompanies = await prisma.servicePartnerCompany.findMany({
      where: {
        companyId: auth.user.companyId,
      },
      orderBy: {
        name: "asc",
      },
      select: servicePartnerCompanySelect,
    })

    return NextResponse.json(
      servicePartnerCompanies.map(toServiceOrganizationBackedCompany),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get service partner companies error:", error)

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
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const { responsibleContactEmail, ...data } =
      servicePartnerCompanySchema.parse(body)

    const existingServiceOrganization = data.organizationNumber
      ? await prisma.serviceOrganization.findFirst({
          where: {
            organizationNumber: data.organizationNumber,
          },
          select: {
            id: true,
          },
        })
      : null
    const serviceOrganization =
      existingServiceOrganization ??
      (await prisma.serviceOrganization.create({
        data: {
          name: data.name,
          organizationNumber: data.organizationNumber,
          contactEmail: data.contactEmail,
          phone: data.phone,
          certificateNumber: data.certificateNumber,
        },
        select: {
          id: true,
        },
      }))

    const servicePartnerCompany = await prisma.servicePartnerCompany.create({
      data: {
        ...data,
        companyId: auth.user.companyId,
        serviceOrganizationId: serviceOrganization.id,
      },
      select: servicePartnerCompanySelect,
    })

    await prisma.companyServiceOrganization.upsert({
      where: {
        companyId_serviceOrganizationId: {
          companyId: auth.user.companyId,
          serviceOrganizationId: servicePartnerCompany.serviceOrganizationId!,
        },
      },
      create: {
        companyId: auth.user.companyId,
        serviceOrganizationId: servicePartnerCompany.serviceOrganizationId!,
        displayName: data.name,
      },
      update: {
        isActive: true,
        displayName: data.name,
      },
    })

    const responsibleInvitation = responsibleContactEmail
      ? await createResponsibleServicePartnerInvitation({
          companyId: auth.user.companyId,
          invitedByUserId: auth.user.userId,
          origin: request.nextUrl.origin,
          serviceOrganizationId: servicePartnerCompany.serviceOrganizationId!,
          servicePartnerCompanyId: servicePartnerCompany.id,
          servicePartnerCompanyName:
            servicePartnerCompany.serviceOrganization?.name ??
            servicePartnerCompany.name,
          to: responsibleContactEmail,
        })
      : null

    return NextResponse.json(
      {
        ...toServiceOrganizationBackedCompany(servicePartnerCompany),
        responsibleInvitation,
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error("Create service partner company error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga indata", details: error.issues },
        { status: 400 }
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Det finns redan ett serviceföretag med samma namn." },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function optionalText(maxLength: number) {
  return z.string().trim().max(maxLength).optional().or(z.literal("")).transform((value) => value || null)
}

const servicePartnerCompanySelect = {
  id: true,
  companyId: true,
  serviceOrganizationId: true,
  name: true,
  organizationNumber: true,
  contactEmail: true,
  phone: true,
  certificateNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  serviceOrganization: {
    select: {
      id: true,
      name: true,
      organizationNumber: true,
      contactEmail: true,
      phone: true,
      certificateNumber: true,
    },
  },
} satisfies Prisma.ServicePartnerCompanySelect

async function createResponsibleServicePartnerInvitation({
  companyId,
  invitedByUserId,
  origin,
  serviceOrganizationId,
  servicePartnerCompanyId,
  servicePartnerCompanyName,
  to,
}: {
  companyId: string
  invitedByUserId: string
  origin: string
  serviceOrganizationId: string
  servicePartnerCompanyId: string
  servicePartnerCompanyName: string
  to: string
}) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: to,
    },
    select: {
      id: true,
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
      select: {
        id: true,
        role: true,
      },
    })

    if (existingMembership && existingMembership.role !== "CONTRACTOR") {
      return {
        email: to,
        emailSent: false,
        inviteLink: null,
        membershipId: existingMembership.id,
        message:
          "Servicepartnern har lagts till. Ansvarig e-post tillhör redan en intern användare och bjöds inte in som servicepartner.",
      }
    }

    const membership = existingMembership
      ? await prisma.companyMembership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            isActive: true,
            servicePartnerCompanyId,
            isServicePartnerAdmin: true,
          },
          select: {
            id: true,
          },
        })
      : await prisma.companyMembership.create({
          data: {
            userId: existingUser.id,
            companyId,
            role: "CONTRACTOR",
            isActive: true,
            servicePartnerCompanyId,
            isServicePartnerAdmin: true,
          },
          select: {
            id: true,
          },
        })

    await prisma.serviceOrganizationMembership.upsert({
      where: {
        serviceOrganizationId_userId: {
          serviceOrganizationId,
          userId: existingUser.id,
        },
      },
      create: {
        serviceOrganizationId,
        userId: existingUser.id,
        role: "ADMIN",
        isActive: true,
      },
      update: {
        role: "ADMIN",
        isActive: true,
      },
    })

    return {
      email: to,
      emailSent: false,
      inviteLink: null,
      membershipId: membership.id,
      message: "Befintlig användare kopplades som serviceansvarig.",
    }
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      companyId,
      email: to,
      role: "CONTRACTOR",
      acceptedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      servicePartnerCompanyId,
      serviceOrganizationId,
      isServicePartnerAdminInvite: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      email: true,
      token: true,
    },
  })

  if (existingInvitation) {
    return {
      email: existingInvitation.email,
      emailSent: false,
      inviteLink: `${origin}/register?invite=${existingInvitation.token}`,
      membershipId: null,
      message:
        "Servicepartnern har lagts till. En aktiv inbjudningslänk finns redan.",
    }
  }

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS)

  const invitation = await prisma.invitation.create({
    data: {
      email: to,
      role: "CONTRACTOR",
      token,
      companyId,
      servicePartnerCompanyId,
      serviceOrganizationId,
      isServicePartnerAdminInvite: true,
      invitedByUserId,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
    },
  })
  const inviteLink = `${origin}/register?invite=${token}`
  let emailSent = false

  try {
    await sendInvitationEmail({
      to,
      inviteUrl: inviteLink,
      companyName: servicePartnerCompanyName,
      role: "CONTRACTOR",
    })
    emailSent = true
  } catch (error) {
    console.error("Responsible servicepartner invitation email failed", {
      invitationId: invitation.id,
      email: to,
      error,
    })
  }

  return {
    email: invitation.email,
    emailSent,
    inviteLink: emailSent ? null : inviteLink,
    membershipId: null,
    message: emailSent
      ? "Servicepartnern har lagts till och inbjudan har skickats."
      : "Servicepartnern har lagts till. E-post kunde inte skickas, men en inbjudningslänk har skapats.",
  }
}
