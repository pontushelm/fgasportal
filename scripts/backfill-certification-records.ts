import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"
import {
  buildLegacyServicePartnerCompanyCertificationRecordData,
  buildServiceOrganizationCompanyFgasCertificationRecordData,
  normalizeCertificateNumber,
} from "../lib/certifications"

type BackfillCertificationsPrismaClient = {
  certificationRecord: {
    create(args: unknown): Promise<{ id: string }>
    findFirst(args: unknown): Promise<{ id: string } | null>
  }
  serviceOrganization: {
    findMany(args: unknown): Promise<unknown[]>
  }
  servicePartnerCompany: {
    findMany(args: unknown): Promise<unknown[]>
  }
}

type ServiceOrganizationWithCompanyLinks = {
  id: string
  certificateNumber: string | null
  companyLinks: Array<{
    companyId: string
  }>
}

type LegacyServicePartnerCompanyWithCertificate = {
  id: string
  companyId: string
  serviceOrganizationId: string | null
  certificateNumber: string | null
}

export type BackfillCertificationRecordsSummary = {
  serviceOrganizationsScanned: number
  servicePartnerCompaniesScanned: number
  legacyCertificatesFound: number
  certificationRecordsCreated: number
  alreadyRepresented: number
  skipped: number
  errors: number
  dryRun: boolean
}

export type BackfillCertificationRecordsOptions = {
  dryRun?: boolean
}

export async function backfillCertificationRecords(
  prisma: BackfillCertificationsPrismaClient,
  { dryRun = true }: BackfillCertificationRecordsOptions = {}
): Promise<BackfillCertificationRecordsSummary> {
  const summary: BackfillCertificationRecordsSummary = {
    serviceOrganizationsScanned: 0,
    servicePartnerCompaniesScanned: 0,
    legacyCertificatesFound: 0,
    certificationRecordsCreated: 0,
    alreadyRepresented: 0,
    skipped: 0,
    errors: 0,
    dryRun,
  }

  const serviceOrganizations = (await prisma.serviceOrganization.findMany({
    where: {
      certificateNumber: {
        not: null,
      },
    },
    select: {
      id: true,
      certificateNumber: true,
      companyLinks: {
        where: {
          isActive: true,
        },
        select: {
          companyId: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  })) as ServiceOrganizationWithCompanyLinks[]

  for (const serviceOrganization of serviceOrganizations) {
    summary.serviceOrganizationsScanned += 1
    const certificateNumber = normalizeCertificateNumber(
      serviceOrganization.certificateNumber
    )
    if (!certificateNumber) {
      summary.skipped += 1
      continue
    }

    for (const companyLink of serviceOrganization.companyLinks) {
      summary.legacyCertificatesFound += 1
      try {
        await createServiceOrganizationCertificateIfMissing({
          companyId: companyLink.companyId,
          dryRun,
          prisma,
          serviceOrganization,
          summary,
        })
      } catch (error) {
        summary.errors += 1
        console.error(
          `Kunde inte backfilla certifikat fÃ¶r serviceorganisation ${serviceOrganization.id}:`,
          error
        )
      }
    }
  }

  const legacyCompanies = (await prisma.servicePartnerCompany.findMany({
    where: {
      certificateNumber: {
        not: null,
      },
    },
    select: {
      id: true,
      companyId: true,
      serviceOrganizationId: true,
      certificateNumber: true,
    },
    orderBy: {
      id: "asc",
    },
  })) as LegacyServicePartnerCompanyWithCertificate[]

  for (const legacyCompany of legacyCompanies) {
    summary.servicePartnerCompaniesScanned += 1
    if (!normalizeCertificateNumber(legacyCompany.certificateNumber)) {
      summary.skipped += 1
      continue
    }

    summary.legacyCertificatesFound += 1
    try {
      await createLegacyCompanyCertificateIfMissing({
        dryRun,
        legacyCompany,
        prisma,
        summary,
      })
    } catch (error) {
      summary.errors += 1
      console.error(
        `Kunde inte backfilla certifikat fÃ¶r servicepartner ${legacyCompany.id}:`,
        error
      )
    }
  }

  return summary
}

async function createServiceOrganizationCertificateIfMissing({
  companyId,
  dryRun,
  prisma,
  serviceOrganization,
  summary,
}: {
  companyId: string
  dryRun: boolean
  prisma: BackfillCertificationsPrismaClient
  serviceOrganization: ServiceOrganizationWithCompanyLinks
  summary: BackfillCertificationRecordsSummary
}) {
  const data = buildServiceOrganizationCompanyFgasCertificationRecordData({
    companyId,
    serviceOrganization,
  })
  if (!data) {
    summary.skipped += 1
    return
  }

  if (await findExistingCertificationRecord(prisma, data)) {
    summary.alreadyRepresented += 1
    return
  }

  if (!dryRun) {
    await prisma.certificationRecord.create({ data })
  }
  summary.certificationRecordsCreated += 1
}

async function createLegacyCompanyCertificateIfMissing({
  dryRun,
  legacyCompany,
  prisma,
  summary,
}: {
  dryRun: boolean
  legacyCompany: LegacyServicePartnerCompanyWithCertificate
  prisma: BackfillCertificationsPrismaClient
  summary: BackfillCertificationRecordsSummary
}) {
  const data = buildLegacyServicePartnerCompanyCertificationRecordData({
    legacyCompany,
  })
  if (!data) {
    summary.skipped += 1
    return
  }

  if (await findExistingCertificationRecord(prisma, data)) {
    summary.alreadyRepresented += 1
    return
  }

  if (!dryRun) {
    await prisma.certificationRecord.create({ data })
  }
  summary.certificationRecordsCreated += 1
}

async function findExistingCertificationRecord(
  prisma: BackfillCertificationsPrismaClient,
  data: {
    companyId: string
    serviceOrganizationId: string
    subjectType: "SERVICE_ORGANIZATION"
    certificateType: "COMPANY_FGAS"
    certificateNumber: string
  }
) {
  return prisma.certificationRecord.findFirst({
    where: {
      companyId: data.companyId,
      serviceOrganizationId: data.serviceOrganizationId,
      subjectType: data.subjectType,
      certificateType: data.certificateType,
      certificateNumber: data.certificateNumber,
      status: {
        not: "DELETED",
      },
    },
    select: {
      id: true,
    },
  })
}

function printSummary(summary: BackfillCertificationRecordsSummary) {
  console.log("Helm Polar certification record backfill")
  console.log("=======================================")
  console.log(`Dry run: ${summary.dryRun ? "ja" : "nej"}`)
  console.log(
    `Service organizations scanned: ${summary.serviceOrganizationsScanned}`
  )
  console.log(
    `Service partner companies scanned: ${summary.servicePartnerCompaniesScanned}`
  )
  console.log(`Legacy certificates found: ${summary.legacyCertificatesFound}`)
  console.log(
    `Created certification records: ${summary.certificationRecordsCreated}`
  )
  console.log(`Already represented: ${summary.alreadyRepresented}`)
  console.log(`Skipped: ${summary.skipped}`)
  console.log(`Errors: ${summary.errors}`)
}

async function main() {
  loadEnv({ quiet: true })

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL saknas.")
  }

  const dryRun = !process.argv.includes("--apply")
  if (!dryRun && process.env.CONFIRM_BACKFILL_CERTIFICATIONS !== "true") {
    throw new Error(
      "SÃ¤tt CONFIRM_BACKFILL_CERTIFICATIONS=true och kÃ¶r med --apply fÃ¶r att skriva Ã¤ndringar."
    )
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const summary = await backfillCertificationRecords(
      prisma as BackfillCertificationsPrismaClient,
      { dryRun }
    )
    printSummary(summary)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith("backfill-certification-records.ts")) {
  void main().catch((error) => {
    console.error("Certification record backfill failed:", error)
    process.exit(1)
  })
}
