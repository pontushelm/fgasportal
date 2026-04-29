import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { authenticateApiRequest, forbiddenResponse, isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createInstallationSchema } from '@/lib/validations'
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { classifyInspectionReminderStatus } from "@/lib/inspection-reminders"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { userId, companyId } = auth.user

    const body = await request.json()
    const validatedData = createInstallationSchema.parse(body)

    const nextInspection = calculateNextInspectionDate(
      validatedData.lastInspection,
      validatedData.inspectionIntervalMonths
    )
    const compliance = calculateInstallationCompliance(
      validatedData.refrigerantType,
      validatedData.refrigerantAmount,
      validatedData.hasLeakDetectionSystem ?? false,
      validatedData.lastInspection,
      nextInspection
    )

    const installation = await prisma.installation.create({
      data: {
        ...validatedData,
        equipmentId: emptyToNull(validatedData.equipmentId),
        serialNumber: emptyToNull(validatedData.serialNumber),
        propertyName: emptyToNull(validatedData.propertyName),
        equipmentType: emptyToNull(validatedData.equipmentType),
        operatorName: emptyToNull(validatedData.operatorName),
        hasLeakDetectionSystem: validatedData.hasLeakDetectionSystem ?? false,
        nextInspection,
        notes: emptyToNull(validatedData.notes),
        companyId,
        createdById: userId,
        updatedById: userId
      }
    })

    return NextResponse.json({
      ...installation,
      gwp: compliance.gwp,
      co2eKg: compliance.co2eKg,
      co2eTon: compliance.co2eTon,
      inspectionInterval: compliance.inspectionIntervalMonths,
      baseInspectionInterval: compliance.baseInspectionIntervalMonths,
      hasAdjustedInspectionInterval: compliance.hasAdjustedInspectionInterval,
      complianceStatus: compliance.status,
      daysUntilDue: compliance.daysUntilDue,
      inspectionReminderStatus: nextInspection
        ? classifyInspectionReminderStatus(nextInspection, new Date())
        : null,
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('Create installation error:', error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Ogiltiga indata', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}

function emptyToNull(value?: string) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId } = auth.user

    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'desc' }
    })

    const installationsWithCompliance = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      return {
        ...installation,
        gwp: compliance.gwp,
        co2eKg: compliance.co2eKg,
        co2eTon: compliance.co2eTon,
        inspectionInterval: compliance.inspectionIntervalMonths,
        baseInspectionInterval: compliance.baseInspectionIntervalMonths,
        hasAdjustedInspectionInterval: compliance.hasAdjustedInspectionInterval,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
        inspectionReminderStatus: installation.nextInspection
          ? classifyInspectionReminderStatus(installation.nextInspection, new Date())
          : null,
      }
    })

    return NextResponse.json(installationsWithCompliance, { status: 200 })

  } catch (error: unknown) {
    console.error('Get installations error:', error)
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}
