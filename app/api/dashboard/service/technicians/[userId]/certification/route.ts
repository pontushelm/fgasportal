import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { canManageServicepartnerTechnicianAssignments } from "@/lib/access/installation-access"
import { prisma } from "@/lib/db"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"
import {
  buildTechnicianCertification,
  buildTechnicianPersonalFgasCertificationRecordData,
} from "@/lib/technician-certifications"

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

const technicianCertificationSchema = z.object({
  certificateNumber: optionalText(120),
  issuer: optionalText(160),
  category: optionalText(120),
  validUntil: optionalDate(),
})

type TechnicianCertificationRecord = {
  id: string
  companyId: string
  serviceOrganizationId: string | null
  userId: string | null
  subjectType: "TECHNICIAN"
  certificateType: "PERSONAL_FGAS"
  certificateNumber: string
  issuer: string | null
  category: string | null
  validFrom: Date | null
  validUntil: Date | null
  status: "ACTIVE" | "EXPIRED" | "REPLACED" | "REVOKED" | "DELETED"
  verificationStatus: "UNVERIFIED" | "SELF_DECLARED" | "VERIFIED"
  createdAt: Date
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    if (
      !canManageServicepartnerTechnicianAssignments(
        auth.user,
        auth.user.servicePartnerCompanyId
      )
    ) {
      return forbiddenResponse()
    }

    const { userId: technicianUserId } = await context.params
    const body = await request.json()
    const data = technicianCertificationSchema.parse(body)
    const bridge = await ensureServiceOrganizationForLegacyCompany({
      companyId: auth.user.companyId,
      servicePartnerCompanyId: auth.user.servicePartnerCompanyId!,
    })

    if (!bridge) return forbiddenResponse()

    const technicianMembership = await prisma.serviceOrganizationMembership.findFirst({
      where: {
        serviceOrganizationId: bridge.serviceOrganizationId,
        userId: technicianUserId,
        isActive: true,
        user: {
          isActive: true,
          memberships: {
            some: {
              companyId: auth.user.companyId,
              role: "CONTRACTOR",
              isActive: true,
              servicePartnerCompanyId: auth.user.servicePartnerCompanyId,
            },
          },
        },
      },
      select: {
        user: {
          select: {
            id: true,
            certificationNumber: true,
            certificationIssuer: true,
            certificationValidUntil: true,
            certificationCategory: true,
            memberships: {
              where: {
                companyId: auth.user.companyId,
                role: "CONTRACTOR",
                isActive: true,
                servicePartnerCompanyId: auth.user.servicePartnerCompanyId,
              },
              select: {
                id: true,
                certificationNumber: true,
                certificationOrganization: true,
                certificationValidUntil: true,
              },
              take: 1,
            },
          },
        },
      },
    })

    if (!technicianMembership) {
      return NextResponse.json(
        { error: "Teknikern hittades inte inom er serviceorganisation." },
        { status: 404 }
      )
    }

    const legacyMembership = technicianMembership.user.memberships[0]
    if (!legacyMembership) {
      return NextResponse.json(
        { error: "Teknikern saknar aktiv medlemskoppling till servicepartnern." },
        { status: 404 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      if (!data.certificateNumber) {
        await tx.certificationRecord.updateMany({
          where: {
            companyId: auth.user.companyId,
            serviceOrganizationId: bridge.serviceOrganizationId,
            userId: technicianUserId,
            subjectType: "TECHNICIAN",
            certificateType: "PERSONAL_FGAS",
            status: {
              notIn: ["DELETED", "REVOKED", "REPLACED"],
            },
          },
          data: {
            status: "DELETED",
            updatedByUserId: auth.user.userId,
          },
        })

        const updatedUser = await tx.user.update({
          where: {
            id: technicianUserId,
          },
          data: {
            certificationNumber: null,
            certificationIssuer: null,
            certificationValidUntil: null,
            certificationCategory: null,
          },
          select: userCertificationSelect,
        })

        const updatedMembership = await tx.companyMembership.update({
          where: {
            id: legacyMembership.id,
          },
          data: {
            isCertifiedCompany: false,
            certificationNumber: null,
            certificationOrganization: null,
            certificationValidUntil: null,
          },
          select: membershipCertificationSelect,
        })

        return {
          records: [] as TechnicianCertificationRecord[],
          user: updatedUser,
          membership: updatedMembership,
        }
      }

      const existingRecord = await tx.certificationRecord.findFirst({
        where: {
          companyId: auth.user.companyId,
          serviceOrganizationId: bridge.serviceOrganizationId,
          userId: technicianUserId,
          subjectType: "TECHNICIAN",
          certificateType: "PERSONAL_FGAS",
          status: {
            notIn: ["DELETED", "REVOKED", "REPLACED"],
          },
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      const recordData = buildTechnicianPersonalFgasCertificationRecordData({
        category: data.category,
        certificateNumber: data.certificateNumber,
        companyId: auth.user.companyId,
        createdByUserId: auth.user.userId,
        issuer: data.issuer,
        serviceOrganizationId: bridge.serviceOrganizationId,
        userId: technicianUserId,
        validUntil: data.validUntil,
      })

      if (!recordData) {
        throw new Error("Certifikatnummer saknas.")
      }

      const certificationRecord = existingRecord
        ? await tx.certificationRecord.update({
            where: {
              id: existingRecord.id,
            },
            data: {
              certificateNumber: recordData.certificateNumber,
              issuer: recordData.issuer,
              category: recordData.category,
              validUntil: recordData.validUntil,
              status: "ACTIVE",
              verificationStatus: "SELF_DECLARED",
              updatedByUserId: auth.user.userId,
            },
          })
        : await tx.certificationRecord.create({
            data: recordData,
          })

      const updatedUser = await tx.user.update({
        where: {
          id: technicianUserId,
        },
        data: {
          certificationNumber: recordData.certificateNumber,
          certificationIssuer: recordData.issuer,
          certificationValidUntil: recordData.validUntil,
          certificationCategory: recordData.category,
        },
        select: userCertificationSelect,
      })

      const updatedMembership = await tx.companyMembership.update({
        where: {
          id: legacyMembership.id,
        },
        data: {
          isCertifiedCompany: true,
          certificationNumber: recordData.certificateNumber,
          certificationOrganization: recordData.issuer,
          certificationValidUntil: recordData.validUntil,
        },
        select: membershipCertificationSelect,
      })

      return {
        records: [certificationRecord as TechnicianCertificationRecord],
        user: updatedUser,
        membership: updatedMembership,
      }
    })

    return NextResponse.json(
      toTechnicianCertificationResponse(
        buildTechnicianCertification({
          membership: result.membership,
          records: result.records,
          user: result.user,
        })
      ),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Update technician certification error:", error)

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

const userCertificationSelect = {
  id: true,
  certificationNumber: true,
  certificationIssuer: true,
  certificationValidUntil: true,
  certificationCategory: true,
}

const membershipCertificationSelect = {
  id: true,
  certificationNumber: true,
  certificationOrganization: true,
  certificationValidUntil: true,
}

function toTechnicianCertificationResponse(
  certification: ReturnType<typeof buildTechnicianCertification>
) {
  return {
    certificateNumber: certification.certificateNumber,
    issuer: certification.issuer,
    category: certification.category,
    validUntil: certification.validUntil,
    status: certification.status,
    source: getTechnicianCertificationSourceLabel(certification.source),
  }
}

function getTechnicianCertificationSourceLabel(
  source: ReturnType<typeof buildTechnicianCertification>["source"]
) {
  switch (source) {
    case "CERTIFICATION_RECORD":
      return "CertificationRecord"
    case "USER_LEGACY":
      return "User legacy"
    case "MEMBERSHIP_LEGACY":
      return "CompanyMembership legacy"
    case "NONE":
      return "none"
  }
}

function optionalText(maxLength: number) {
  return z.string().trim().max(maxLength).optional().or(z.literal("")).transform((value) => value || null)
}

function optionalDate() {
  return z.string().trim().optional().or(z.literal("")).transform((value) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
  })
}
