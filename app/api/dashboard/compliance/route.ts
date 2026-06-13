import { NextRequest, NextResponse } from "next/server"
import { getInstallationAccessWhereClause } from "@/lib/access/installation-access"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { authenticateApiRequest, isContractor } from "@/lib/auth"
import { buildDashboardAnnualReportStatus } from "@/lib/dashboard/annual-report-status"
import {
  getCurrentYearRange,
  isDateInRange,
  summarizeCo2eCompleteness,
  summarizeLeakageClimateImpact,
} from "@/lib/dashboard/compliance-metrics"
import { loadDataQualityReport } from "@/lib/dashboard/load-data-quality-report"
import { prisma } from "@/lib/db"
import {
  calculateInstallationCompliance,
  type ComplianceStatus,
} from "@/lib/fgas-calculations"
import {
  calculateInstallationRisk,
  type InstallationRiskLevel,
} from "@/lib/risk-classification"
import {
  getRefrigerantRegulatoryStatus,
  isRefrigerantRegulatoryFollowUpStatus,
} from "@/lib/refrigerant-regulatory-status"
import { buildServicePartnerCompanyCertification } from "@/lib/service-partner-company-certifications"

type DistributionItem = {
  label: string
  count: number
  co2eTon: number
  refrigerantAmount: number
}

type RiskSummary = {
  high: number
  medium: number
  low: number
}

const ACTION_PREVIEW_LIMIT = 4

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request)
    if (auth.response) return auth.response

    const { companyId, userId } = auth.user
    const currentYearRange = getCurrentYearRange()
    const queryStartTime = getDevelopmentTimingStart()
    const [company, installations, propertyCount, eventCount, dataQuality] = await Promise.all([
      prisma.company.findUnique({
        where: {
          id: companyId,
        },
        select: {
          name: true,
          organizationNumber: true,
          orgNumber: true,
          contactPerson: true,
          contactEmail: true,
          contactPhone: true,
          phone: true,
          address: true,
          postalCode: true,
          city: true,
        },
      }),
      prisma.installation.findMany({
      where: {
        AND: [
          getInstallationAccessWhereClause(auth.user),
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
        location: true,
        refrigerantType: true,
        refrigerantAmount: true,
        hasLeakDetectionSystem: true,
        lastInspection: true,
        nextInspection: true,
        assignedContractorId: true,
        propertyName: true,
        events: {
          where: {
            type: "LEAK",
            supersededAt: null,
          },
          select: {
            id: true,
            installationId: true,
            date: true,
            refrigerantAddedKg: true,
          },
          orderBy: {
            date: "desc",
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            municipality: true,
          },
        },
        assignedServicePartnerCompany: {
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
                companyId,
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
      },
      orderBy: {
        createdAt: "desc",
      },
      }),
      prisma.property.count({
        where: {
          companyId,
        },
      }),
      prisma.installationEvent.count({
        where: {
          supersededAt: null,
          installation: {
            AND: [
              getInstallationAccessWhereClause(auth.user),
              {
                archivedAt: null,
                scrappedAt: null,
              },
            ],
          },
        },
      }),
      loadDataQualityReport(auth.user),
    ])
    const servicePartnerCompanies = isContractor(auth.user)
      ? []
      : await prisma.servicePartnerCompany.findMany({
          where: {
            companyId,
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
        })
    const serviceOrganizationIds = servicePartnerCompanies
      .map((company) => company.serviceOrganizationId)
      .filter((id): id is string => Boolean(id))
    const certificationRecords =
      serviceOrganizationIds.length > 0
        ? await prisma.certificationRecord.findMany({
            where: {
              companyId,
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
    logDevelopmentTiming("GET /api/dashboard/compliance prisma query", queryStartTime)

    const mappingStartTime = getDevelopmentTimingStart()
    const statusCounts: Record<ComplianceStatus, number> = {
      OK: 0,
      DUE_SOON: 0,
      OVERDUE: 0,
      NOT_REQUIRED: 0,
      NOT_INSPECTED: 0,
    }
    const refrigerantMap = new Map<string, DistributionItem>()
    const riskSummary: RiskSummary = {
      high: 0,
      medium: 0,
      low: 0,
    }
    const installationRows = installations.map((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )

      statusCounts[compliance.status] += 1
      const leakageEventsCount = installation.events.length
      const risk = calculateInstallationRisk({
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        gwp: compliance.gwp,
        hasLeakDetectionSystem: installation.hasLeakDetectionSystem,
        leakageEventsCount,
        isInspectionOverdue: compliance.status === "OVERDUE",
      })
      incrementRiskSummary(riskSummary, risk.level)
      const servicePartnerCompany =
        installation.assignedServicePartnerCompany ??
        installation.assignedContractor?.memberships[0]?.servicePartnerCompany ??
        null

      const refrigerantType =
        installation.refrigerantType?.trim() || "Okänt köldmedium"
      const refrigerant = refrigerantMap.get(refrigerantType) ?? {
        label: refrigerantType,
        count: 0,
        co2eTon: 0,
        refrigerantAmount: 0,
      }
      refrigerant.count += 1
      refrigerant.co2eTon += compliance.co2eTon ?? 0
      refrigerant.refrigerantAmount += installation.refrigerantAmount
      refrigerantMap.set(refrigerantType, refrigerant)

      return {
        id: installation.id,
        name: installation.name,
        equipmentId: installation.equipmentId,
        location: installation.location,
        refrigerantType: installation.refrigerantType,
        refrigerantAmount: installation.refrigerantAmount,
        gwp: compliance.gwp,
        co2eTon: compliance.co2eTon,
        baseInspectionInterval: compliance.baseInspectionIntervalMonths,
        inspectionInterval: compliance.inspectionIntervalMonths,
        hasAdjustedInspectionInterval: compliance.hasAdjustedInspectionInterval,
        complianceStatus: compliance.status,
        daysUntilDue: compliance.daysUntilDue,
        nextInspection: installation.nextInspection,
        lastInspection: installation.lastInspection,
        assignedContractorId: installation.assignedContractorId,
        assignedServiceContactId: installation.assignedContractor?.id ?? null,
        assignedServiceContactName: installation.assignedContractor?.name ?? null,
        assignedServiceContactEmail: installation.assignedContractor?.email ?? null,
        servicePartnerCompanyId: servicePartnerCompany?.id ?? null,
        servicePartnerCompanyName: servicePartnerCompany?.name ?? null,
        propertyId: installation.property?.id ?? null,
        propertyName: installation.property?.name ?? installation.propertyName,
        leakageEventsCount,
        risk,
      }
    })
    const refrigerantRegulatorySummary = installationRows.reduce(
      (summary, installation) => {
        const status = getRefrigerantRegulatoryStatus({
          refrigerantType: installation.refrigerantType,
          refrigerantAmountKg: installation.refrigerantAmount,
        }).status

        summary[status] += 1
        if (isRefrigerantRegulatoryFollowUpStatus(status)) {
          summary.followUp += 1
        }

        return summary
      },
      {
        OK: 0,
        REVIEW: 0,
        RESTRICTED: 0,
        PHASE_OUT_RISK: 0,
        UNKNOWN: 0,
        followUp: 0,
      }
    )

    const leakageEvents = installations.flatMap((installation) =>
      installation.events.map((event) => ({
        ...event,
        installationName: installation.name,
        equipmentId: installation.equipmentId,
        installationLocation: installation.location,
        refrigerantType: installation.refrigerantType,
        propertyId: installation.property?.id ?? null,
        propertyName: installation.property?.name ?? installation.propertyName,
      }))
    )
    const currentYearLeakageEvents = leakageEvents.filter((event) =>
      isDateInRange(event.date, currentYearRange)
    )
    const leakageClimateImpact = summarizeLeakageClimateImpact(
      currentYearLeakageEvents.map((event) => ({
        leakageKg: event.refrigerantAddedKg,
        refrigerantType: event.refrigerantType,
      }))
    )
    const leakageInstallationCount = new Set(
      currentYearLeakageEvents.map((event) => event.installationId)
    ).size
    const allActionItems = generateDashboardActions({
      installations: installationRows,
      leakageEvents,
      servicePartnerCompanies: servicePartnerCertificationActions,
    })
    const actionItems = allActionItems.slice(0, ACTION_PREVIEW_LIMIT)
    const co2eCompleteness = summarizeCo2eCompleteness(installationRows)
    const totalRefrigerantAmount = installationRows.reduce(
      (sum, installation) => sum + installation.refrigerantAmount,
      0
    )
    const requiringInspection = installationRows.filter(
      (installation) => installation.inspectionInterval !== null
    ).length
    const installationsMissingPropertyCount = installationRows.filter(
      (installation) => !installation.propertyId
    ).length
    const propertyMetadata = new Map(
      installations
        .filter((installation) => installation.property)
        .map((installation) => [
          installation.property!.id,
          {
            id: installation.property!.id,
            name: installation.property!.name,
            municipality: installation.property!.municipality,
          },
        ])
    )
    const reportProperties = Array.from(propertyMetadata.values()).map((property) => {
      const propertyInstallations = installationRows.filter(
        (installation) => installation.propertyId === property.id
      )
      const hasUnknownCo2e = propertyInstallations.some(
        (installation) => installation.co2eTon === null
      )
      const installedCo2eTon = propertyInstallations.reduce(
        (sum, installation) =>
          installation.inspectionInterval !== null && installation.co2eTon !== null
            ? sum + installation.co2eTon
            : sum,
        0
      )

      return {
        ...property,
        installedCo2eTon,
        co2eIsComplete: !hasUnknownCo2e,
      }
    })
    const signedReportRecords = await prisma.signedAnnualFgasReport.findMany({
      where: {
        companyId,
        reportYear: currentYearRange.startDate.getFullYear(),
        ...(isContractor(auth.user) ? { userId } : {}),
      },
      select: {
        propertyId: true,
        readinessStatus: true,
        blockingIssueCount: true,
        reviewWarningCount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
    const annualReportStatus = buildDashboardAnnualReportStatus({
      properties: reportProperties,
      records: signedReportRecords,
      year: currentYearRange.startDate.getFullYear(),
    })
    logDevelopmentTiming("GET /api/dashboard/compliance mapping", mappingStartTime)

    return NextResponse.json(
      {
        metrics: {
          totalInstallations: installationRows.length,
          ok: statusCounts.OK,
          overdue: statusCounts.OVERDUE,
          dueSoon: statusCounts.DUE_SOON,
          notInspected: statusCounts.NOT_INSPECTED,
          notRequired: statusCounts.NOT_REQUIRED,
        },
        environmental: {
          totalCo2eTon: co2eCompleteness.totalCo2eTon,
          co2eIsComplete: co2eCompleteness.isComplete,
          unknownCo2eInstallations: co2eCompleteness.unknownCo2eInstallations,
          totalRefrigerantAmount,
          requiringInspection,
          leakageInstallationCount,
          leakageEvents: currentYearLeakageEvents.length,
          leakageYear: currentYearRange.startDate.getFullYear(),
          leakageCo2eTon: leakageClimateImpact.totalCo2eTon,
          leakageCo2eIsComplete: leakageClimateImpact.isComplete,
          unknownLeakageCo2eEvents: leakageClimateImpact.unknownEvents,
        },
        annualReportStatus,
        refrigerantRegulatorySummary,
        riskSummary,
        statusDistribution: statusCounts,
        refrigerantDistribution: Array.from(refrigerantMap.values()).sort(
          (first, second) => second.count - first.count
        ),
        actionItemTotal: allActionItems.length,
        actionItems,
        dataQuality: {
          score: dataQuality.score,
          totalIssueCount: dataQuality.totalIssueCount,
          issueCategoryCount: dataQuality.issueCategoryCount,
          topIssues: dataQuality.topIssues,
        },
        setup: {
          actionItemCount: allActionItems.length,
          annualReportReadinessSatisfied:
            annualReportStatus.requiredReportsRequiringCompletion === 0 &&
            dataQuality.totalIssueCount === 0 &&
            propertyCount > 0 &&
            installationRows.length > 0,
          companyInfoCompleted: isCompanyInfoCompleted(company),
          dataQualityIssueCount: dataQuality.totalIssueCount,
          eventCount,
          propertyCount,
          installationCount: installationRows.length,
          installationsMissingPropertyCount,
          servicePartnerConnected:
            servicePartnerCompanies.length > 0 ||
            installationRows.some((installation) =>
              Boolean(installation.servicePartnerCompanyId)
            ),
        },
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error("Get compliance dashboard error:", error)

    return NextResponse.json(
      { error: "Ett oväntat fel uppstod" },
      { status: 500 }
    )
  }
}

function incrementRiskSummary(
  summary: RiskSummary,
  level: InstallationRiskLevel
) {
  if (level === "HIGH") summary.high += 1
  if (level === "MEDIUM") summary.medium += 1
  if (level === "LOW") summary.low += 1
}

function getDevelopmentTimingStart() {
  return process.env.NODE_ENV === "development" ? performance.now() : null
}

function logDevelopmentTiming(label: string, startTime: number | null) {
  if (startTime === null) return
  console.info(`[perf] ${label}: ${Math.round(performance.now() - startTime)}ms`)
}

function isCompanyInfoCompleted(
  company: {
    address: string | null
    city: string | null
    contactEmail: string | null
    contactPerson: string | null
    contactPhone: string | null
    name: string
    orgNumber: string | null
    organizationNumber: string | null
    phone: string | null
    postalCode: string | null
  } | null
) {
  if (!company) return false

  return [
    company.name,
    company.organizationNumber || company.orgNumber,
    company.contactPerson,
    company.contactEmail,
    company.contactPhone || company.phone,
    company.address,
    company.postalCode,
    company.city,
  ].every((value) => Boolean(value?.trim()))
}
