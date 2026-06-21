import type { Prisma, PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { getDemoTenantPropertyIdPrefix } from "@/lib/demo/demo-tenant-marker"
import { calculateInstallationCompliance } from "@/lib/fgas-calculations"

const DEMO_PROPERTY_COUNT = 24
const DEMO_INSTALLATION_COUNT = 240

type DemoPrismaClient = Pick<
  PrismaClient,
  "$transaction" | "installation" | "property" | "servicePartnerCompany"
>

type DemoTenantCounts = {
  installations: number
  properties: number
  servicePartners: number
}

export type DemoTenantSummary = {
  eventsCreated: number
  installationsCreated: number
  propertiesCreated: number
  servicePartnerCompaniesCreated: number
  techniciansCreated: number
  intentionalIssues: {
    expiringCertificates: number
    missingMunicipalityProperties: number
    missingPropertyAssignments: number
    missingRefrigerantCharge: number
    missingRefrigerantType: number
    unknownRefrigerants: number
  }
}

type DemoTenantPlan = {
  certificationRecords: Prisma.CertificationRecordCreateManyInput[]
  companyMemberships: Prisma.CompanyMembershipCreateManyInput[]
  companyServiceOrganizations: Prisma.CompanyServiceOrganizationCreateManyInput[]
  events: Prisma.InstallationEventCreateManyInput[]
  installations: Prisma.InstallationCreateManyInput[]
  invitations: Prisma.InvitationCreateManyInput[]
  properties: Prisma.PropertyCreateManyInput[]
  serviceOrganizations: Prisma.ServiceOrganizationCreateManyInput[]
  serviceOrganizationMemberships: Prisma.ServiceOrganizationMembershipCreateManyInput[]
  servicePartnerCompanies: Prisma.ServicePartnerCompanyCreateManyInput[]
  users: Prisma.UserCreateManyInput[]
  summary: DemoTenantSummary
}

type GenerateDemoTenantArgs = {
  companyId: string
  confirmed: boolean
  ownerUserId: string
  prisma?: DemoPrismaClient
  today?: Date
}

const propertySeeds = [
  ["Stadshuset", "Stockholm", "Stockholm", "Norrmalm 4:41", "Hantverkargatan 1", "111 52"],
  ["Kulturhuset Fyren", "Göteborg", "Göteborg", "Inom Vallgraven 12:8", "Södra Hamngatan 18", "411 14"],
  ["Vårdcentralen Linden", "Uppsala", "Uppsala", "Kungsängen 7:3", "Lindvägen 4", "753 20"],
  ["Skola Väster", "Malmö", "Malmö", "Väster 21:5", "Skolgatan 12", "214 22"],
  ["Sporthallen Orion", "Västerås", "Västerås", "Orion 3", "Idrottsvägen 8", "722 18"],
  ["Äldreboendet Solgläntan", null, "Örebro", "Almen 9", "Solvägen 2", "703 62"],
  ["Biblioteket Aspen", "Linköping", "Linköping", "Aspen 14", "Biblioteksgatan 5", "582 24"],
  ["Teknikhuset Delta", "Helsingborg", "Helsingborg", "Delta 6", "Industrigatan 11", "252 25"],
  ["Förskolan Regnbågen", "Jönköping", "Jönköping", "Rosen 2", "Parkvägen 7", "553 16"],
  ["Kommunförrådet Nord", "Norrköping", "Norrköping", "Lagret 1", "Förrådsvägen 3", "602 23"],
  ["Simhallen Delfinen", "Lund", "Lund", "Delfinen 10", "Badgatan 1", "222 29"],
  ["Gymnasiet Kronan", "Umeå", "Umeå", "Kronan 5", "Skolallén 20", "903 28"],
  ["Regionarkivet", "Borås", "Borås", "Arkivet 4", "Textilgatan 9", "503 38"],
  ["Närsjukhuset Eken", "Sundsvall", "Sundsvall", "Eken 11", "Sjukhusvägen 6", "852 34"],
  ["Räddningsstationen Syd", "Gävle", "Gävle", "Brandvakten 2", "Stationsgatan 14", "802 50"],
  ["Kökscentralen Måltiden", "Eskilstuna", "Eskilstuna", "Måltiden 1", "Koksgatan 4", "633 46"],
  ["Museet Magasinet", "Karlstad", "Karlstad", "Magasinet 8", "Hamngatan 22", "652 25"],
  ["Vård- och omsorgsboende Björken", null, "Växjö", "Björken 13", "Omsorgsvägen 10", "352 31"],
  ["Tingshuset", "Halmstad", "Halmstad", "Tingshuset 1", "Rådhusgatan 2", "302 43"],
  ["Laboratoriet Nova", "Luleå", "Luleå", "Nova 7", "Forskningsvägen 15", "977 54"],
  ["Campus Servicehus", "Östersund", "Östersund", "Campus 3", "Universitetsvägen 5", "831 40"],
  ["Kylcentralen Hamnen", "Kalmar", "Kalmar", "Hamnen 9", "Kajgatan 17", "392 32"],
  ["Hälsocenter Alva", "Falun", "Falun", "Alva 6", "Hälsogatan 3", "791 31"],
  ["Resecentrum", "Skövde", "Skövde", "Resenären 2", "Stationsvägen 1", "541 30"],
] as const

const servicePartnerSeeds = [
  {
    name: "Nordic Kyla Service AB",
    orgNumber: "5568123456",
    email: "service@nordickyla.example",
    phone: "010-440 12 00",
    lifecycle: "active",
  },
  {
    name: "Svensk Fastighetskyla AB",
    orgNumber: "5568234567",
    email: "kontakt@fastighetskyla.example",
    phone: "010-440 13 00",
    lifecycle: "needsCompletion",
  },
  {
    name: "Kylteam Öst AB",
    orgNumber: "5568345678",
    email: "admin@kylteamost.example",
    phone: "010-440 14 00",
    lifecycle: "noAdmin",
  },
  {
    name: "Servicepartner Väntar AB",
    orgNumber: "5568456789",
    email: "info@vantarservice.example",
    phone: "010-440 15 00",
    lifecycle: "expiredInvite",
  },
] as const

const refrigerants = ["R410A", "R134a", "R32", "R407C", "R404A", "R448A", "R449A"]

export function getDemoTenantTargets() {
  return {
    installations: DEMO_INSTALLATION_COUNT,
    properties: DEMO_PROPERTY_COUNT,
    servicePartners: servicePartnerSeeds.length,
  }
}

export function assertDemoTenantCanBeGenerated({
  confirmed,
  counts,
}: {
  confirmed: boolean
  counts: DemoTenantCounts
}) {
  if (!confirmed) {
    return {
      allowed: false,
      reason: "Bekräfta att du vill skapa demo-data.",
    }
  }

  if (
    counts.installations > 0 ||
    counts.properties > 0 ||
    counts.servicePartners > 0
  ) {
    return {
      allowed: false,
      reason:
        "Demo-data kan bara skapas i en tom tenant utan fastigheter, aggregat eller servicepartners.",
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

export async function generateDemoTenant({
  companyId,
  confirmed,
  ownerUserId,
  prisma,
  today = new Date(),
}: GenerateDemoTenantArgs): Promise<DemoTenantSummary> {
  const db = prisma ?? (await import("@/lib/db")).prisma
  const counts = await getDemoTenantCounts(db, companyId)
  const guard = assertDemoTenantCanBeGenerated({ confirmed, counts })
  if (!guard.allowed) {
    throw new DemoTenantGenerationError(
      guard.reason ?? "Demo-data kan inte skapas."
    )
  }

  const demoPasswordHash = await bcrypt.hash("Demo1234!", 12)
  const plan = createDemoTenantPlan({
    companyId,
    demoPasswordHash,
    ownerUserId,
    today,
  })

  await db.$transaction(async (tx) => {
    await tx.serviceOrganization.createMany({ data: plan.serviceOrganizations })
    await tx.servicePartnerCompany.createMany({ data: plan.servicePartnerCompanies })
    await tx.companyServiceOrganization.createMany({
      data: plan.companyServiceOrganizations,
    })
    await tx.user.createMany({ data: plan.users })
    await tx.companyMembership.createMany({ data: plan.companyMemberships })
    await tx.serviceOrganizationMembership.createMany({
      data: plan.serviceOrganizationMemberships,
    })
    await tx.certificationRecord.createMany({ data: plan.certificationRecords })
    await tx.invitation.createMany({ data: plan.invitations })
    await tx.property.createMany({ data: plan.properties })
    await tx.installation.createMany({ data: plan.installations })
    await tx.installationEvent.createMany({ data: plan.events })
  })

  return plan.summary
}

export function createDemoTenantPlan({
  companyId,
  demoPasswordHash,
  ownerUserId,
  today = new Date(),
}: {
  companyId: string
  demoPasswordHash: string
  ownerUserId: string
  today?: Date
}): DemoTenantPlan {
  const safeCompanyId = safeId(companyId)
  const demoPropertyIdPrefix = getDemoTenantPropertyIdPrefix(companyId)
  const properties = propertySeeds.map((property, index) => ({
    id: `${demoPropertyIdPrefix}${index + 1}`,
    companyId,
    name: property[0],
    municipality: property[1],
    city: property[2],
    propertyDesignation: property[3],
    address: property[4],
    postalCode: property[5],
    internalReference: `DEMO-F-${String(index + 1).padStart(3, "0")}`,
    description:
      index % 6 === 0
        ? "Demoobjekt med avsiktliga datakvalitetsfrågor."
        : "Demoobjekt för F-gasuppföljning.",
  }))

  const serviceOrganizations = servicePartnerSeeds.map((partner, index) => ({
    id: `demo_${safeCompanyId}_service_org_${index + 1}`,
    name: partner.name,
    organizationNumber: partner.orgNumber,
    contactEmail: partner.email,
    phone: partner.phone,
    certificateNumber:
      partner.lifecycle === "needsCompletion" ? null : `FGAS-${2026}-${index + 11}`,
  }))

  const servicePartnerCompanies = servicePartnerSeeds.map((partner, index) => ({
    id: `demo_${safeCompanyId}_service_partner_${index + 1}`,
    companyId,
    serviceOrganizationId: serviceOrganizations[index].id,
    name: partner.name,
    organizationNumber: partner.orgNumber,
    contactEmail: partner.email,
    phone: partner.phone,
    certificateNumber:
      partner.lifecycle === "needsCompletion" ? null : `FGAS-${2026}-${index + 11}`,
    notes: "Skapad av demo-generatorn.",
  }))

  const companyServiceOrganizations = serviceOrganizations.map((organization) => ({
    companyId,
    serviceOrganizationId: organization.id,
    displayName: organization.name,
    isActive: true,
  }))

  const users: Prisma.UserCreateManyInput[] = []
  const companyMemberships: Prisma.CompanyMembershipCreateManyInput[] = []
  const serviceOrganizationMemberships: Prisma.ServiceOrganizationMembershipCreateManyInput[] = []
  const certificationRecords: Prisma.CertificationRecordCreateManyInput[] = []
  const invitations: Prisma.InvitationCreateManyInput[] = []

  servicePartnerSeeds.forEach((partner, partnerIndex) => {
    const serviceOrganizationId = serviceOrganizations[partnerIndex].id
    const servicePartnerCompanyId = servicePartnerCompanies[partnerIndex].id
    const hasConnectedAccount = partner.lifecycle !== "expiredInvite"
    const hasAdmin = partner.lifecycle !== "noAdmin" && hasConnectedAccount
    const companyCertNumber =
      partner.lifecycle === "needsCompletion" ? "" : `FGAS-${2026}-${partnerIndex + 11}`

    if (partner.lifecycle === "expiredInvite") {
      invitations.push({
        companyId,
        email: `serviceansvarig+${partnerIndex + 1}@demo.helmpolar.se`,
        expiresAt: addDays(today, -12),
        invitedByUserId: ownerUserId,
        isServicePartnerAdminInvite: true,
        role: "CONTRACTOR",
        serviceOrganizationId,
        servicePartnerCompanyId,
        token: `demo-${safeCompanyId}-expired-${partnerIndex + 1}`,
      })
      return
    }

    Array.from({ length: 3 }).forEach((_, userIndex) => {
      const isAdmin = userIndex === 0 && hasAdmin
      const userId = `demo_${safeCompanyId}_sp_${partnerIndex + 1}_user_${userIndex + 1}`
      const certificateNumber =
        userIndex === 2 && partnerIndex === 0 ? null : `PFG-${partnerIndex + 1}${userIndex + 1}-2026`

      users.push({
        id: userId,
        companyId,
        email: `demo.sp${partnerIndex + 1}.tech${userIndex + 1}+${safeCompanyId}@demo.helmpolar.se`,
        name: isAdmin
          ? `${partner.name.split(" ")[0]} Serviceansvarig`
          : `${partner.name.split(" ")[0]} Tekniker ${userIndex + 1}`,
        password: demoPasswordHash,
        phone: `070-100 ${partnerIndex + 1}${userIndex + 1} 00`,
        role: "CONTRACTOR",
        certificationNumber: certificateNumber,
        certificationIssuer: certificateNumber ? "Incert" : null,
        certificationValidUntil: certificateNumber
          ? addDays(today, userIndex === 1 ? 45 : 420)
          : null,
        certificationCategory: certificateNumber ? "Kategori I" : null,
      })
      companyMemberships.push({
        companyId,
        userId,
        role: "CONTRACTOR",
        isActive: true,
        servicePartnerCompanyId,
        isServicePartnerAdmin: isAdmin,
        certificationNumber: certificateNumber,
        certificationOrganization: certificateNumber ? "Incert" : null,
        certificationValidUntil: certificateNumber
          ? addDays(today, userIndex === 1 ? 45 : 420)
          : null,
      })
      serviceOrganizationMemberships.push({
        isActive: true,
        role: isAdmin ? "ADMIN" : "TECHNICIAN",
        serviceOrganizationId,
        userId,
      })

      if (certificateNumber) {
        certificationRecords.push({
          category: "Kategori I",
          certificateNumber,
          certificateType: "PERSONAL_FGAS",
          companyId,
          createdByUserId: ownerUserId,
          issuer: "Incert",
          serviceOrganizationId,
          status: "ACTIVE",
          subjectType: "TECHNICIAN",
          userId,
          validUntil: addDays(today, userIndex === 1 ? 45 : 420),
          verificationStatus: "SELF_DECLARED",
        })
      }
    })

    if (companyCertNumber) {
      certificationRecords.push({
        certificateNumber: companyCertNumber,
        certificateType: "COMPANY_FGAS",
        companyId,
        createdByUserId: ownerUserId,
        issuer: "Incert",
        serviceOrganizationId,
        status: "ACTIVE",
        subjectType: "SERVICE_ORGANIZATION",
        validUntil: addDays(today, partnerIndex === 0 ? 65 : 380),
        verificationStatus: "SELF_DECLARED",
      })
    }
  })

  const installations: Prisma.InstallationCreateManyInput[] = []
  const events: Prisma.InstallationEventCreateManyInput[] = []
  let missingPropertyAssignments = 0
  let missingRefrigerantCharge = 0
  let missingRefrigerantType = 0
  let unknownRefrigerants = 0

  Array.from({ length: DEMO_INSTALLATION_COUNT }).forEach((_, index) => {
    const installationNumber = index + 1
    const property = index % 13 === 0 ? null : properties[index % properties.length]
    const missingRefrigerant = index % 37 === 0
    const missingCharge = index % 41 === 0
    const unknownRefrigerant = !missingRefrigerant && index % 53 === 0
    const refrigerantType = missingRefrigerant
      ? ""
      : unknownRefrigerant
        ? "R999X"
        : refrigerants[index % refrigerants.length]
    const refrigerantAmount = missingCharge
      ? 0
      : Number((2.5 + ((index * 7) % 80) / 2).toFixed(1))
    const hasLeakDetectionSystem = index % 9 === 0
    const compliance = calculateInstallationCompliance(
      refrigerantType,
      refrigerantAmount,
      hasLeakDetectionSystem
    )
    const inspectionIntervalMonths = compliance.inspectionIntervalMonths
    const lastInspection = inspectionIntervalMonths
      ? addDays(today, -((index % 4) * 70 + 45))
      : null
    const nextInspection = inspectionIntervalMonths
      ? index % 11 === 0
        ? addDays(today, -20 - (index % 30))
        : index % 7 === 0
          ? addDays(today, 18 + (index % 10))
          : addDays(today, 80 + (index % 160))
      : null
    const assignedServicePartnerCompanyId =
      index % 17 === 0
        ? null
        : index % 19 === 0
          ? servicePartnerCompanies[1].id
          : index % 23 === 0
            ? servicePartnerCompanies[2].id
            : servicePartnerCompanies[0].id
    const assignedContractorId =
      assignedServicePartnerCompanyId === servicePartnerCompanies[0].id
        ? users.find((user) => String(user.id).includes("_sp_1_user_2"))?.id ?? null
        : assignedServicePartnerCompanyId === servicePartnerCompanies[1].id
          ? users.find((user) => String(user.id).includes("_sp_2_user_2"))?.id ?? null
          : null
    const installationId = `demo_${safeCompanyId}_installation_${installationNumber}`

    if (!property) missingPropertyAssignments += 1
    if (missingRefrigerant) missingRefrigerantType += 1
    if (missingCharge) missingRefrigerantCharge += 1
    if (unknownRefrigerant) unknownRefrigerants += 1

    installations.push({
      id: installationId,
      companyId,
      createdById: ownerUserId,
      updatedById: ownerUserId,
      name: `${equipmentName(index)} ${String(installationNumber).padStart(3, "0")}`,
      location: locationName(index),
      equipmentId: `AGG-${String(installationNumber).padStart(4, "0")}`,
      serialNumber: `SN-${2020 + (index % 6)}-${String(index * 37).padStart(5, "0")}`,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      equipmentType: index % 3 === 0 ? "Kylaggregat" : index % 3 === 1 ? "Värmepump" : "Komfortkyla",
      operatorName: "Demo Kommunfastigheter",
      refrigerantType,
      refrigerantAmount,
      hasLeakDetectionSystem,
      installationDate: addDays(today, -(365 * (2 + (index % 12)))),
      lastInspection,
      inspectionIntervalMonths,
      nextInspection,
      notes: index % 29 === 0 ? "Saknar komplett historik från tidigare register." : null,
      isActive: true,
      assignedContractorId,
      assignedServicePartnerCompanyId,
    })

    if (lastInspection) {
      events.push({
        id: `${installationId}_event_inspection`,
        createdById: ownerUserId,
        date: lastInspection,
        installationId,
        notes: "Periodisk kontroll importerad i demo-data.",
        type: "INSPECTION",
      })
    }
    if (index % 8 === 0) {
      events.push({
        id: `${installationId}_event_refill`,
        createdById: ownerUserId,
        date: addDays(today, -(30 + (index % 120))),
        installationId,
        notes: "Påfyllning efter serviceåtgärd.",
        refrigerantAddedKg: Number((0.4 + (index % 7) * 0.3).toFixed(1)),
        type: "REFILL",
      })
    }
    if (index % 15 === 0) {
      events.push({
        id: `${installationId}_event_leak`,
        createdById: ownerUserId,
        date: addDays(today, -(index % 45)),
        installationId,
        notes: "Läckage identifierat och åtgärd planerad.",
        refrigerantAddedKg: Number((0.8 + (index % 5) * 0.5).toFixed(1)),
        type: "LEAK",
      })
    }
    if (index % 18 === 0) {
      events.push({
        id: `${installationId}_event_repair`,
        createdById: ownerUserId,
        date: addDays(today, -(20 + (index % 90))),
        installationId,
        notes: "Reparation utförd efter felsökning.",
        type: "REPAIR",
      })
    }
  })

  return {
    certificationRecords,
    companyMemberships,
    companyServiceOrganizations,
    events,
    installations,
    invitations,
    properties,
    serviceOrganizations,
    serviceOrganizationMemberships,
    servicePartnerCompanies,
    users,
    summary: {
      eventsCreated: events.length,
      installationsCreated: installations.length,
      propertiesCreated: properties.length,
      servicePartnerCompaniesCreated: servicePartnerCompanies.length,
      techniciansCreated: users.length,
      intentionalIssues: {
        expiringCertificates: 2,
        missingMunicipalityProperties: properties.filter(
          (property) => !property.municipality
        ).length,
        missingPropertyAssignments,
        missingRefrigerantCharge,
        missingRefrigerantType,
        unknownRefrigerants,
      },
    },
  }
}

async function getDemoTenantCounts(
  prisma: DemoPrismaClient,
  companyId: string
): Promise<DemoTenantCounts> {
  const [properties, installations, servicePartners] = await Promise.all([
    prisma.property.count({ where: { companyId } }),
    prisma.installation.count({ where: { companyId } }),
    prisma.servicePartnerCompany.count({ where: { companyId } }),
  ])

  return {
    installations,
    properties,
    servicePartners,
  }
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function equipmentName(index: number) {
  const names = [
    "Kylmaskin",
    "Värmepump",
    "Komfortkyla",
    "Frysrum",
    "Kylrum",
    "Kylcentral",
  ]
  return names[index % names.length]
}

function locationName(index: number) {
  const locations = [
    "Teknikrum plan 1",
    "Fläktrum tak",
    "Källare",
    "Kök",
    "Serverrum",
    "Undercentral",
  ]
  return locations[index % locations.length]
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 32)
}

export class DemoTenantGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DemoTenantGenerationError"
  }
}
