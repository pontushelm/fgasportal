import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"
import {
  buildTechnicianPersonalFgasCertificationRecordData,
} from "../lib/technician-certifications"
import { normalizeCertificateNumber } from "../lib/certifications"

type BackfillTechnicianCertificationsPrismaClient = {
  certificationRecord: {
    create(args: unknown): Promise<{ id: string }>
    findFirst(args: unknown): Promise<{ id: string } | null>
  }
  companyMembership: {
    findMany(args: unknown): Promise<unknown[]>
  }
}

type ContractorMembershipWithCertificationSources = {
  id: string
  userId: string
  companyId: string
  certificationNumber: string | null
  certificationOrganization: string | null
  certificationValidUntil: Date | null
  servicePartnerCompany: {
    serviceOrganizationId: string | null
  } | null
  user: {
    id: string
    certificationNumber: string | null
    certificationIssuer: string | null
    certificationValidUntil: Date | null
    certificationCategory: string | null
    serviceOrganizationMemberships: Array<{
      serviceOrganizationId: string
      isActive: boolean
    }>
  }
}

type TechnicianCertificationBackfillCandidate = {
  companyId: string
  userId: string
  serviceOrganizationId: string | null
  certificateNumber: string
  issuer: string | null
  category: string | null
  validUntil: Date | null
  source: "USER_LEGACY" | "MEMBERSHIP_LEGACY"
}

export type BackfillTechnicianCertificationsSummary = {
  membershipsScanned: number
  legacyUserCertificatesFound: number
  legacyMembershipCertificatesFound: number
  certificationRecordsCreated: number
  alreadyRepresented: number
  skipped: number
  errors: number
  dryRun: boolean
}

export type BackfillTechnicianCertificationsOptions = {
  dryRun?: boolean
}

export async function backfillTechnicianCertifications(
  prisma: BackfillTechnicianCertificationsPrismaClient,
  { dryRun = true }: BackfillTechnicianCertificationsOptions = {}
): Promise<BackfillTechnicianCertificationsSummary> {
  const summary: BackfillTechnicianCertificationsSummary = {
    membershipsScanned: 0,
    legacyUserCertificatesFound: 0,
    legacyMembershipCertificatesFound: 0,
    certificationRecordsCreated: 0,
    alreadyRepresented: 0,
    skipped: 0,
    errors: 0,
    dryRun,
  }

  const memberships = (await prisma.companyMembership.findMany({
    where: {
      role: "CONTRACTOR",
      isActive: true,
      OR: [
        {
          certificationNumber: {
            not: null,
          },
        },
        {
          user: {
            certificationNumber: {
              not: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      certificationNumber: true,
      certificationOrganization: true,
      certificationValidUntil: true,
      servicePartnerCompany: {
        select: {
          serviceOrganizationId: true,
        },
      },
      user: {
        select: {
          id: true,
          certificationNumber: true,
          certificationIssuer: true,
          certificationValidUntil: true,
          certificationCategory: true,
          serviceOrganizationMemberships: {
            where: {
              isActive: true,
            },
            select: {
              serviceOrganizationId: true,
              isActive: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  })) as ContractorMembershipWithCertificationSources[]

  for (const membership of memberships) {
    summary.membershipsScanned += 1

    for (const candidate of buildBackfillCandidates(membership, summary)) {
      try {
        await createTechnicianCertificationIfMissing({
          candidate,
          dryRun,
          prisma,
          summary,
        })
      } catch (error) {
        summary.errors += 1
        console.error(
          `Kunde inte backfilla personcertifikat för tekniker ${membership.userId}:`,
          error
        )
      }
    }
  }

  return summary
}

function buildBackfillCandidates(
  membership: ContractorMembershipWithCertificationSources,
  summary: BackfillTechnicianCertificationsSummary
) {
  const serviceOrganizationId = resolveServiceOrganizationId(membership)
  const candidates: TechnicianCertificationBackfillCandidate[] = []
  const seenCertificateNumbers = new Set<string>()

  const userCertificateNumber = normalizeCertificateNumber(
    membership.user.certificationNumber
  )
  if (userCertificateNumber) {
    summary.legacyUserCertificatesFound += 1
    seenCertificateNumbers.add(userCertificateNumber)
    candidates.push({
      companyId: membership.companyId,
      userId: membership.userId,
      serviceOrganizationId,
      certificateNumber: userCertificateNumber,
      issuer: membership.user.certificationIssuer,
      category: membership.user.certificationCategory,
      validUntil: membership.user.certificationValidUntil,
      source: "USER_LEGACY",
    })
  }

  const membershipCertificateNumber = normalizeCertificateNumber(
    membership.certificationNumber
  )
  if (membershipCertificateNumber) {
    summary.legacyMembershipCertificatesFound += 1

    if (seenCertificateNumbers.has(membershipCertificateNumber)) {
      summary.skipped += 1
      return candidates
    }

    candidates.push({
      companyId: membership.companyId,
      userId: membership.userId,
      serviceOrganizationId,
      certificateNumber: membershipCertificateNumber,
      issuer: membership.certificationOrganization,
      category: null,
      validUntil: membership.certificationValidUntil,
      source: "MEMBERSHIP_LEGACY",
    })
  }

  if (candidates.length === 0) {
    summary.skipped += 1
  }

  return candidates
}

async function createTechnicianCertificationIfMissing({
  candidate,
  dryRun,
  prisma,
  summary,
}: {
  candidate: TechnicianCertificationBackfillCandidate
  dryRun: boolean
  prisma: BackfillTechnicianCertificationsPrismaClient
  summary: BackfillTechnicianCertificationsSummary
}) {
  const data = buildTechnicianPersonalFgasCertificationRecordData({
    category: candidate.category,
    certificateNumber: candidate.certificateNumber,
    companyId: candidate.companyId,
    issuer: candidate.issuer,
    serviceOrganizationId: candidate.serviceOrganizationId,
    userId: candidate.userId,
    validUntil: candidate.validUntil,
  })
  if (!data) {
    summary.skipped += 1
    return
  }

  if (await findExistingTechnicianCertificationRecord(prisma, data)) {
    summary.alreadyRepresented += 1
    return
  }

  if (!dryRun) {
    await prisma.certificationRecord.create({ data })
  }
  summary.certificationRecordsCreated += 1
}

async function findExistingTechnicianCertificationRecord(
  prisma: BackfillTechnicianCertificationsPrismaClient,
  data: {
    companyId: string
    userId: string
    serviceOrganizationId: string | null
    subjectType: "TECHNICIAN"
    certificateType: "PERSONAL_FGAS"
    certificateNumber: string
  }
) {
  return prisma.certificationRecord.findFirst({
    where: {
      companyId: data.companyId,
      userId: data.userId,
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

function resolveServiceOrganizationId(
  membership: ContractorMembershipWithCertificationSources
) {
  return (
    membership.servicePartnerCompany?.serviceOrganizationId ??
    membership.user.serviceOrganizationMemberships[0]?.serviceOrganizationId ??
    null
  )
}

function printSummary(summary: BackfillTechnicianCertificationsSummary) {
  console.log("Helm Polar technician certification backfill")
  console.log("===========================================")
  console.log(`Dry run: ${summary.dryRun ? "ja" : "nej"}`)
  console.log(`Memberships scanned: ${summary.membershipsScanned}`)
  console.log(
    `Legacy user certificates found: ${summary.legacyUserCertificatesFound}`
  )
  console.log(
    `Legacy membership certificates found: ${summary.legacyMembershipCertificatesFound}`
  )
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
  if (
    !dryRun &&
    process.env.CONFIRM_BACKFILL_TECHNICIAN_CERTIFICATIONS !== "true"
  ) {
    throw new Error(
      "Sätt CONFIRM_BACKFILL_TECHNICIAN_CERTIFICATIONS=true och kör med --apply för att skriva ändringar."
    )
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const summary = await backfillTechnicianCertifications(
      prisma as BackfillTechnicianCertificationsPrismaClient,
      { dryRun }
    )
    printSummary(summary)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith("backfill-technician-certifications.ts")) {
  void main().catch((error) => {
    console.error("Technician certification backfill failed:", error)
    process.exit(1)
  })
}
