import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON } from "@/lib/dashboard/annual-report-status"
import { buildAnnualFgasReportData } from "@/lib/reports/buildAnnualFgasReportData"
import {
  ANNUAL_FGAS_EVENT_LABELS,
  buildAnnualFgasReportQualitySummary,
  buildAnnualFgasReportWarnings,
} from "@/lib/reports/annualFgasReportValidation"
import { summarizeAnnualFgasCo2e } from "@/lib/reports/annualFgasReportSummary"
import {
  resolveAnnualFgasInstallationCertification,
  type AnnualFgasResolvedInstallationCertification,
} from "@/lib/reports/annualFgasCertification"
import type {
  AnnualFgasCertificateEntry,
  AnnualFgasEquipmentRow,
  AnnualFgasReportData,
  AnnualFgasReportQualitySummary,
  AnnualFgasReportWarningSeverity,
  AnnualFgasScrappedEquipmentRow,
} from "@/lib/reports/annualFgasReportTypes"

export type FgasReportEventType =
  | "INSPECTION"
  | "LEAK"
  | "REFILL"
  | "SERVICE"
  | "REPAIR"
  | "RECOVERY"
  | "REFRIGERANT_CHANGE"

export type FgasReportData = {
  year: number
  period: {
    startDate: Date
    endDate: Date
  }
  metrics: {
    totalInstallations: number
    totalRefrigerantAmountKg: number
    totalCo2eTon: number | null
    knownCo2eTon: number
    unknownCo2eInstallations: number
    requiringInspection: number
    inspectionsPerformed: number
    leakageEvents: number
    refilledAmountKg: number
    serviceEvents: number
  }
  warnings: Array<{
    id: string
    severity: AnnualFgasReportWarningSeverity
    message: string
    installationName?: string | null
  }>
  qualitySummary: AnnualFgasReportQualitySummary
  refrigerants: Array<{
    refrigerantType: string
    installationCount: number
    totalAmountKg: number
    totalCo2eTon: number | null
    refilledAmountKg: number
    leakageEvents: number
  }>
  events: Array<{
    id: string
    date: Date
    installationId: string
    installationName: string
    refrigerantType: string
    type: FgasReportEventType
    refrigerantAddedKg: number | null
    previousRefrigerantType: string | null
    newRefrigerantType: string | null
    previousAmountKg: number | null
    newAmountKg: number | null
    recoveredAmountKg: number | null
    notes: string | null
  }>
  annualReportOverview?: AnnualFgasReportPropertyOverview
}

type RefrigerantSummary = FgasReportData["refrigerants"][number]

export type AnnualFgasReportPropertyOverview = {
  year: number
  properties: Array<{
    id: string
    name: string
    municipality: string | null
    installedCo2eTon: number | null
    annualReportRequirement: "REQUIRED" | "NOT_REQUIRED" | "UNCERTAIN"
    signedStatus: "SIGNED" | "NOT_SIGNED"
    signedAt: Date | null
    blockingIssueCount: number
    reviewWarningCount: number
  }>
}

const ANNUAL_EVENT_TYPE_BY_LABEL = Object.fromEntries(
  Object.entries(ANNUAL_FGAS_EVENT_LABELS).map(([type, label]) => [label, type])
) as Record<string, FgasReportEventType>

const UNKNOWN_REFRIGERANT = "Okänt köldmedium"

const annualOverviewInstallationSelect = {
  id: true,
  name: true,
  equipmentId: true,
  location: true,
  propertyName: true,
  equipmentType: true,
  refrigerantType: true,
  refrigerantAmount: true,
  hasLeakDetectionSystem: true,
  installationDate: true,
  lastInspection: true,
  nextInspection: true,
  isActive: true,
  archivedAt: true,
  scrappedAt: true,
  recoveredRefrigerantKg: true,
  scrapCertificateFileName: true,
  scrapComment: true,
  assignedContractorId: true,
  assignedServicePartnerCompanyId: true,
  property: {
    select: {
      id: true,
      name: true,
      municipality: true,
      propertyDesignation: true,
    },
  },
  assignedServicePartnerCompany: {
    select: {
      companyId: true,
      name: true,
      certificateNumber: true,
      serviceOrganizationId: true,
      serviceOrganization: {
        select: {
          id: true,
          name: true,
          certificateNumber: true,
          certificationRecords: {
            select: {
              id: true,
              companyId: true,
              serviceOrganizationId: true,
              userId: true,
              subjectType: true,
              certificateType: true,
              certificateNumber: true,
              issuer: true,
              category: true,
              validFrom: true,
              validUntil: true,
              status: true,
              verificationStatus: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
  assignedContractor: {
    select: {
      id: true,
      companyId: true,
      name: true,
      certificationNumber: true,
      certificationIssuer: true,
      certificationValidUntil: true,
      certificationCategory: true,
      certificationRecords: {
        select: {
          id: true,
          companyId: true,
          serviceOrganizationId: true,
          userId: true,
          subjectType: true,
          certificateType: true,
          certificateNumber: true,
          issuer: true,
          category: true,
          validFrom: true,
          validUntil: true,
          status: true,
          verificationStatus: true,
          createdAt: true,
        },
      },
      company: {
        select: {
          name: true,
        },
      },
      memberships: {
        select: {
          certificationNumber: true,
          certificationOrganization: true,
          certificationValidUntil: true,
          servicePartnerCompany: {
            select: {
              companyId: true,
              name: true,
              certificateNumber: true,
              serviceOrganizationId: true,
              serviceOrganization: {
                select: {
                  id: true,
                  name: true,
                  certificateNumber: true,
                  certificationRecords: {
                    select: {
                      id: true,
                      companyId: true,
                      serviceOrganizationId: true,
                      userId: true,
                      subjectType: true,
                      certificateType: true,
                      certificateNumber: true,
                      issuer: true,
                      category: true,
                      validFrom: true,
                      validUntil: true,
                      status: true,
                      verificationStatus: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 1,
      },
    },
  },
  events: {
    select: {
      id: true,
      type: true,
      refrigerantAddedKg: true,
      previousRefrigerantType: true,
      newRefrigerantType: true,
      previousAmountKg: true,
      newAmountKg: true,
      recoveredAmountKg: true,
      notes: true,
    },
  },
} satisfies Prisma.InstallationSelect

type AnnualOverviewInstallation = Prisma.InstallationGetPayload<{
  select: typeof annualOverviewInstallationSelect
}>

type AnnualOverviewSignedReportRecord = {
  propertyId: string | null
  createdAt: Date
}

export function parseReportYear(value: string | null) {
  const currentYear = new Date().getFullYear()
  const year = value ? Number(value) : currentYear

  if (!Number.isInteger(year) || year < 2000 || year > currentYear + 1) {
    return null
  }

  return year
}

export async function getFgasAnnualReport({
  companyId,
  assignedContractorId,
  municipality,
  propertyId,
  year,
}: {
  companyId: string
  assignedContractorId?: string
  municipality?: string
  propertyId?: string
  year: number
}): Promise<FgasReportData> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))
  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      archivedAt: null,
      OR: [
        { scrappedAt: null },
        { scrappedAt: { gte: startDate, lt: endDate } },
      ],
      ...(assignedContractorId ? { assignedContractorId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(municipality ? { property: { municipality } } : {}),
    },
    include: {
      events: {
        where: {
          supersededAt: null,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          date: "desc",
        },
      },
      inspections: {
        where: {
          inspectionDate: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: {
          inspectionDate: "desc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  const refrigerantMap = new Map<string, RefrigerantSummary>()
  let totalRefrigerantAmountKg = 0
  let knownCo2eTon = 0
  let unknownCo2eInstallations = 0
  let requiringInspection = 0
  let inspectionEvents = 0
  let inspectionRecords = 0
  let leakageEvents = 0
  let refilledAmountKg = 0
  let serviceEvents = 0
  const warnings: FgasReportData["warnings"] = []

  const events = installations.flatMap((installation) => {
    const refrigerantType =
      installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
    const compliance = calculateInstallationCompliance(
      installation.refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )
    const summary = refrigerantMap.get(refrigerantType) ?? {
      refrigerantType,
      installationCount: 0,
      totalAmountKg: 0,
      totalCo2eTon: null,
      refilledAmountKg: 0,
      leakageEvents: 0,
    }

    summary.installationCount += 1
    summary.totalAmountKg += installation.refrigerantAmount
    if (compliance.co2eTon !== null) {
      summary.totalCo2eTon = (summary.totalCo2eTon ?? 0) + compliance.co2eTon
    }
    refrigerantMap.set(refrigerantType, summary)

    totalRefrigerantAmountKg += installation.refrigerantAmount
    if (compliance.co2eTon === null) {
      unknownCo2eInstallations += 1
    } else {
      knownCo2eTon += compliance.co2eTon
    }
    if (compliance.inspectionIntervalMonths) requiringInspection += 1
    inspectionRecords += installation.inspections.length

    return installation.events.map((event) => {
      const addedAmount = event.refrigerantAddedKg ?? 0

      if (event.type === "INSPECTION") inspectionEvents += 1
      if (event.type === "LEAK") {
        leakageEvents += 1
        summary.leakageEvents += 1
        if (event.refrigerantAddedKg == null) {
          warnings.push({
            id: `leak-missing-amount-${event.id}`,
            severity: "review",
            installationName: installation.name,
            message: "Läckagehändelse saknar läckagemängd.",
          })
        }
      }
      if (event.type === "REFILL") {
        refilledAmountKg += addedAmount
        summary.refilledAmountKg += addedAmount
      }
      if (event.type === "SERVICE" || event.type === "REPAIR") serviceEvents += 1
      if (
        event.type === "RECOVERY" &&
        event.recoveredAmountKg == null &&
        event.refrigerantAddedKg == null
      ) {
        warnings.push({
          id: `recovery-missing-amount-${event.id}`,
          severity: "review",
          installationName: installation.name,
          message: "Tömning/återvinning saknar omhändertagen mängd.",
        })
      }
      if (
        event.type === "REFRIGERANT_CHANGE" &&
        event.newAmountKg == null &&
        event.refrigerantAddedKg == null
      ) {
        warnings.push({
          id: `refrigerant-change-missing-amount-${event.id}`,
          severity: "review",
          installationName: installation.name,
          message: "Köldmediebyte saknar ny fyllnadsmängd.",
        })
      }

      return {
        id: event.id,
        date: event.date,
        installationId: installation.id,
        installationName: installation.name,
        refrigerantType,
        type: event.type as FgasReportEventType,
        refrigerantAddedKg: event.refrigerantAddedKg,
        previousRefrigerantType: event.previousRefrigerantType,
        newRefrigerantType: event.newRefrigerantType,
        previousAmountKg: event.previousAmountKg,
        newAmountKg: event.newAmountKg,
        recoveredAmountKg: event.recoveredAmountKg,
        notes: event.notes,
      }
    })
  })

  const reportWarnings: FgasReportData["warnings"] = [
    ...(unknownCo2eInstallations > 0
      ? [
          {
            id: "unknown-co2e",
            severity: "blocking" as const,
            message: `${unknownCo2eInstallations} aggregat saknar känt GWP/CO₂e-värde.`,
          },
        ]
      : []),
    ...warnings.sort((first, second) => {
      if (first.severity !== second.severity) {
        return first.severity === "blocking" ? -1 : 1
      }

      return first.id.localeCompare(second.id, "sv")
    }),
  ]
  const qualitySummary = buildAnnualFgasReportQualitySummary(reportWarnings)

  return {
    year,
    period: {
      startDate,
      endDate,
    },
    metrics: {
      totalInstallations: installations.length,
      totalRefrigerantAmountKg,
      totalCo2eTon: unknownCo2eInstallations > 0 ? null : knownCo2eTon,
      knownCo2eTon,
      unknownCo2eInstallations,
      requiringInspection,
      inspectionsPerformed: inspectionEvents + inspectionRecords,
      leakageEvents,
      refilledAmountKg,
      serviceEvents,
    },
    warnings: reportWarnings,
    qualitySummary,
    refrigerants: Array.from(refrigerantMap.values()).sort((first, second) =>
      first.refrigerantType.localeCompare(second.refrigerantType, "sv")
    ),
    events: events.sort(
      (first, second) => second.date.getTime() - first.date.getTime()
    ),
  }
}

export async function getAnnualFgasReportPreview({
  assignedContractorId,
  companyId,
  municipality,
  propertyId,
  year,
}: {
  companyId: string
  assignedContractorId?: string
  municipality?: string
  propertyId?: string
  year: number
}): Promise<FgasReportData> {
  const report = await buildAnnualFgasReportData({
    assignedContractorId,
    companyId,
    municipality,
    propertyId,
    year,
  })

  return mapAnnualReportDataToPreview(report)
}

export async function getAnnualFgasReportPropertyOverview({
  assignedContractorId,
  companyId,
  signedReportUserId,
  year,
}: {
  companyId: string
  assignedContractorId?: string
  signedReportUserId?: string
  year: number
}): Promise<AnnualFgasReportPropertyOverview> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))
  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      propertyId: { not: null },
      AND: [
        {
          OR: [
            { installationDate: null },
            { installationDate: { lt: endDate } },
          ],
        },
        {
          OR: [
            { scrappedAt: null },
            { scrappedAt: { gte: startDate } },
          ],
        },
      ],
      ...(assignedContractorId ? { assignedContractorId } : {}),
    },
    select: {
      ...annualOverviewInstallationSelect,
      assignedContractor: {
        select: {
          id: true,
          companyId: true,
          name: true,
          certificationNumber: true,
          certificationIssuer: true,
          certificationValidUntil: true,
          certificationCategory: true,
          certificationRecords: {
            where: {
              companyId,
              subjectType: "TECHNICIAN",
              certificateType: "PERSONAL_FGAS",
              status: { notIn: ["DELETED", "REVOKED", "REPLACED"] },
            },
          },
          company: {
            select: {
              name: true,
            },
          },
          memberships: {
            where: {
              companyId,
              isActive: true,
            },
            select: {
              certificationNumber: true,
              certificationOrganization: true,
              certificationValidUntil: true,
              servicePartnerCompany: {
                select: {
                  companyId: true,
                  name: true,
                  certificateNumber: true,
                  serviceOrganizationId: true,
                  serviceOrganization: {
                    select: {
                      id: true,
                      name: true,
                      certificateNumber: true,
                      certificationRecords: {
                        where: {
                          companyId,
                          subjectType: "SERVICE_ORGANIZATION",
                          certificateType: "COMPANY_FGAS",
                          status: { notIn: ["DELETED", "REVOKED", "REPLACED"] },
                        },
                      },
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      },
      events: {
        where: {
          supersededAt: null,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        select: {
          id: true,
          type: true,
          refrigerantAddedKg: true,
          previousRefrigerantType: true,
          newRefrigerantType: true,
          previousAmountKg: true,
          newAmountKg: true,
          recoveredAmountKg: true,
          notes: true,
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: {
      propertyName: "asc",
    },
  })
  const signedReportRecords = await prisma.signedAnnualFgasReport.findMany({
    where: {
      companyId,
      reportYear: year,
      propertyId: { not: null },
      ...(signedReportUserId ? { userId: signedReportUserId } : {}),
    },
    select: {
      propertyId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return buildAnnualFgasReportPropertyOverviewFromLoadedData({
    endDate,
    installations,
    signedReportRecords,
    startDate,
    year,
  })
}

export function buildAnnualFgasReportPropertyOverviewFromLoadedData({
  endDate,
  installations,
  signedReportRecords,
  startDate,
  year,
}: {
  endDate: Date
  installations: AnnualOverviewInstallation[]
  signedReportRecords: AnnualOverviewSignedReportRecord[]
  startDate: Date
  year: number
}): AnnualFgasReportPropertyOverview {
  const installationsByProperty = new Map<
    string,
    {
      installations: AnnualOverviewInstallation[]
      property: NonNullable<AnnualOverviewInstallation["property"]>
    }
  >()

  for (const installation of installations) {
    if (!installation.property) continue

    const existing = installationsByProperty.get(installation.property.id)
    if (existing) {
      existing.installations.push(installation)
    } else {
      installationsByProperty.set(installation.property.id, {
        installations: [installation],
        property: installation.property,
      })
    }
  }

  const properties = Array.from(installationsByProperty.values()).sort(
    (first, second) =>
      first.property.name.localeCompare(second.property.name, "sv")
  )
  const signedReportsByProperty = new Map<string, Date>()

  for (const record of signedReportRecords) {
    if (!record.propertyId || signedReportsByProperty.has(record.propertyId)) {
      continue
    }
    signedReportsByProperty.set(record.propertyId, record.createdAt)
  }

  const propertyStatuses = properties.map(({ installations, property }) => {
    const propertySummary = buildAnnualOverviewPropertySummary({
      endDate,
      installations,
      startDate,
    })
    const installedCo2eTon = propertySummary.installedCo2eTon
    const annualReportRequirement =
      installedCo2eTon === null
        ? "UNCERTAIN"
        : installedCo2eTon >= ANNUAL_REPORT_CO2E_REQUIREMENT_THRESHOLD_TON
          ? "REQUIRED"
          : "NOT_REQUIRED"
    const signedAt = signedReportsByProperty.get(property.id) ?? null

    return {
      id: property.id,
      name: property.name,
      municipality: property.municipality,
      installedCo2eTon,
      annualReportRequirement,
      signedStatus: signedAt ? "SIGNED" : "NOT_SIGNED",
      signedAt,
      blockingIssueCount: propertySummary.qualitySummary.blockingIssueCount,
      reviewWarningCount: propertySummary.qualitySummary.warningCount,
    } satisfies AnnualFgasReportPropertyOverview["properties"][number]
  })

  return {
    year,
    properties: propertyStatuses,
  }
}

function buildAnnualOverviewPropertySummary({
  endDate,
  installations,
  startDate,
}: {
  endDate: Date
  installations: AnnualOverviewInstallation[]
  startDate: Date
}) {
  const reportInstallations = installations
    .filter((installation) => {
      const compliance = calculateInstallationCompliance(
        installation.refrigerantType,
        installation.refrigerantAmount,
        installation.hasLeakDetectionSystem,
        installation.lastInspection,
        installation.nextInspection
      )
      const isControlRequired = Boolean(compliance.inspectionIntervalMonths)
      const hasUnknownCo2e = compliance.co2eKg === null
      const wasScrappedDuringYear =
        installation.scrappedAt != null &&
        installation.scrappedAt >= startDate &&
        installation.scrappedAt < endDate

      if (installation.isActive && !installation.archivedAt) {
        return isControlRequired || hasUnknownCo2e
      }

      return isControlRequired || wasScrappedDuringYear
    })
    .map((installation) => ({
      ...installation,
      annualReportCertification:
        resolveAnnualFgasInstallationCertification(installation),
    }))

  const equipment = reportInstallations.map((installation) =>
    buildAnnualOverviewEquipmentRow(installation)
  )
  const scrappedEquipment = reportInstallations
    .filter(
      (installation) =>
        installation.scrappedAt != null &&
        installation.scrappedAt >= startDate &&
        installation.scrappedAt < endDate
    )
    .map((installation) =>
      buildAnnualOverviewScrappedEquipmentRow(installation)
    )
  const certificateRegister =
    buildAnnualOverviewCertificateRegister(reportInstallations)
  const co2eSummary = summarizeAnnualFgasCo2e(equipment)
  const warnings = buildAnnualFgasReportWarnings({
    certificateRegister,
    co2eSummary,
    equipment,
    periodEndDate: endDate,
    refrigerantHandlingLog: [],
    reportInstallations,
    scrappedEquipment,
  })

  return {
    installedCo2eTon:
      co2eSummary.totalCo2eKg === null ? null : co2eSummary.totalCo2eKg / 1000,
    qualitySummary: buildAnnualFgasReportQualitySummary(warnings),
  }
}

function buildAnnualOverviewEquipmentRow(
  installation: AnnualOverviewInstallation
): AnnualFgasEquipmentRow {
  const refrigerantType =
    installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
  const compliance = calculateInstallationCompliance(
    refrigerantType,
    installation.refrigerantAmount,
    installation.hasLeakDetectionSystem,
    installation.lastInspection,
    installation.nextInspection
  )

  return {
    id: installation.id,
    equipmentId: installation.equipmentId,
    name: installation.name,
    location: installation.location,
    propertyName: installation.property?.name ?? installation.propertyName,
    equipmentType: installation.equipmentType,
    refrigerantType,
    refrigerantAmountKg: installation.refrigerantAmount,
    co2eKg: compliance.co2eKg,
    controlRequired: Boolean(compliance.inspectionIntervalMonths),
    inspectionIntervalMonths: compliance.inspectionIntervalMonths,
    leakDetectionSystem: installation.hasLeakDetectionSystem,
    installedAt: installation.installationDate,
    lastInspectionAt: installation.lastInspection,
    nextInspectionAt: installation.nextInspection,
    status: installation.scrappedAt
      ? "scrapped"
      : installation.archivedAt
        ? "archived"
        : "active",
  }
}

function buildAnnualOverviewScrappedEquipmentRow(
  installation: AnnualOverviewInstallation
): AnnualFgasScrappedEquipmentRow {
  return {
    id: installation.id,
    scrappedAt: installation.scrappedAt as Date,
    equipmentName: installation.name,
    equipmentId: installation.equipmentId,
    refrigerantType:
      installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT,
    refrigerantAmountKg: installation.refrigerantAmount,
    recoveredKg: installation.recoveredRefrigerantKg,
    servicePartnerName:
      installation.assignedServicePartnerCompany?.serviceOrganization?.name ??
      installation.assignedServicePartnerCompany?.name ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany
        ?.serviceOrganization?.name ??
      installation.assignedContractor?.memberships[0]?.servicePartnerCompany?.name ??
      installation.assignedContractor?.name ??
      installation.assignedContractor?.company?.name ??
      null,
    certificateFileName: installation.scrapCertificateFileName,
    notes: installation.scrapComment,
  }
}

function buildAnnualOverviewCertificateRegister(
  installations: Array<
    AnnualOverviewInstallation & {
      annualReportCertification?: AnnualFgasResolvedInstallationCertification
    }
  >
): AnnualFgasCertificateEntry[] {
  const entries = new Map<string, AnnualFgasCertificateEntry>()

  installations.forEach((installation) => {
    const contractor = installation.assignedContractor
    if (!contractor) return

    const certification = contractor.memberships[0]
    const technicianCertification =
      installation.annualReportCertification?.technician ??
      resolveAnnualFgasInstallationCertification(installation).technician
    entries.set(contractor.id, {
      name: contractor.name,
      role: "Ansvarig tekniker/servicepartner",
      company:
        installation.assignedServicePartnerCompany?.serviceOrganization?.name ??
        installation.assignedServicePartnerCompany?.name ??
        certification?.servicePartnerCompany?.serviceOrganization?.name ??
        certification?.servicePartnerCompany?.name ??
        contractor.company?.name ??
        null,
      certificateNumber: technicianCertification?.certificateNumber ?? null,
      certificateOrganization: technicianCertification?.issuer ?? null,
      validUntil: technicianCertification?.validUntil
        ? new Date(technicianCertification.validUntil)
        : null,
    })
  })

  return Array.from(entries.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function mapAnnualReportDataToPreview(
  report: AnnualFgasReportData
): FgasReportData {
  const refrigerantMap = new Map<string, RefrigerantSummary>()
  const controlRequiredEquipment = report.equipment.filter(
    (equipment) => equipment.controlRequired
  )
  const controlRequiredInstallationIds = new Set(
    controlRequiredEquipment.map((equipment) => equipment.id)
  )

  controlRequiredEquipment.forEach((equipment) => {
    const refrigerantType = equipment.refrigerantType || UNKNOWN_REFRIGERANT
    const summary = refrigerantMap.get(refrigerantType) ?? {
      refrigerantType,
      installationCount: 0,
      totalAmountKg: 0,
      totalCo2eTon: null,
      refilledAmountKg: 0,
      leakageEvents: 0,
    }

    summary.installationCount += 1
    summary.totalAmountKg += equipment.refrigerantAmountKg
    if (equipment.co2eKg !== null) {
      summary.totalCo2eTon = (summary.totalCo2eTon ?? 0) + equipment.co2eKg / 1000
    }
    refrigerantMap.set(refrigerantType, summary)
  })

  report.refrigerantHandlingLog
    .filter((row) =>
      row.installationId
        ? controlRequiredInstallationIds.has(row.installationId)
        : false
    )
    .forEach((row) => {
      const refrigerantType = row.refrigerantType || UNKNOWN_REFRIGERANT
      const summary = refrigerantMap.get(refrigerantType) ?? {
        refrigerantType,
        installationCount: 0,
        totalAmountKg: 0,
        totalCo2eTon: null,
        refilledAmountKg: 0,
        leakageEvents: 0,
      }

      summary.refilledAmountKg += row.addedKg ?? 0
      if (row.eventType === ANNUAL_FGAS_EVENT_LABELS.LEAK) {
        summary.leakageEvents += 1
      }
      refrigerantMap.set(refrigerantType, summary)
    })

  return {
    year: report.reportYear,
    period: report.period,
    metrics: {
      totalInstallations: report.summary.equipmentCount,
      totalRefrigerantAmountKg: report.summary.totalRefrigerantKg,
      totalCo2eTon:
        report.summary.totalCo2eKg === null
          ? null
          : report.summary.totalCo2eKg / 1000,
      knownCo2eTon: report.summary.knownCo2eKg / 1000,
      unknownCo2eInstallations: report.summary.unknownCo2eEquipmentCount,
      requiringInspection: report.summary.controlRequiredCount,
      inspectionsPerformed:
        report.leakageControls.length +
        report.refrigerantHandlingLog.filter(
          (row) => row.eventType === ANNUAL_FGAS_EVENT_LABELS.INSPECTION
        ).length,
      leakageEvents: report.summary.leakageCount,
      refilledAmountKg: report.summary.addedRefrigerantKg,
      serviceEvents: report.refrigerantHandlingLog.filter(
        (row) =>
          row.eventType === ANNUAL_FGAS_EVENT_LABELS.SERVICE ||
          row.eventType === ANNUAL_FGAS_EVENT_LABELS.REPAIR
      ).length,
    },
    warnings: report.warnings.map((warning) => ({
      id: warning.id,
      severity: warning.severity,
      message: warning.message,
      installationName: warning.equipmentName ?? warning.equipmentId ?? null,
    })),
    qualitySummary: report.qualitySummary,
    refrigerants: Array.from(refrigerantMap.values()).sort((first, second) =>
      first.refrigerantType.localeCompare(second.refrigerantType, "sv")
    ),
    events: report.refrigerantHandlingLog
      .map((row) => ({
        id: row.id,
        date: row.date,
        installationId: row.installationId ?? row.equipmentId ?? row.equipmentName,
        installationName: row.equipmentName,
        refrigerantType: row.refrigerantType,
        type: ANNUAL_EVENT_TYPE_BY_LABEL[row.eventType] ?? "SERVICE",
        refrigerantAddedKg: row.addedKg ?? row.recoveredKg,
        previousRefrigerantType: row.previousRefrigerantType,
        newRefrigerantType: row.newRefrigerantType,
        previousAmountKg: row.previousAmountKg,
        newAmountKg: row.newAmountKg,
        recoveredAmountKg: row.recoveredKg,
        notes: row.notes,
      }))
      .sort((first, second) => second.date.getTime() - first.date.getTime()),
  }
}
