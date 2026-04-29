import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { createInspectionSchema } from "@/lib/validations"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const { companyId } = auth.user
    const body = await request.json()
    const validatedData = createInspectionSchema.parse(body)

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem
    )
    const nextInspection = calculateNextInspectionDate(
      validatedData.inspectionDate,
      compliance.inspectionIntervalMonths
    )

    const inspection = await prisma.$transaction(async (tx) => {
      const createdInspection = await tx.inspection.create({
        data: {
          inspectionDate: validatedData.inspectionDate,
          inspectorName: validatedData.inspectorName,
          status: validatedData.status,
          notes: validatedData.notes || null,
          nextDueDate: nextInspection,
          installationId: installation.id,
        },
      })

      await tx.installation.update({
        where: {
          id: installation.id,
        },
        data: {
          lastInspection: validatedData.inspectionDate,
          inspectionIntervalMonths: compliance.inspectionIntervalMonths,
          nextInspection,
        },
      })

      return createdInspection
    })

    return NextResponse.json(inspection, { status: 201 })
  } catch (error: unknown) {
    console.error("Create inspection error:", error)

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
