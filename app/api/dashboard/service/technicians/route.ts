import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canManageServicepartnerTechnicianAssignments } from "@/lib/access/installation-access"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"
import { buildTechnicianCertification } from "@/lib/technician-certifications"

export async function GET(request: NextRequest) {
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

    const bridge = await ensureServiceOrganizationForLegacyCompany({
      companyId: auth.user.companyId,
      servicePartnerCompanyId: auth.user.servicePartnerCompanyId!,
    })

    if (!bridge) return forbiddenResponse()

    const technicians = await prisma.serviceOrganizationMembership.findMany({
      where: {
        isActive: true,
        serviceOrganizationId: bridge.serviceOrganizationId,
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
        id: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            certificationNumber: true,
            certificationIssuer: true,
            certificationValidUntil: true,
            certificationCategory: true,
            certificationRecords: {
              where: {
                companyId: auth.user.companyId,
                serviceOrganizationId: bridge.serviceOrganizationId,
                subjectType: "TECHNICIAN",
                certificateType: "PERSONAL_FGAS",
                status: {
                  not: "DELETED",
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
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
      orderBy: [
        {
          user: { name: "asc" },
        },
        {
          user: { email: "asc" },
        },
      ],
    })

    return NextResponse.json(
      technicians.map((membership) => ({
        membershipId: membership.id,
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        isServicePartnerAdmin: membership.role === "ADMIN",
        certification: toTechnicianCertificationResponse(
          buildTechnicianCertification({
            membership: membership.user.memberships[0] ?? null,
            records: membership.user.certificationRecords,
            user: membership.user,
          })
        ),
      })),
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get servicepartner technicians error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
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
