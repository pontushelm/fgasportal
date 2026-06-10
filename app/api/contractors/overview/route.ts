import { NextRequest, NextResponse } from "next/server"
import { authenticateApiRequest, forbiddenResponse, isAdmin, isContractor } from "@/lib/auth"
import { getCertificationStatus } from "@/lib/certification-status"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import { calculateInstallationRisk } from "@/lib/risk-classification"
import { buildServicePartnerCompanyMetrics } from "@/lib/service-partner-company-metrics"
import {
  buildServicePartnerCompanyCertification,
  isServicePartnerCompanyCertificationWarning,
} from "@/lib/service-partner-company-certifications"
import { toServiceOrganizationBackedCompany } from "@/lib/service-organizations"
import { buildTechnicianCertification } from "@/lib/technician-certifications"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response
    if (isContractor(auth.user)) return forbiddenResponse()
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(currentYear, 0, 1))
    const nextYearStart = new Date(Date.UTC(currentYear + 1, 0, 1))

    const queryStartTime = getDevelopmentTimingStart()
    const [memberships, servicePartnerCompanies] = await Promise.all([
      prisma.companyMembership.findMany({
        where: {
          companyId: auth.user.companyId,
          role: "CONTRACTOR",
          isActive: true,
          user: {
            isActive: true,
          },
        },
        include: {
          servicePartnerCompany: {
            select: {
              id: true,
              name: true,
              organizationNumber: true,
              contactEmail: true,
              phone: true,
              certificateNumber: true,
              notes: true,
              companyId: true,
              serviceOrganizationId: true,
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
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              certificationNumber: true,
              certificationIssuer: true,
              certificationValidUntil: true,
              certificationCategory: true,
              certificationRecords: {
                where: {
                  companyId: auth.user.companyId,
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
              assignedInstallations: {
                where: {
                  companyId: auth.user.companyId,
                  archivedAt: null,
                  scrappedAt: null,
                },
                select: {
                  refrigerantType: true,
                  refrigerantAmount: true,
                  hasLeakDetectionSystem: true,
                  lastInspection: true,
                  nextInspection: true,
                  events: {
                    where: {
                      type: "LEAK",
                      supersededAt: null,
                      date: {
                        gte: yearStart,
                        lt: nextYearStart,
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                  activityLogs: {
                    orderBy: {
                      createdAt: "desc",
                    },
                    select: {
                      createdAt: true,
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: [
          {
            user: {
              name: "asc",
            },
          },
          {
            user: {
              email: "asc",
            },
          },
        ],
      }),
      prisma.servicePartnerCompany.findMany({
        where: {
          companyId: auth.user.companyId,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          companyId: true,
          serviceOrganizationId: true,
          name: true,
          organizationNumber: true,
          contactEmail: true,
          phone: true,
          certificateNumber: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
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
      }),
    ])
    logDevelopmentTiming("GET /api/contractors/overview queries", queryStartTime)

    const serviceOrganizationIds = Array.from(
      new Set(
        [
          ...servicePartnerCompanies.map((company) => company.serviceOrganizationId),
          ...memberships.map(
            (membership) =>
              membership.servicePartnerCompany?.serviceOrganizationId ?? null
          ),
        ].filter((id): id is string => Boolean(id))
      )
    )
    const certificationRecords =
      serviceOrganizationIds.length > 0
        ? await prisma.certificationRecord.findMany({
            where: {
              companyId: auth.user.companyId,
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
        certificationRecords.filter(
          (record) => record.serviceOrganizationId === id
        ),
      ])
    )
    const servicePartnerCompanyRows = servicePartnerCompanies.map((company) => {
      const displayCompany = toServiceOrganizationBackedCompany(company)

      return {
        ...displayCompany,
        certification: buildServicePartnerCompanyCertification({
          company,
          records:
            certificationRecordsByServiceOrganization.get(
              displayCompany.serviceOrganizationId ?? ""
            ) ?? [],
        }),
      }
    })
    const servicePartnerCompaniesById = new Map(
      servicePartnerCompanyRows.map((company) => [company.id, company])
    )

    const calculationStartTime = getDevelopmentTimingStart()
    const rows = memberships.map((membership) => {
      const contractor = membership.user
      let overdueInspections = 0
      let dueSoonInspections = 0
      let highRiskInstallations = 0
      let leakageEventsCount = 0
      let latestActivityDate: Date | null = null

      contractor.assignedInstallations.forEach((installation) => {
        const compliance = calculateInstallationCompliance(
          installation.refrigerantType,
          installation.refrigerantAmount,
          installation.hasLeakDetectionSystem,
          installation.lastInspection,
          installation.nextInspection
        )

        if (compliance.status === "OVERDUE") overdueInspections += 1
        if (compliance.status === "DUE_SOON") dueSoonInspections += 1

        const installationLeakageEventsCount = installation.events.length
        leakageEventsCount += installationLeakageEventsCount

        const risk = calculateInstallationRisk({
          refrigerantType: installation.refrigerantType,
          refrigerantAmount: installation.refrigerantAmount,
          gwp: compliance.gwp,
          hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
          leakageEventsCount: installationLeakageEventsCount,
          isInspectionOverdue: compliance.status === "OVERDUE",
        })

        if (risk.level === "HIGH") highRiskInstallations += 1

        const latestInstallationActivity = installation.activityLogs[0]?.createdAt
        if (
          latestInstallationActivity &&
          (!latestActivityDate || latestInstallationActivity > latestActivityDate)
        ) {
          latestActivityDate = latestInstallationActivity
        }
      })

      return {
        id: contractor.id,
        membershipId: membership.id,
        name: contractor.name,
        email: contractor.email,
        isActive: contractor.isActive,
        isCertifiedCompany: membership.isCertifiedCompany,
        certificationNumber: membership.certificationNumber,
        certificationOrganization: membership.certificationOrganization,
        certificationValidUntil: membership.certificationValidUntil,
        certificationStatus: getCertificationStatus({
          isCertifiedCompany: membership.isCertifiedCompany,
          validUntil: membership.certificationValidUntil,
        }),
        technicianCertification: toTechnicianCertificationResponse(
          buildTechnicianCertification({
            membership,
            records: contractor.certificationRecords,
            user: contractor,
          })
        ),
        servicePartnerCompany: membership.servicePartnerCompany
          ? servicePartnerCompaniesById.get(membership.servicePartnerCompany.id) ??
            {
              ...toServiceOrganizationBackedCompany(
                membership.servicePartnerCompany
              ),
              certification: buildServicePartnerCompanyCertification({
                company: membership.servicePartnerCompany,
                records:
                  certificationRecordsByServiceOrganization.get(
                    membership.servicePartnerCompany.serviceOrganizationId ?? ""
                  ) ?? [],
              }),
            }
          : null,
        assignedInstallationsCount: contractor.assignedInstallations.length,
        overdueInspections,
        dueSoonInspections,
        highRiskInstallations,
        leakageEventsCount,
        latestActivityDate,
      }
    }).sort((first, second) => {
      const firstCompany = first.servicePartnerCompany?.name ?? ""
      const secondCompany = second.servicePartnerCompany?.name ?? ""
      const companyComparison = firstCompany.localeCompare(secondCompany, "sv")
      if (companyComparison !== 0) return companyComparison
      return first.name.localeCompare(second.name, "sv")
    })

    const summary = rows.reduce(
      (totals, contractor) => ({
        totalContractors: totals.totalContractors + 1,
        assignedInstallations:
          totals.assignedInstallations + contractor.assignedInstallationsCount,
        overdueInspections:
          totals.overdueInspections + contractor.overdueInspections,
        highRiskInstallations:
          totals.highRiskInstallations + contractor.highRiskInstallations,
        expiredCertifications: totals.expiredCertifications,
      }),
      {
        totalContractors: 0,
        assignedInstallations: 0,
        overdueInspections: 0,
        highRiskInstallations: 0,
        expiredCertifications: 0,
      }
    )
    summary.expiredCertifications = servicePartnerCompanyRows.filter((company) =>
      isServicePartnerCompanyCertificationWarning(company.certification)
    ).length

    const servicePartnerCompanyMetrics = buildServicePartnerCompanyMetrics({
      companies: servicePartnerCompanyRows,
      contractors: rows,
    })
    logDevelopmentTiming(
      "GET /api/contractors/overview calculations",
      calculationStartTime
    )

    return NextResponse.json(
      {
        permissions: {
          canManageServicePartners: isAdmin(auth.user),
        },
        summary,
        servicePartnerCompanies: servicePartnerCompanyRows,
        servicePartnerCompanyMetrics,
        contractors: rows,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get contractors overview error:", error)

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
    source: certification.source,
  }
}

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}
