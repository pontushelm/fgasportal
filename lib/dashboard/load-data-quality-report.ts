import { getInstallationAccessWhereClause } from "@/lib/access/installation-access"
import { isContractor, type AuthenticatedUser } from "@/lib/auth"
import { buildDataQualityReport } from "@/lib/dashboard/data-quality"
import { prisma } from "@/lib/db"
import { buildServicePartnerCompanyCertification } from "@/lib/service-partner-company-certifications"
import { buildTechnicianCertification } from "@/lib/technician-certifications"

export async function loadDataQualityReport(user: AuthenticatedUser) {
  const { companyId } = user

  const [properties, installations, servicePartnerCompanies, technicianMemberships] =
    await Promise.all([
      prisma.property.findMany({
        where: {
          companyId,
        },
        select: {
          municipality: true,
          propertyDesignation: true,
        },
      }),
      prisma.installation.findMany({
        where: {
          AND: [
            getInstallationAccessWhereClause(user),
            {
              archivedAt: null,
              scrappedAt: null,
            },
          ],
        },
        select: {
          propertyId: true,
          refrigerantAmount: true,
          refrigerantType: true,
        },
      }),
      isContractor(user)
        ? []
        : prisma.servicePartnerCompany.findMany({
            where: {
              companyId,
            },
            select: {
              companyId: true,
              serviceOrganizationId: true,
              certificateNumber: true,
              serviceOrganization: {
                select: {
                  certificateNumber: true,
                  certificationRecords: {
                    where: {
                      companyId,
                      subjectType: "SERVICE_ORGANIZATION",
                      certificateType: "COMPANY_FGAS",
                      status: {
                        not: "DELETED",
                      },
                    },
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                },
              },
            },
          }),
      isContractor(user)
        ? []
        : prisma.companyMembership.findMany({
            where: {
              companyId,
              role: "CONTRACTOR",
              isActive: true,
              servicePartnerCompanyId: {
                not: null,
              },
              user: {
                isActive: true,
              },
            },
            select: {
              certificationNumber: true,
              certificationOrganization: true,
              certificationValidUntil: true,
              servicePartnerCompany: {
                select: {
                  companyId: true,
                  serviceOrganizationId: true,
                },
              },
              user: {
                select: {
                  certificationNumber: true,
                  certificationIssuer: true,
                  certificationValidUntil: true,
                  certificationCategory: true,
                  certificationRecords: {
                    where: {
                      companyId,
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
                },
              },
            },
          }),
    ])

  return buildDataQualityReport({
    installations,
    properties,
    servicePartnerCertifications: servicePartnerCompanies.map((company) =>
      buildServicePartnerCompanyCertification({
        company,
        records: company.serviceOrganization?.certificationRecords ?? [],
      })
    ),
    technicianCertifications: technicianMemberships.map((membership) =>
      buildTechnicianCertification({
        membership,
        records: membership.user.certificationRecords.filter(
          (record) =>
            !record.serviceOrganizationId ||
            !membership.servicePartnerCompany?.serviceOrganizationId ||
            record.serviceOrganizationId ===
              membership.servicePartnerCompany.serviceOrganizationId
        ),
        user: membership.user,
      })
    ),
  })
}
