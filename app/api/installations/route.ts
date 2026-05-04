import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { authenticateApiRequest, forbiddenResponse, isAdmin, isContractor } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createInstallationSchema } from '@/lib/validations'
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { classifyInspectionReminderStatus } from "@/lib/inspection-reminders"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { logActivity } from "@/lib/activity-log"
import { notifyContractorsAboutNewAssignments } from "@/lib/contractor-assignment-notifications"
import { calculateInstallationRisk } from "@/lib/risk-classification"

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
      propertyId: rawPropertyId,
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
    const propertyId = await validateProperty(rawPropertyId, companyId)

    if (propertyId === false) {
      return NextResponse.json(
        { error: 'Ogiltig fastighet' },
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
        propertyId: propertyId ?? null,
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

      await notifyContractorsAboutNewAssignments(companyId, [
        assignedContractorId,
      ])
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

  const contractor = await prisma.companyMembership.findFirst({
    where: {
      userId: contractorId,
      companyId,
      role: 'CONTRACTOR',
      isActive: true,
      user: {
        isActive: true,
      },
    },
    select: {
      userId: true,
    },
  })

  return contractor ? contractor.userId : false
}

async function validateProperty(
  value: string | null | undefined,
  companyId: string
) {
  if (value === undefined) return undefined

  const propertyId = emptyToNull(value)

  if (!propertyId) return null

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      companyId,
    },
    select: {
      id: true,
    },
  })

  return property ? property.id : false
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('q')?.trim()
    const archived = searchParams.get('archived') || 'active'
    const refrigerantType = searchParams.get('refrigerantType')?.trim()
    const contractorId = searchParams.get('contractorId')?.trim()
    const propertyId = searchParams.get('propertyId')?.trim()
    const municipality = searchParams.get('municipality')?.trim()
    const statusFilter = searchParams.get('status')?.trim()
    const sort = searchParams.get('sort') || 'updatedAt'
    const direction = searchParams.get('direction') === 'asc' ? 'asc' : 'desc'

    const where: Prisma.InstallationWhereInput = {
      companyId,
      ...(archived === 'archived'
        ? { archivedAt: { not: null } }
        : archived === 'all'
          ? {}
          : { archivedAt: null }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
              { equipmentId: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { propertyName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(refrigerantType ? { refrigerantType } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(municipality ? { property: { municipality } } : {}),
      ...(contractorId
        ? contractorId === 'unassigned'
          ? { assignedContractorId: null }
          : { assignedContractorId: contractorId }
        : {}),
      ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
    }

    const orderBy = getInstallationOrderBy(sort, direction)

    const installations = await prisma.installation.findMany({
      where,
      include: {
        assignedContractor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            municipality: true,
            city: true,
          },
        },
        events: {
          where: {
            type: "LEAK",
          },
          select: {
            id: true,
          },
        },
      },
      orderBy,
    })

    const installationsWithCompliance = installations.map((installation) => {
      const { events: leakEvents, ...installationData } = installation
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )
      const risk = calculateInstallationRisk({
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        gwp: compliance.gwp,
        hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
        leakageEventsCount: leakEvents.length,
      })

      return {
        ...installationData,
        gwp: compliance.gwp,
        co2eKg: compliance.co2eKg,
        co2eTon: compliance.co2eTon,
        riskLevel: risk.level,
        riskScore: risk.score,
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
    const filteredInstallations = statusFilter
      ? installationsWithCompliance.filter((installation) =>
          matchesStatusFilter(installation.complianceStatus, statusFilter)
        )
      : installationsWithCompliance
    const sortedInstallations =
      sort === 'co2e'
        ? [...filteredInstallations].sort((first, second) => {
            const multiplier = direction === 'asc' ? 1 : -1
            return (first.co2eTon - second.co2eTon) * multiplier
          })
        : filteredInstallations

    return NextResponse.json(sortedInstallations, { status: 200 })

  } catch (error: unknown) {
    console.error('Get installations error:', error)
    return NextResponse.json(
      { error: 'Ett oväntat fel uppstod' },
      { status: 500 }
    )
  }
}

function getInstallationOrderBy(
  sort: string,
  direction: 'asc' | 'desc'
): Prisma.InstallationOrderByWithRelationInput {
  if (sort === 'nextInspectionDate') {
    return { nextInspection: { sort: direction, nulls: 'last' } }
  }

  return { updatedAt: direction }
}

function matchesStatusFilter(status: string, filter: string) {
  if (filter === 'overdue') return status === 'OVERDUE'
  if (filter === 'dueSoon') return status === 'DUE_SOON'
  if (filter === 'ok') return status === 'OK'
  return true
}
