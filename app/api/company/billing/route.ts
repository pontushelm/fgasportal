import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined) return undefined
      const trimmedValue = value?.trim()
      return trimmedValue ? trimmedValue : null
    })

const updateBillingSchema = z.object({
  billingEmail: optionalText(150).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "Ogiltig faktura-e-post"
  ),
  invoiceReference: optionalText(100),
  billingAddress: optionalText(300),
  vatNumber: optionalText(60),
  eInvoiceId: optionalText(100),
})

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const body = await request.json()
    const validatedData = updateBillingSchema.parse(body)

    const company = await prisma.company.update({
      where: {
        id: auth.user.companyId,
      },
      data: validatedData,
      select: {
        id: true,
        billingEmail: true,
        invoiceReference: true,
        billingAddress: true,
        vatNumber: true,
        eInvoiceId: true,
      },
    })

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "company_billing_updated",
      entityType: "company",
      entityId: company.id,
      metadata: {
        updatedFields: Object.keys(validatedData),
      },
    })

    return NextResponse.json(company, { status: 200 })
  } catch (error: unknown) {
    console.error("Update company billing error:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Ogiltiga fakturauppgifter", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
