import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isContractor } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { prisma } from "@/lib/db"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const certificationSchema = z.object({
  isCertifiedCompany: z.boolean(),
  certificationNumber: optionalText(120),
  certificationOrganization: optionalText(120),
  certificationValidUntil: z.string()
    .optional()
    .refine(
      (value) => !value?.trim() || Number.isFinite(new Date(value).getTime()),
      "Ogiltigt datum"
    )
    .transform((value) => {
      if (!value?.trim()) return null
      return new Date(value)
    }),
})

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isContractor(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    if (id !== auth.user.userId) return forbiddenResponse()

    const contractorMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: id,
        companyId: auth.user.companyId,
        role: "CONTRACTOR",
        isActive: true,
      },
      select: {
        id: true,
        isCertifiedCompany: true,
        certificationNumber: true,
        certificationOrganization: true,
        certificationValidUntil: true,
      },
    })

    if (!contractorMembership) {
      return NextResponse.json(
        { error: "Servicepartnern hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        ...contractorMembership,
        certificationStatus: getCertificationStatus({
          isCertifiedCompany: contractorMembership.isCertifiedCompany,
          validUntil: contractorMembership.certificationValidUntil,
        }),
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get contractor certification error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isContractor(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    if (id !== auth.user.userId) return forbiddenResponse()

    const body = await request.json()
    const data = certificationSchema.parse(body)
    const contractorMembership = await prisma.companyMembership.findFirst({
      where: {
        userId: id,
        companyId: auth.user.companyId,
        role: "CONTRACTOR",
        isActive: true,
      },
      select: {
        id: true,
      },
    })

    if (!contractorMembership) {
      return NextResponse.json(
        { error: "Servicepartnern hittades inte" },
        { status: 404 }
      )
    }

    const updatedMembership = await prisma.companyMembership.update({
      where: {
        id: contractorMembership.id,
      },
      data,
      select: {
        isCertifiedCompany: true,
        certificationNumber: true,
        certificationOrganization: true,
        certificationValidUntil: true,
      },
    })

    return NextResponse.json(
      {
        ...updatedMembership,
        certificationStatus: getCertificationStatus({
          isCertifiedCompany: updatedMembership.isCertifiedCompany,
          validUntil: updatedMembership.certificationValidUntil,
        }),
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Update contractor certification error:", error)

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

function optionalText(maxLength: number) {
  return z.string()
    .max(maxLength)
    .optional()
    .transform((value) => {
      const trimmedValue = value?.trim()
      return trimmedValue ? trimmedValue : null
    })
}
