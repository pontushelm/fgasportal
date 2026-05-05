import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  registerSchema,
  type InvitedRegisterData,
  type NormalRegisterData,
  type RegisterFormData,
} from "@/lib/validations"
import { hashPassword, type UserRole } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    if (isInvitedRegistration(validatedData)) {
      return await registerInvitedUser(validatedData)
    }

    const normalData: NormalRegisterData = validatedData
    const existingCompany = await prisma.company.findUnique({
      where: {
        orgNumber: normalData.orgNumber,
      },
    })

    if (existingCompany) {
      return NextResponse.json(
        { error: "Ett företag med detta organisationsnummer finns redan" },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalData.userEmail,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "En användare med denna e-post finns redan" },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(normalData.password)

    const company = await prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: {
          name: normalData.companyName,
          orgNumber: normalData.orgNumber,
          address: normalData.companyAddress || null,
          phone: normalData.companyPhone || null,
          users: {
            create: {
              name: normalData.userName,
              email: normalData.userEmail,
              password: hashedPassword,
              role: "OWNER",
            },
          },
        },
        include: {
          users: true,
        },
      })

      await tx.companyMembership.create({
        data: {
          userId: createdCompany.users[0].id,
          companyId: createdCompany.id,
          role: "OWNER",
          isActive: true,
        },
      })

      return createdCompany
    })

    return NextResponse.json(
      {
        message: "Företag och användare skapade",
        companyId: company.id,
        userId: company.users[0].id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)

    return NextResponse.json(
      { error: "Något gick fel vid registrering" },
      { status: 500 }
    )
  }
}

function isInvitedRegistration(data: RegisterFormData): data is InvitedRegisterData {
  return Boolean(data.inviteToken)
}

async function registerInvitedUser(data: InvitedRegisterData) {
  const invitation = await prisma.invitation.findUnique({
    where: {
      token: data.inviteToken,
    },
    include: {
      company: true,
    },
  })

  if (!invitation) {
    return NextResponse.json(
      { error: "Inbjudan är ogiltig" },
      { status: 400 }
    )
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: "Inbjudan har redan använts" },
      { status: 400 }
    )
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Inbjudan har gått ut" },
      { status: 400 }
    )
  }

  if (invitation.email.toLowerCase() !== data.userEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "E-postadressen matchar inte inbjudan" },
      { status: 400 }
    )
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.userEmail,
    },
  })

  if (existingUser) {
    return NextResponse.json(
      { error: "En användare med denna e-post finns redan" },
      { status: 400 }
    )
  }

  const hashedPassword = await hashPassword(data.password)
  const invitedRole = normalizeInvitedUserRole(invitation.role)
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: data.userName,
        email: data.userEmail,
        password: hashedPassword,
        role: invitedRole,
        companyId: invitation.companyId,
      },
    })

    await tx.companyMembership.create({
      data: {
        userId: createdUser.id,
        companyId: invitation.companyId,
        role: invitedRole,
        isActive: true,
      },
    })

    await tx.invitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        acceptedAt: new Date(),
      },
    })

    return createdUser
  })

  return NextResponse.json(
    {
      message: "Användare skapad och kopplad till företaget",
      companyId: invitation.companyId,
      companyName: invitation.company.name,
      userId: user.id,
    },
    { status: 201 }
  )
}

function normalizeInvitedUserRole(role: string): UserRole {
  if (role === "ADMIN" || role === "MEMBER" || role === "CONTRACTOR") {
    return role
  }

  return "MEMBER"
}
