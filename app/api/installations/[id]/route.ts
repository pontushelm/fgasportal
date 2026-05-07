import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import {
  authenticateApiRequest,
  forbiddenResponse,
  isAdmin,
  isContractor,
} from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { calculateNextInspectionDate } from "@/lib/inspection-schedule"
import { editInstallationSchema } from "@/lib/validations"
import { logActivity } from "@/lib/activity-log"
import { notifyContractorsAboutNewAssignments } from "@/lib/contractor-assignment-notifications"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { id } = await context.params
    const { companyId, userId } = auth.user

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
        ...(isContractor(auth.user) ? { assignedContractorId: userId } : {}),
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            municipality: true,
            city: true,
          },
        },
        inspections: {
          orderBy: {
            inspectionDate: "desc",
          },
        },
        assignedContractor: {
          select: {
            id: true,
            name: true,
            email: true,
            memberships: {
              where: {
                companyId,
                role: "CONTRACTOR",
                isActive: true,
              },
              select: {
                isCertifiedCompany: true,
                certificationValidUntil: true,
              },
              take: 1,
            },
          },
        },
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    const { assignedContractor, ...installationData } = installation
    const contractorMembership = assignedContractor?.memberships[0] ?? null
    const scrapServicePartner = installationData.scrapServicePartnerId
      ? await prisma.companyMembership.findFirst({
          where: {
            userId: installationData.scrapServicePartnerId,
            companyId,
            role: "CONTRACTOR",
          },
          select: {
            isCertifiedCompany: true,
            certificationValidUntil: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : null

    return NextResponse.json(
      {
        ...installationData,
        assignedContractor: assignedContractor
          ? {
              id: assignedContractor.id,
              name: assignedContractor.name,
              email: assignedContractor.email,
              certificationStatus: getCertificationStatus({
                isCertifiedCompany:
                  contractorMembership?.isCertifiedCompany ?? false,
                validUntil: contractorMembership?.certificationValidUntil ?? null,
              }),
            }
          : null,
        scrapServicePartner: scrapServicePartner
          ? {
              id: scrapServicePartner.user.id,
              name: scrapServicePartner.user.name,
              email: scrapServicePartner.user.email,
              certificationStatus: getCertificationStatus({
                isCertifiedCompany: scrapServicePartner.isCertifiedCompany,
                validUntil: scrapServicePartner.certificationValidUntil,
              }),
            }
          : null,
      },
      { status: 200 }
    )
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
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const { companyId, userId } = auth.user
    const body = await request.json()
    const validatedData = editInstallationSchema.parse(body)
    const assignedContractorId = await validateAssignedContractor(
      validatedData.assignedContractorId,
      companyId
    )
    const propertyId = await validateProperty(validatedData.propertyId, companyId)

    if (assignedContractorId === false) {
      return NextResponse.json(
        { error: "Ogiltig servicepartner" },
        { status: 400 }
      )
    }

    if (propertyId === false) {
      return NextResponse.json(
        { error: "Ogiltig fastighet" },
        { status: 400 }
      )
    }

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
        scrappedAt: null,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    const lastInspection =
      validatedData.lastInspection !== undefined
        ? validatedData.lastInspection
        : installation.lastInspection
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      validatedData.refrigerantAmount,
      validatedData.hasLeakDetectionSystem ?? false,
      lastInspection
    )
    const nextInspection = calculateNextInspectionDate(
      lastInspection,
      compliance.inspectionIntervalMonths
    )
    const assignedContractorUpdate =
      assignedContractorId === undefined
        ? {}
        : { assignedContractorId }
    const propertyUpdate =
      propertyId === undefined
        ? {}
        : { propertyId }

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
        ...propertyUpdate,
        equipmentType: emptyToNull(validatedData.equipmentType),
        operatorName: emptyToNull(validatedData.operatorName),
        ...assignedContractorUpdate,
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: validatedData.refrigerantAmount,
        hasLeakDetectionSystem: validatedData.hasLeakDetectionSystem ?? false,
        installationDate: validatedData.installationDate ?? installation.installationDate,
        lastInspection: validatedData.lastInspection,
        inspectionIntervalMonths: compliance.inspectionIntervalMonths,
        nextInspection,
        notes: emptyToNull(validatedData.notes),
      },
    })

    await logActivity({
      companyId,
      installationId: updatedInstallation.id,
      userId,
      action: "installation_updated",
      entityType: "installation",
      entityId: updatedInstallation.id,
      metadata: {
        name: updatedInstallation.name,
      },
    })

    if (
      assignedContractorId !== undefined &&
      assignedContractorId !== installation.assignedContractorId
    ) {
      await logActivity({
        companyId,
        installationId: updatedInstallation.id,
        userId,
        action: "service_partner_assigned",
        entityType: "installation",
        entityId: updatedInstallation.id,
        metadata: {
          previousAssignedContractorId: installation.assignedContractorId,
          assignedContractorId,
        },
      })

      if (assignedContractorId) {
        await notifyContractorsAboutNewAssignments(companyId, [
          assignedContractorId,
        ])
      }
    }

    const updatedCompliance = calculateInstallationCompliance(
      updatedInstallation.refrigerantType,
      updatedInstallation.refrigerantAmount,
      updatedInstallation.hasLeakDetectionSystem,
      updatedInstallation.lastInspection,
      updatedInstallation.nextInspection
    )

    return NextResponse.json(
      {
        ...updatedInstallation,
        gwp: updatedCompliance.gwp,
        co2eKg: updatedCompliance.co2eKg,
        co2eTon: updatedCompliance.co2eTon,
        inspectionInterval: updatedCompliance.inspectionIntervalMonths,
        baseInspectionInterval: updatedCompliance.baseInspectionIntervalMonths,
        hasAdjustedInspectionInterval: updatedCompliance.hasAdjustedInspectionInterval,
        complianceStatus: updatedCompliance.status,
        daysUntilDue: updatedCompliance.daysUntilDue,
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
      OR: [
        { userId: contractorId },
        { id: contractorId },
      ],
      companyId,
      role: "CONTRACTOR",
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

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!isAdmin(auth.user)) return forbiddenResponse()

    const { id } = await context.params
    const { companyId } = auth.user

    const installation = await prisma.installation.findFirst({
      where: {
        id,
        companyId,
        archivedAt: null,
        scrappedAt: null,
      },
    })

    if (!installation) {
      return NextResponse.json(
        { error: "Aggregatet hittades inte" },
        { status: 404 }
      )
    }

    let archiveComment: string | null = null
    try {
      const body = (await request.json()) as { archiveComment?: unknown }
      archiveComment =
        typeof body.archiveComment === "string"
          ? body.archiveComment.trim() || null
          : null
    } catch {
      archiveComment = null
    }

    const archivedInstallation = await prisma.installation.update({
      where: {
        id: installation.id,
      },
      data: {
        archivedAt: new Date(),
      },
    })

    await logActivity({
      companyId,
      installationId: installation.id,
      userId: auth.user.userId,
      action: "installation_archived",
      entityType: "installation",
      entityId: installation.id,
      metadata: {
        name: installation.name,
        archiveComment,
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
