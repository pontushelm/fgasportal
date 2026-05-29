import { NextRequest, NextResponse } from "next/server"
import { ZodError, z } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"

const propertySchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(100),
  municipality: optionalText(100),
  propertyDesignation: z.string().trim().min(1).max(120),
  internalReference: optionalText(120),
  description: optionalText(500),
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

    const duplicateProperty = await prisma.property.findFirst({
      where: {
        companyId: auth.user.companyId,
        id: {
          not: existingProperty.id,
        },
        propertyDesignation: {
          equals: validatedData.propertyDesignation,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicateProperty) {
      return NextResponse.json(
        { error: "En fastighet med samma fastighetsbeteckning finns redan." },
        { status: 409 }
      )
    }

    const property = await prisma.property.update({
      where: {
        id: existingProperty.id,
      },
      data: validatedData,
    })

    await logActivity({
      action: "property_updated",
      companyId: auth.user.companyId,
      entityId: property.id,
      entityType: "PROPERTY",
      metadata: {
        name: property.name,
        propertyDesignation: property.propertyDesignation,
      },
      userId: auth.user.userId,
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (auth.user.role !== "OWNER") return forbiddenResponse()

    const { id } = await context.params
    const property = await prisma.property.findFirst({
      where: {
        id,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        name: true,
        propertyDesignation: true,
        _count: {
          select: {
            installations: true,
          },
        },
      },
    })

    if (!property) {
      return NextResponse.json(
        { error: "Fastigheten hittades inte" },
        { status: 404 }
      )
    }

    if (property._count.installations > 0) {
      return NextResponse.json(
        {
          error:
            "Fastigheten kan inte tas bort eftersom det finns aggregat kopplade till den. Flytta eller ta bort aggregaten först.",
        },
        { status: 409 }
      )
    }

    await prisma.property.delete({
      where: {
        id: property.id,
      },
    })

    await logActivity({
      action: "property_deleted",
      companyId: auth.user.companyId,
      entityId: property.id,
      entityType: "PROPERTY",
      metadata: {
        name: property.name,
        propertyDesignation: property.propertyDesignation,
      },
      userId: auth.user.userId,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: unknown) {
    console.error("Delete property error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
