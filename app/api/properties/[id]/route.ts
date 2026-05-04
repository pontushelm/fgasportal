import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

const propertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(100),
  municipality: optionalText(100),
  propertyDesignation: optionalText(120),
})

function optionalText(max: number) {
  return z.string()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined) return undefined
      const trimmedValue = value?.trim()
      return trimmedValue ? trimmedValue : null
    })
}

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const body = await request.json()
    const validatedData = propertySchema.parse(body)
    const existingProperty = await prisma.property.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
      },
    })

    if (!existingProperty) {
      return NextResponse.json(
        { error: "Fastigheten hittades inte" },
        { status: 404 }
      )
    }

    const property = await prisma.property.update({
      where: {
        id: existingProperty.id,
      },
      data: validatedData,
    })

    return NextResponse.json(property, { status: 200 })
  } catch (error: unknown) {
    console.error("Update property error:", error)

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
