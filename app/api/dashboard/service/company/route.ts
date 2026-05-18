import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"
import {
  canEditServicePartnerCompanySettings,
  canViewServicePartnerCompanySettings,
} from "@/lib/servicepartner-company-settings-access"

const servicePartnerSettingsSchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(160),
  contactEmail: z.string().trim().email("Ogiltig e-postadress").optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  certificateNumber: optionalText(120),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!canViewServicePartnerCompanySettings(auth.user)) return forbiddenResponse()

    const servicePartnerCompany = await prisma.servicePartnerCompany.findFirst({
      where: {
        id: auth.user.servicePartnerCompanyId!,
        companyId: auth.user.companyId,
      },
      select: servicePartnerSettingsSelect,
    })

    if (!servicePartnerCompany) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(servicePartnerCompany, { status: 200 })
  } catch (error: unknown) {
    console.error("Get servicepartner company settings error:", error)

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
    if (!canEditServicePartnerCompanySettings(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const data = servicePartnerSettingsSchema.parse(body)
    const servicePartnerCompany = await prisma.servicePartnerCompany.findFirst({
      where: {
        id: auth.user.servicePartnerCompanyId!,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
      },
    })

    if (!servicePartnerCompany) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    const updatedServicePartnerCompany =
      await prisma.servicePartnerCompany.update({
        where: {
          id: servicePartnerCompany.id,
        },
        data,
        select: servicePartnerSettingsSelect,
      })

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "service_partner_company_settings_updated",
      entityType: "service_partner_company",
      entityId: servicePartnerCompany.id,
      metadata: {
        updatedFields: Object.keys(data),
      },
    })

    return NextResponse.json(updatedServicePartnerCompany, { status: 200 })
  } catch (error: unknown) {
    console.error("Update servicepartner company settings error:", error)

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
  return z.string().trim().max(maxLength).optional().or(z.literal("")).transform((value) => value || null)
}

const servicePartnerSettingsSelect = {
  id: true,
  name: true,
  organizationNumber: true,
  contactEmail: true,
  phone: true,
  certificateNumber: true,
}
