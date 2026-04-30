import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { authenticateApiRequest, forbiddenResponse, isAdmin, isContractor } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createInstallationSchema } from '@/lib/validations'
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { classifyInspectionReminderStatus } from "@/lib/inspection-reminders"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { logActivity } from "@/lib/activity-log"

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { userId, companyId } = auth.user

    const body = await request.json()
    const validatedData = createInstallationSchema.parse(body)
    const {
      assignedContractorId: rawAssignedContractorId,
      ...installationData
    } = validatedData
    const assignedContractorId = await validateAssignedContractor(
      rawAssignedContractorId,
      companyId
    )

    if (assignedContractorId === false) {
      return NextResponse.json(
        { error: 'Ogiltig servicepartner' },
        { status: 400 }
      )
    }

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
        ...installationData,
        equipmentId: emptyToNull(validatedData.equipmentId),
        serialNumber: emptyToNull(validatedData.serialNumber),
        propertyName: emptyToNull(validatedData.propertyName),
        equipmentType: emptyToNull(validatedData.equipmentType),
        operatorName: emptyToNull(validatedData.operatorName),
        assignedContractorId: assignedContractorId ?? null,
        hasLeakDetectionSystem: validatedData.hasLeakDetectionSystem ?? false,
        nextInspection,
        notes: emptyToNull(validatedData.notes),
        companyId,
        createdById: userId,
        updatedById: userId
      }
    })

    await logActivity({
      companyId,
      installationId: installation.id,
      userId,
      action: 'installation_created',
      entityType: 'installation',
      entityId: installation.id,
      metadata: {
        name: installation.name,
        location: installation.location,
      },
    })

    if (assignedContractorId) {
      await logActivity({
        companyId,
        installationId: installation.id,
        userId,
        action: 'service_partner_assigned',
        entityType: 'installation',
        entityId: installation.id,
        metadata: {
          assignedContractorId,
        },
      })
    }

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

function emptyToNull(value?: string | null) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

async function validateAssignedContractor(
  value: string | null | undefined,
  companyId: string
) {
  if (value === undefined) return undefined

  const contractorId = emptyToNull(value)

  if (!contractorId) return null

  const contractor = await prisma.user.findFirst({
    where: {
      id: contractorId,
      companyId,
      role: 'CONTRACTOR',
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  return contractor ? contractor.id : false
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user

    const installations = await prisma.installation.findMany({
      where: {
        companyId,
        archivedAt: null,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
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
