import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { logActivity } from "@/lib/activity-log"
import { prisma } from "@/lib/db"
import {
  calculateCertificationRecordStatus,
  normalizeCertificateNumber,
  selectActiveCompanyFgasCertificate,
  type CertificationRecordLike,
} from "@/lib/certifications"
import {
  ensureServiceOrganizationForLegacyCompany,
  toServiceOrganizationBackedCompany,
  type LegacyServicePartnerCompanyWithOrganization,
} from "@/lib/service-organizations"
import {
  canEditServicePartnerCompanySettings,
  canViewServicePartnerCompanySettings,
} from "@/lib/servicepartner-company-settings-access"

const servicePartnerSettingsSchema = z.object({
  name: z.string().trim().min(1, "Namn krävs").max(160),
  contactEmail: z.string().trim().email("Ogiltig e-postadress").optional().or(z.literal("")).transform((value) => value || null),
  phone: optionalText(40),
  certificateNumber: optionalText(120),
  certificateIssuer: optionalText(160),
  certificateValidUntil: optionalDate(),
})

type ServicePartnerSettingsRecord = LegacyServicePartnerCompanyWithOrganization
type CompanyCertificationRecord = CertificationRecordLike & {
  issuer: string | null
  validUntil: Date | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!canViewServicePartnerCompanySettings(auth.user)) return forbiddenResponse()

    const bridge = await ensureServiceOrganizationForLegacyCompany({
      companyId: auth.user.companyId,
      servicePartnerCompanyId: auth.user.servicePartnerCompanyId!,
    })

    if (!bridge) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    const servicePartnerCompany = await prisma.servicePartnerCompany.findFirst({
      where: {
        id: auth.user.servicePartnerCompanyId!,
        companyId: auth.user.companyId,
      },
      select: servicePartnerSettingsSelect,
    })

    if (!servicePartnerCompany) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    const certification = await getServiceOrganizationCompanyCertification({
      companyId: auth.user.companyId,
      serviceOrganizationId: bridge.serviceOrganizationId,
    })

    return NextResponse.json(
      withCertificationPayload(servicePartnerCompany, certification),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get servicepartner company settings error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (!canEditServicePartnerCompanySettings(auth.user)) return forbiddenResponse()

    const body = await request.json()
    const data = servicePartnerSettingsSchema.parse(body)
    const bridge = await ensureServiceOrganizationForLegacyCompany({
      companyId: auth.user.companyId,
      servicePartnerCompanyId: auth.user.servicePartnerCompanyId!,
    })

    if (!bridge) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    const servicePartnerCompany = await prisma.servicePartnerCompany.findFirst({
      where: {
        id: auth.user.servicePartnerCompanyId!,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
      },
    })

    if (!servicePartnerCompany) {
      return NextResponse.json(
        { error: "Servicepartnerföretaget hittades inte" },
        { status: 404 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedServiceOrganization =
        await tx.serviceOrganization.update({
          where: {
            id: bridge.serviceOrganizationId,
          },
          data: {
            name: data.name,
            contactEmail: data.contactEmail,
            phone: data.phone,
            certificateNumber: data.certificateNumber,
          },
          select: {
            id: true,
            name: true,
            organizationNumber: true,
            contactEmail: true,
            phone: true,
            certificateNumber: true,
          },
        })

      const updatedServicePartnerCompany =
        await tx.servicePartnerCompany.update({
          where: {
            id: servicePartnerCompany.id,
          },
          data: {
            name: data.name,
            contactEmail: data.contactEmail,
            phone: data.phone,
            certificateNumber: data.certificateNumber,
          },
          select: {
            ...servicePartnerSettingsSelect,
            serviceOrganization: {
              select: {
                id: true,
                name: true,
                organizationNumber: true,
                contactEmail: true,
                phone: true,
                certificateNumber: true,
              },
            },
          },
        })

      const certification = await upsertServiceOrganizationCompanyCertification({
        certificateIssuer: data.certificateIssuer,
        certificateNumber: data.certificateNumber,
        certificateValidUntil: data.certificateValidUntil,
        companyId: auth.user.companyId,
        serviceOrganizationId: bridge.serviceOrganizationId,
        tx,
        userId: auth.user.userId,
      })

      return {
        certification,
        serviceOrganization: updatedServiceOrganization,
        servicePartnerCompany: updatedServicePartnerCompany,
      }
    })

    const updatedServicePartnerCompany: ServicePartnerSettingsRecord = {
      ...result.servicePartnerCompany,
      serviceOrganization: result.servicePartnerCompany.serviceOrganization
        ? {
            ...result.servicePartnerCompany.serviceOrganization,
            certificateNumber:
              result.certification?.certificateNumber ??
              result.servicePartnerCompany.serviceOrganization.certificateNumber,
          }
        : null,
    }
    const certification =
      result.certification ??
      (await getServiceOrganizationCompanyCertification({
        companyId: auth.user.companyId,
        serviceOrganizationId: bridge.serviceOrganizationId,
      }))

    await logActivity({
      companyId: auth.user.companyId,
      userId: auth.user.userId,
      action: "service_partner_company_settings_updated",
      entityType: "service_partner_company",
      entityId: servicePartnerCompany.id,
      metadata: {
        serviceOrganizationId: result.serviceOrganization.id,
        updatedFields: Object.keys(data),
      },
    })

    return NextResponse.json(
      withCertificationPayload(updatedServicePartnerCompany, certification),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Update servicepartner company settings error:", error)

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

async function getServiceOrganizationCompanyCertification({
  companyId,
  serviceOrganizationId,
}: {
  companyId: string
  serviceOrganizationId: string
}) {
  const records = await prisma.certificationRecord.findMany({
    where: {
      companyId,
      serviceOrganizationId,
      subjectType: "SERVICE_ORGANIZATION",
      certificateType: "COMPANY_FGAS",
      status: {
        not: "DELETED",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return selectActiveCompanyFgasCertificate(records) as CompanyCertificationRecord | null
}

async function upsertServiceOrganizationCompanyCertification({
  certificateIssuer,
  certificateNumber,
  certificateValidUntil,
  companyId,
  serviceOrganizationId,
  tx,
  userId,
}: {
  certificateIssuer: string | null
  certificateNumber: string | null
  certificateValidUntil: Date | null
  companyId: string
  serviceOrganizationId: string
  tx: {
    certificationRecord: {
      create(args: unknown): Promise<CompanyCertificationRecord>
      findFirst(args: unknown): Promise<{ id: string } | null>
      update(args: unknown): Promise<CompanyCertificationRecord>
    }
  }
  userId: string
}) {
  const normalizedCertificateNumber = normalizeCertificateNumber(certificateNumber)
  const existingRecord = await tx.certificationRecord.findFirst({
    where: {
      companyId,
      serviceOrganizationId,
      subjectType: "SERVICE_ORGANIZATION",
      certificateType: "COMPANY_FGAS",
      status: {
        notIn: ["DELETED", "REVOKED", "REPLACED"],
      },
    },
    select: {
      id: true,
    },
  })

  if (!normalizedCertificateNumber) {
    if (existingRecord) {
      await tx.certificationRecord.update({
        where: {
          id: existingRecord.id,
        },
        data: {
          status: "DELETED",
          updatedByUserId: userId,
        },
      })
    }
    return null
  }

  const data = {
    certificateNumber: normalizedCertificateNumber,
    issuer: certificateIssuer,
    validUntil: certificateValidUntil,
    verificationStatus: "SELF_DECLARED" as const,
    status: "ACTIVE" as const,
    updatedByUserId: userId,
  }

  if (existingRecord) {
    return tx.certificationRecord.update({
      where: {
        id: existingRecord.id,
      },
      data,
    })
  }

  return tx.certificationRecord.create({
    data: {
      companyId,
      serviceOrganizationId,
      userId: null,
      subjectType: "SERVICE_ORGANIZATION",
      certificateType: "COMPANY_FGAS",
      ...data,
      createdByUserId: userId,
    },
  })
}

function withCertificationPayload(
  servicePartnerCompany: ServicePartnerSettingsRecord,
  certification: CompanyCertificationRecord | null
) {
  const backedCompany = toServiceOrganizationBackedCompany(servicePartnerCompany)
  const certificateNumber =
    certification?.certificateNumber ?? backedCompany.certificateNumber
  const status = calculateCertificationRecordStatus({
    certificateNumber,
    status: certification?.status ?? "ACTIVE",
    validUntil: certification?.validUntil,
  })

  return {
    ...backedCompany,
    certificateNumber,
    certification: {
      certificateNumber,
      issuer: certification?.issuer ?? null,
      validUntil: certification?.validUntil ?? null,
      status,
      source: certification ? "CERTIFICATION_RECORD" : "LEGACY",
    },
  }
}

const servicePartnerSettingsSelect = {
  id: true,
  companyId: true,
  serviceOrganizationId: true,
  name: true,
  organizationNumber: true,
  contactEmail: true,
  phone: true,
  certificateNumber: true,
  serviceOrganization: {
    select: {
      id: true,
      name: true,
      organizationNumber: true,
      contactEmail: true,
      phone: true,
      certificateNumber: true,
    },
  },
}
