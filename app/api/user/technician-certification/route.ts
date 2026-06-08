import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"
import {
  readTechnicianPersonalFgasCertification,
  toTechnicianCertificationResponse,
  upsertTechnicianPersonalFgasCertification,
} from "@/lib/technician-certifications"

const technicianCertificationSchema = z.object({
  certificateNumber: optionalText(120),
  issuer: optionalText(160),
  category: optionalText(120),
  validUntil: optionalDate(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "CONTRACTOR") return forbiddenResponse()

    const context = await resolveActiveTechnicianCertificationContext(auth.user)
    if (!context) return forbiddenResponse()

    const certification = await readTechnicianPersonalFgasCertification({
      companyId: auth.user.companyId,
      membershipId: context.membershipId,
      prisma,
      serviceOrganizationId: context.serviceOrganizationId,
      userId: auth.user.userId,
    })

    return NextResponse.json(toTechnicianCertificationResponse(certification), {
      status: 200,
    })
  } catch (error) {
    console.error("Get own technician certification error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "CONTRACTOR") return forbiddenResponse()

    const context = await resolveActiveTechnicianCertificationContext(auth.user)
    if (!context) return forbiddenResponse()

    const body = await request.json()
    const data = technicianCertificationSchema.parse(body)

    const certification = await prisma.$transaction((tx) =>
      upsertTechnicianPersonalFgasCertification({
        companyId: auth.user.companyId,
        input: data,
        membershipId: context.membershipId,
        prisma: tx,
        serviceOrganizationId: context.serviceOrganizationId,
        updatedByUserId: auth.user.userId,
        userId: auth.user.userId,
      })
    )

    return NextResponse.json(toTechnicianCertificationResponse(certification), {
      status: 200,
    })
  } catch (error) {
    console.error("Update own technician certification error:", error)

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

async function resolveActiveTechnicianCertificationContext(user: {
  companyId: string
  membershipId?: string
  serviceOrganizationId?: string | null
  servicePartnerCompanyId?: string | null
  userId: string
}) {
  if (!user.membershipId || !user.servicePartnerCompanyId) return null

  const bridge = await ensureServiceOrganizationForLegacyCompany({
    companyId: user.companyId,
    servicePartnerCompanyId: user.servicePartnerCompanyId,
  })
  const serviceOrganizationId =
    bridge?.serviceOrganizationId ?? user.serviceOrganizationId ?? null
  if (!serviceOrganizationId) return null

  return {
    membershipId: user.membershipId,
    serviceOrganizationId,
  }
}

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null)
}

function optionalDate() {
  return z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || Number.isFinite(new Date(value).getTime()), {
      message: "Ange ett giltigt datum",
    })
    .transform((value) => (value ? new Date(value) : null))
}
