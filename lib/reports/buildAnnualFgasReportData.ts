import { calculateInstallationCompliance } from "@/lib/fgas-calculations"
import { prisma } from "@/lib/db"
import type {
  AnnualFgasCertificateEntry,
  AnnualFgasEquipmentRow,
  AnnualFgasReportData,
  AnnualFgasReportFilter,
} from "@/lib/reports/annualFgasReportTypes"
import { summarizeAnnualFgasCo2e } from "@/lib/reports/annualFgasReportSummary"

const UNKNOWN_REFRIGERANT = "Okänt köldmedium"

const EVENT_LABELS = {
  INSPECTION: "Läckagekontroll",
  LEAK: "Läckage/reparation",
  REFILL: "Påfyllning",
  SERVICE: "Service",
  REPAIR: "Reparation",
  RECOVERY: "Tömning / Återvinning",
  REFRIGERANT_CHANGE: "Byte av köldmedium",
} as const

export async function buildAnnualFgasReportData({
  assignedContractorId,
  companyId,
  municipality,
  propertyId,
  year,
}: AnnualFgasReportFilter): Promise<AnnualFgasReportData> {
  const startDate = new Date(Date.UTC(year, 0, 1))
  const endDate = new Date(Date.UTC(year + 1, 0, 1))
  const trimmedMunicipality = municipality?.trim()

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      name: true,
      orgNumber: true,
      organizationNumber: true,
      contactPerson: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      postalCode: true,
      city: true,
      billingAddress: true,
      billingEmail: true,
      phone: true,
    },
  })

  const installations = await prisma.installation.findMany({
    where: {
      companyId,
      installationDate: { lt: endDate },
      OR: [
        { scrappedAt: null },
        { scrappedAt: { gte: startDate } },
      ],
      ...(assignedContractorId ? { assignedContractorId } : {}),
      ...(propertyId ? { propertyId } : {}),
      ...(trimmedMunicipality
        ? { property: { municipality: trimmedMunicipality } }
        : {}),
    },
    include: {
      property: true,
      assignedContractor: {
        select: {
          id: true,
          name: true,
          email: true,
          company: { select: { name: true, phone: true } },
          memberships: {
            where: {
              companyId,
              isActive: true,
            },
            select: {
              isCertifiedCompany: true,
              certificationNumber: true,
              certificationOrganization: true,
              certificationValidUntil: true,
              servicePartnerCompany: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      inspections: {
        where: {
          inspectionDate: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: { inspectionDate: "asc" },
      },
      events: {
        where: {
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: [
      { propertyName: "asc" },
      { name: "asc" },
    ],
  })

  const scrapServicePartnerIds = Array.from(
    new Set(
      installations
        .map((installation) => installation.scrapServicePartnerId)
        .filter((id): id is string => Boolean(id))
    )
  )
  const scrapServicePartnerMemberships =
    scrapServicePartnerIds.length > 0
      ? await prisma.companyMembership.findMany({
          where: {
            companyId,
            userId: { in: scrapServicePartnerIds },
          },
          select: {
            userId: true,
            servicePartnerCompany: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                name: true,
                email: true,
                company: { select: { name: true } },
              },
            },
          },
        })
      : []
  const scrapServicePartnerByUserId = new Map(
    scrapServicePartnerMemberships.map((membership) => [
      membership.userId,
      membership,
    ])
  )

  const reportInstallations = installations.filter((installation) => {
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

  const equipment: AnnualFgasEquipmentRow[] = reportInstallations.map((installation) => {
    const refrigerantType =
      installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT
    const compliance = calculateInstallationCompliance(
      refrigerantType,
      installation.refrigerantAmount,
      installation.hasLeakDetectionSystem,
      installation.lastInspection,
      installation.nextInspection
    )

    const status: AnnualFgasEquipmentRow["status"] = installation.scrappedAt
      ? "scrapped"
      : installation.archivedAt
        ? "archived"
        : "active"

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
      status,
    }
  })

  const leakageControls = reportInstallations.flatMap((installation) =>
    installation.inspections.map((inspection) => ({
      id: inspection.id,
      date: inspection.inspectionDate,
      equipmentName: installation.name,
      equipmentId: installation.equipmentId,
      inspectorName: inspection.inspectorName,
      result: inspection.status || inspection.findings || "Kontroll registrerad",
      nextDueDate: inspection.nextDueDate,
      notes: inspection.notes || inspection.findings,
    }))
  )

  const refrigerantHandlingLog = reportInstallations.flatMap((installation) =>
    installation.events.map((event) => ({
      id: event.id,
      date: event.date,
      equipmentName: installation.name,
      equipmentId: installation.equipmentId,
      refrigerantType:
        installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT,
      eventType: EVENT_LABELS[event.type],
      addedKg: event.type === "REFILL" ? event.refrigerantAddedKg : null,
      // Existing schema stores recovered refrigerant on scrapping, not per event.
      recoveredKg: null,
      // Add a dedicated Prisma field here if regenerated/reused refrigerant is tracked later.
      regeneratedReusedKg: null,
      notes: event.notes,
    }))
  )

  const scrappedEquipment = reportInstallations
    .filter(
      (installation) =>
        installation.scrappedAt != null &&
        installation.scrappedAt >= startDate &&
        installation.scrappedAt < endDate
    )
    .map((installation) => ({
      id: installation.id,
      scrappedAt: installation.scrappedAt as Date,
      equipmentName: installation.name,
      equipmentId: installation.equipmentId,
      refrigerantType:
        installation.refrigerantType?.trim() || UNKNOWN_REFRIGERANT,
      refrigerantAmountKg: installation.refrigerantAmount,
      recoveredKg: installation.recoveredRefrigerantKg,
      servicePartnerName:
        formatServicePartnerName(
          installation.scrapServicePartnerId
            ? scrapServicePartnerByUserId.get(installation.scrapServicePartnerId)
            : null
        ) ??
        installation.assignedContractor?.memberships[0]?.servicePartnerCompany
          ?.name ??
        installation.assignedContractor?.name ??
        installation.assignedContractor?.company?.name ??
        null,
      certificateFileName: installation.scrapCertificateFileName,
      notes: installation.scrapComment,
    }))

  const certificateRegister = buildCertificateRegister(reportInstallations)
  const primaryContractor =
    reportInstallations.find((installation) => installation.assignedContractor)
      ?.assignedContractor ?? null
  const primaryContractorCertification = primaryContractor?.memberships[0]
  const properties = reportInstallations
    .map((installation) => installation.property)
    .filter((property): property is NonNullable<typeof property> => Boolean(property))
  const uniqueMunicipalities = Array.from(
    new Set(properties.map((property) => property.municipality).filter(Boolean))
  )
  const addedRefrigerantKg = refrigerantHandlingLog.reduce(
    (sum, row) => sum + (row.addedKg ?? 0),
    0
  )
  const recoveredRefrigerantKg = scrappedEquipment.reduce(
    (sum, row) => sum + (row.recoveredKg ?? 0),
    0
  )
  const co2eSummary = summarizeAnnualFgasCo2e(equipment)
  const leakageNotes = [
    ...reportInstallations.flatMap((installation) =>
      installation.events
        .filter((event) => event.type === "LEAK" && event.notes)
        .map((event) => `${installation.name}: ${event.notes}`)
    ),
    ...leakageControls
      .filter((control) => control.notes)
      .map((control) => `${control.equipmentName}: ${control.notes}`),
  ]

  return {
    reportYear: year,
    generatedAt: new Date(),
    period: { startDate, endDate },
    operator: {
      name: company.name,
      organizationNumber: company.organizationNumber || company.orgNumber,
      postalAddress: formatAddress(company.address, company.postalCode, company.city),
      billingAddress:
        company.billingAddress ||
        company.billingEmail ||
        formatAddress(company.address, company.postalCode, company.city),
      contactPerson: company.contactPerson,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone || company.phone,
    },
    facility: {
      name:
        properties.length === 1
          ? properties[0].name
          : trimmedMunicipality
            ? `Anläggningar i ${trimmedMunicipality}`
            : "Samtliga kontrollpliktiga anläggningar",
      address:
        properties.length === 1
          ? formatAddress(properties[0].address, properties[0].postalCode, properties[0].city)
          : null,
      municipality:
        trimmedMunicipality ||
        (uniqueMunicipalities.length === 1 ? uniqueMunicipalities[0] ?? null : null),
      propertyDesignation:
        properties.length === 1 ? properties[0].propertyDesignation : null,
    },
    responsibleContractor: {
      name: primaryContractor?.name ?? null,
      company:
        primaryContractorCertification?.servicePartnerCompany?.name ??
        primaryContractor?.company?.name ??
        null,
      email: primaryContractor?.email ?? null,
      phone: primaryContractor?.company?.phone ?? null,
      certificateNumber: primaryContractorCertification?.certificationNumber ?? null,
    },
    certificateRegister,
    summary: {
      equipmentCount: equipment.length,
      controlRequiredCount: equipment.filter((row) => row.controlRequired).length,
      unknownCo2eEquipmentCount: co2eSummary.unknownCo2eEquipmentCount,
      totalRefrigerantKg: equipment.reduce(
        (sum, row) => sum + row.refrigerantAmountKg,
        0
      ),
      totalCo2eKg: co2eSummary.totalCo2eKg,
      knownCo2eKg: co2eSummary.knownCo2eKg,
      leakageCount: reportInstallations.reduce(
        (sum, installation) =>
          sum + installation.events.filter((event) => event.type === "LEAK").length,
        0
      ),
      addedRefrigerantKg,
      recoveredRefrigerantKg,
      regeneratedReusedRefrigerantKg: refrigerantHandlingLog.some(
        (row) => row.regeneratedReusedKg != null
      )
        ? refrigerantHandlingLog.reduce(
            (sum, row) => sum + (row.regeneratedReusedKg ?? 0),
            0
          )
        : null,
      scrappedEquipmentCount: scrappedEquipment.length,
    },
    equipment,
    leakageControls,
    refrigerantHandlingLog,
    scrappedEquipment,
    notes: leakageNotes,
  }
}

function formatServicePartnerName(
  membership:
    | {
        servicePartnerCompany: { name: string } | null
        user: {
          name: string
          email: string
          company: { name: string } | null
        }
      }
    | null
    | undefined
) {
  if (!membership) return null

  return (
    membership.servicePartnerCompany?.name ??
    membership.user.company?.name ??
    membership.user.name ??
    membership.user.email
  )
}

function buildCertificateRegister(
  installations: Array<{
    assignedContractor: {
      id: string
      name: string
      company: { name: string } | null
      memberships: Array<{
        certificationNumber: string | null
        certificationOrganization: string | null
        certificationValidUntil: Date | null
        servicePartnerCompany: { name: string } | null
      }>
    } | null
  }>
): AnnualFgasCertificateEntry[] {
  const entries = new Map<string, AnnualFgasCertificateEntry>()

  installations.forEach((installation) => {
    const contractor = installation.assignedContractor
    if (!contractor) return

    const certification = contractor.memberships[0]
    entries.set(contractor.id, {
      name: contractor.name,
      role: "Ansvarig tekniker/servicepartner",
      company:
        certification?.servicePartnerCompany?.name ??
        contractor.company?.name ??
        null,
      certificateNumber: certification?.certificationNumber ?? null,
      certificateOrganization: certification?.certificationOrganization ?? null,
      validUntil: certification?.certificationValidUntil ?? null,
    })
  })

  return Array.from(entries.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )
}

function formatAddress(
  street?: string | null,
  postalCode?: string | null,
  city?: string | null
) {
  return [street, [postalCode, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || null
}
