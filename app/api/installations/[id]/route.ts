import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse, isAdmin } from "@/lib/auth"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { editInstallationSchema } from "@/lib/validations"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const { companyId } = auth.user

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
      },
      include: {
        inspections: {
          orderBy: {
            inspectionDate: "desc",
          },
        },
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    return NextResponse.json(installation, { status: 200 })
  } catch (error: unknown) {
    console.error("Get installation detail error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const { companyId } = auth.user
    const body = await request.json()
    const validatedData = editInstallationSchema.parse(body)

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    const lastInspection =
      validatedData.lastInspection !== undefined
        ? validatedData.lastInspection
        : installation.lastInspection
    const inspectionIntervalMonths =
      validatedData.inspectionIntervalMonths !== undefined
        ? validatedData.inspectionIntervalMonths
        : installation.inspectionIntervalMonths
    const shouldRecalculateNextInspection =
      validatedData.lastInspection !== undefined ||
      validatedData.inspectionIntervalMonths !== undefined
    const nextInspection = shouldRecalculateNextInspection
      ? calculateNextInspectionDate(lastInspection, inspectionIntervalMonths)
      : installation.nextInspection

    const updatedInstallation = await prisma.installation.update({
      where: {
        id: installation.id,
      },
      data: {
        name: validatedData.name,
        location: validatedData.location,
        equipmentId: emptyToNull(validatedData.equipmentId),
        serialNumber: emptyToNull(validatedData.serialNumber),
        propertyName: emptyToNull(validatedData.propertyName),
        equipmentType: emptyToNull(validatedData.equipmentType),
        operatorName: emptyToNull(validatedData.operatorName),
        refrigerantType: validatedData.refrigerantType,
        refrigerantAmount: validatedData.refrigerantAmount,
        hasLeakDetectionSystem: validatedData.hasLeakDetectionSystem ?? false,
        lastInspection: validatedData.lastInspection,
        inspectionIntervalMonths: validatedData.inspectionIntervalMonths,
        nextInspection,
        notes: emptyToNull(validatedData.notes),
      },
    })

    const compliance = calculateInstallationCompliance(
      updatedInstallation.refrigerantType,
      updatedInstallation.refrigerantAmount,
      updatedInstallation.hasLeakDetectionSystem,
      updatedInstallation.lastInspection,
      updatedInstallation.nextInspection
    )

    return NextResponse.json(
      {
        ...updatedInstallation,
        gwp: compliance.gwp,
        co2eKg: compliance.co2eKg,
        co2eTon: compliance.co2eTon,
        inspectionInterval: compliance.inspectionIntervalMonths,
        baseInspectionInterval: compliance.baseInspectionIntervalMonths,
        hasAdjustedInspectionInterval: compliance.hasAdjustedInspectionInterval,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Update installation error:", error)

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

function emptyToNull(value?: string) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const { companyId } = auth.user

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Installationen hittades inte" },
        { status: 404 }
      )
    }

    const archivedInstallation = await prisma.installation.update({
      where: {
        id: installation.id,
      },
      data: {
        archivedAt: new Date(),
      },
    })

    return NextResponse.json(archivedInstallation, { status: 200 })
  } catch (error: unknown) {
    console.error("Archive installation error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}
