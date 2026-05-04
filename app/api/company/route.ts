import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

const optionalText = (max: number) =>
  z.string()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined) return undefined
      const trimmedValue = value?.trim()
      return trimmedValue ? trimmedValue : null
    })

const updateCompanySchema = z.object({
  name: z.string().trim().min(2).max(100),
  organizationNumber: optionalText(30),
  contactPerson: optionalText(100),
  contactEmail: optionalText(150).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "Ogiltig e-post"
  ),
  contactPhone: optionalText(40),
  address: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(100),
  sendInspectionRemindersToContractors: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const company = await prisma.company.findUnique({
      where: {
        id: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        orgNumber: true,
        organizationNumber: true,
        contactPerson: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        postalCode: true,
        city: true,
        billingEmail: true,
        invoiceReference: true,
        billingAddress: true,
        vatNumber: true,
        eInvoiceId: true,
        sendInspectionRemindersToContractors: true,
        email: true,
        phone: true,
      },
    })

    if (!company) {
      return NextResponse.json(
        { error: "Företaget hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(company, { status: 200 })
  } catch (error: unknown) {
    console.error("Get company profile error:", error)

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
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const validatedData = updateCompanySchema.parse(body)

    const company = await prisma.company.update({
      where: {
        id: auth.user.companyId,
      },
      data: validatedData,
      select: {
        id: true,
        name: true,
        orgNumber: true,
        organizationNumber: true,
        contactPerson: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        postalCode: true,
        city: true,
        billingEmail: true,
        invoiceReference: true,
        billingAddress: true,
        vatNumber: true,
        eInvoiceId: true,
        sendInspectionRemindersToContractors: true,
        email: true,
        phone: true,
      },
    })

    return NextResponse.json(company, { status: 200 })
  } catch (error: unknown) {
    console.error("Update company profile error:", error)

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
