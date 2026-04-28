import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type RouteContext = {
  params: Promise<{
    token: string
  }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params
  const invitation = await prisma.invitation.findUnique({
    where: {
      token,
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!invitation) {
    return NextResponse.json(
      { error: "Inbjudan är ogiltig" },
      { status: 404 }
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

  return NextResponse.json(
    {
      email: invitation.email,
      role: invitation.role,
      companyName: invitation.company.name,
      expiresAt: invitation.expiresAt,
    },
    { status: 200 }
  )
}
