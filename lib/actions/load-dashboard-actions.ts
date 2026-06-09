import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { getInstallationAccessWhereClause } from "@/lib/access/installation-access"
import { isContractor, type AuthenticatedUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { calculateInstallationRisk } from "@/lib/risk-classification"
import { buildServicePartnerCompanyCertification } from "@/lib/service-partner-company-certifications"
import { ensureServiceOrganizationForLegacyCompany } from "@/lib/service-organizations"
import { buildTechnicianCertification } from "@/lib/technician-certifications"

export async function loadDashboardActions(user: AuthenticatedUser) {
  const queryStartTime = getDevelopmentTimingStart()
  const [installations, servicePartnerCompanies, serviceOrganizationBridge] = await Promise.all([
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
        id: true,
        name: true,
        equipmentId: true,
        propertyName: true,
        nextInspection: true,
        refrigerantType: true,
        refrigerantAmount: true,
        hasLeakDetectionSystem: true,
        lastInspection: true,
        assignedContractorId: true,
        events: {
          where: {
            type: "LEAK",
            supersededAt: null,
          },
          select: {
            id: true,
            date: true,
          },
          orderBy: {
            date: "desc",
          },
        },
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedContractor: {
          select: {
            id: true,
            name: true,
            email: true,
            memberships: {
              where: {
                companyId: user.companyId,
                role: "CONTRACTOR",
                isActive: true,
              },
              select: {
                servicePartnerCompany: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
        assignedServicePartnerCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    isContractor(user)
      ? Promise.resolve([])
      : prisma.servicePartnerCompany.findMany({
          where: {
            companyId: user.companyId,
          },
          select: {
            id: true,
            companyId: true,
            serviceOrganizationId: true,
            name: true,
            certificateNumber: true,
            serviceOrganization: {
              select: {
                certificateNumber: true,
              },
            },
          },
        }),
    isContractor(user) && user.servicePartnerCompanyId
      ? ensureServiceOrganizationForLegacyCompany({
          companyId: user.companyId,
          servicePartnerCompanyId: user.servicePartnerCompanyId,
        })
      : Promise.resolve(null),
  ])
  const technicianMemberships =
    isContractor(user) &&
    user.servicePartnerCompanyId &&
    serviceOrganizationBridge?.serviceOrganizationId
      ? await prisma.serviceOrganizationMembership.findMany({
          where: {
            isActive: true,
            serviceOrganizationId: serviceOrganizationBridge.serviceOrganizationId,
            ...(user.isServicePartnerAdmin ? {} : { userId: user.userId }),
            user: {
              isActive: true,
              memberships: {
                some: {
                  companyId: user.companyId,
                  role: "CONTRACTOR",
                  isActive: true,
                  servicePartnerCompanyId: user.servicePartnerCompanyId,
                },
              },
            },
          },
          select: {
            role: true,
            serviceOrganization: {
              select: {
                name: true,
              },
            },
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
                    companyId: user.companyId,
                    serviceOrganizationId:
                      serviceOrganizationBridge.serviceOrganizationId,
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
                    companyId: user.companyId,
                    role: "CONTRACTOR",
                    isActive: true,
                    servicePartnerCompanyId: user.servicePartnerCompanyId,
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
      : []
  const serviceOrganizationIds = servicePartnerCompanies
    .map((company) => company.serviceOrganizationId)
    .filter((id): id is string => Boolean(id))
  const certificationRecords =
    serviceOrganizationIds.length > 0
      ? await prisma.certificationRecord.findMany({
          where: {
            companyId: user.companyId,
            serviceOrganizationId: {
              in: serviceOrganizationIds,
            },
            subjectType: "SERVICE_ORGANIZATION",
            certificateType: "COMPANY_FGAS",
            status: {
              not: "DELETED",
            },
          },
        })
      : []
  const certificationRecordsByServiceOrganization = new Map(
    serviceOrganizationIds.map((id) => [
      id,
      certificationRecords.filter((record) => record.serviceOrganizationId === id),
    ])
  )
  const servicePartnerCertificationActions = servicePartnerCompanies.map((company) => {
    const certification = buildServicePartnerCompanyCertification({
      company,
      records:
        certificationRecordsByServiceOrganization.get(
          company.serviceOrganizationId ?? ""
        ) ?? [],
    })

    return {
      id: company.id,
      name: company.name,
      certificateNumber: certification.certificateNumber,
      issuer: certification.issuer,
      validUntil: certification.validUntil,
    }
  })
  const technicianCertificationActions = technicianMemberships.map((membership) => {
    const technicianName =
      membership.user.name?.trim() || membership.user.email || "Tekniker"
    const certification = buildTechnicianCertification({
      membership: membership.user.memberships[0] ?? null,
      records: membership.user.certificationRecords,
      user: membership.user,
    })

    return {
      id: membership.user.id,
      name: technicianName,
      email: membership.user.email,
      certificateNumber: certification.certificateNumber,
      issuer: certification.issuer,
      validUntil: certification.validUntil,
      servicePartnerCompanyId: user.servicePartnerCompanyId ?? null,
      servicePartnerCompanyName: membership.serviceOrganization.name,
      href: user.isServicePartnerAdmin ? "/dashboard/service" : "/dashboard/settings",
    }
  })
  logDevelopmentTiming("loadDashboardActions installation query", queryStartTime)

  const generationStartTime = getDevelopmentTimingStart()
  const actionInstallations = installations.map((installation) => {
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
      leakageEventsCount: installation.events.length,
      isInspectionOverdue: compliance.status === "OVERDUE",
    })
    const servicePartnerCompany =
      installation.assignedServicePartnerCompany ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany ??
      null

    return {
      id: installation.id,
      name: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      nextInspection: installation.nextInspection,
      inspectionInterval: compliance.inspectionIntervalMonths,
      complianceStatus: compliance.status,
      refrigerantType: installation.refrigerantType,
      refrigerantAmount: installation.refrigerantAmount,
      assignedContractorId: installation.assignedContractorId,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      risk,
    }
  })

  const leakageEvents = installations.flatMap((installation) => {
    const servicePartnerCompany =
      installation.assignedServicePartnerCompany ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany ??
      null

    return installation.events.map((event) => ({
      id: event.id,
      installationId: installation.id,
      installationName: installation.name,
      equipmentId: installation.equipmentId,
      propertyId: installation.property?.id ?? null,
      propertyName: installation.property?.name ?? installation.propertyName,
      assignedServiceContactId: installation.assignedContractor?.id ?? null,
      assignedServiceContactName: installation.assignedContractor?.name ?? null,
      assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
      servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
      servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
      date: event.date,
    }))
  })

  const actions = generateDashboardActions({
    installations: actionInstallations,
    leakageEvents,
    servicePartnerCompanies: servicePartnerCertificationActions,
    technicians: technicianCertificationActions,
  })
  logDevelopmentTiming("loadDashboardActions action generation", generationStartTime)

  return actions
}

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}
