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

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const properties = await prisma.property.findMany({
      where: {
        companyId: auth.user.companyId,
      },
      orderBy: [{ name: "asc" }],
    })

    return NextResponse.json(properties, { status: 200 })
  } catch (error: unknown) {
    console.error("Get properties error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const validatedData = propertySchema.parse(body)
    const property = await prisma.property.create({
      data: {
        ...validatedData,
        companyId: auth.user.companyId,
      },
    })

    return NextResponse.json(property, { status: 201 })
  } catch (error: unknown) {
    console.error("Create property error:", error)

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
