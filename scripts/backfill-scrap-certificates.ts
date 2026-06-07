import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"
import {
  buildFutureDocumentMetadataFromScrapCertificate,
  buildFutureScrapCertificateLinkMetadata,
} from "../lib/documents/documentHelpers"

type BackfillScrapCertificatesPrismaClient = {
  document: {
    create(args: unknown): Promise<{ id: string }>
    findFirst(args: unknown): Promise<{ id: string } | null>
  }
  documentLink: {
    create(args: unknown): Promise<{ id: string }>
    findUnique(args: unknown): Promise<{ id: string } | null>
  }
  installation: {
    count(args: unknown): Promise<number>
    findMany(args: unknown): Promise<unknown[]>
  }
}

type LegacyScrapCertificateInstallation = {
  id: string
  companyId: string
  scrappedAt: Date | null
  scrapCertificateBlobPath: string | null
  scrapCertificateFileName: string | null
  documents: Array<{
    id: string
    blobPath: string
    uploadedById: string
    sizeBytes: number
    createdAt: Date
  }>
}

export type BackfillScrapCertificatesSummary = {
  installationsScanned: number
  legacyCertificatesFound: number
  genericCertificatesCreated: number
  linksCreated: number
  alreadyRepresented: number
  skipped: number
  errors: number
  dryRun: boolean
}

export type BackfillScrapCertificatesOptions = {
  batchSize?: number
  dryRun?: boolean
}

const DEFAULT_BATCH_SIZE = 100

export async function backfillScrapCertificates(
  prisma: BackfillScrapCertificatesPrismaClient,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    dryRun = true,
  }: BackfillScrapCertificatesOptions = {}
): Promise<BackfillScrapCertificatesSummary> {
  const summary: BackfillScrapCertificatesSummary = {
    installationsScanned: 0,
    legacyCertificatesFound: await prisma.installation.count({
      where: {
        scrapCertificateBlobPath: {
          not: null,
        },
      },
    }),
    genericCertificatesCreated: 0,
    linksCreated: 0,
    alreadyRepresented: 0,
    skipped: 0,
    errors: 0,
    dryRun,
  }

  let cursor: string | undefined
  while (true) {
    const installations = (await prisma.installation.findMany({
      where: {
        scrapCertificateBlobPath: {
          not: null,
        },
      },
      select: {
        id: true,
        companyId: true,
        scrappedAt: true,
        scrapCertificateBlobPath: true,
        scrapCertificateFileName: true,
        documents: {
          select: {
            id: true,
            blobPath: true,
            uploadedById: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })) as LegacyScrapCertificateInstallation[]

    if (installations.length === 0) break

    for (const installation of installations) {
      summary.installationsScanned += 1
      try {
        await backfillScrapCertificate(prisma, installation, summary, dryRun)
      } catch (error) {
        summary.errors += 1
        console.error(
          `Kunde inte backfilla skrotningsintyg fÃ¶r aggregat ${installation.id}:`,
          error
        )
      }
    }

    cursor = installations[installations.length - 1]?.id
  }

  return summary
}

async function backfillScrapCertificate(
  prisma: BackfillScrapCertificatesPrismaClient,
  installation: LegacyScrapCertificateInstallation,
  summary: BackfillScrapCertificatesSummary,
  dryRun: boolean
) {
  if (!installation.scrapCertificateBlobPath) {
    summary.skipped += 1
    return
  }

  const existingLinkedDocument = await prisma.document.findFirst({
    where: {
      companyId: installation.companyId,
      links: {
        some: {
          companyId: installation.companyId,
          entityType: "INSTALLATION",
          entityId: installation.id,
          role: "SCRAP_CERTIFICATE",
        },
      },
    },
  })

  if (existingLinkedDocument) {
    summary.alreadyRepresented += 1
    return
  }

  const legacyDocument = installation.documents.find(
    (document) => document.blobPath === installation.scrapCertificateBlobPath
  )

  let document =
    legacyDocument &&
    (await prisma.document.findFirst({
      where: {
        companyId: installation.companyId,
        legacyInstallationDocumentId: legacyDocument.id,
      },
    }))

  if (!document) {
    document = await prisma.document.findFirst({
      where: {
        companyId: installation.companyId,
        storageKey: installation.scrapCertificateBlobPath,
      },
    })
  }

  if (!document) {
    if (dryRun) {
      summary.genericCertificatesCreated += 1
      summary.linksCreated += 1
      return
    }

    const createdAt =
      legacyDocument?.createdAt ?? installation.scrappedAt ?? new Date()
    document = await prisma.document.create({
      data: {
        ...buildFutureDocumentMetadataFromScrapCertificate({
          installationId: installation.id,
          companyId: installation.companyId,
          fileName:
            installation.scrapCertificateFileName ?? "skrotningsintyg",
          storageKey: installation.scrapCertificateBlobPath,
          uploadedByUserId: legacyDocument?.uploadedById ?? null,
          sizeBytes: legacyDocument?.sizeBytes ?? null,
          createdAt,
        }),
        legacyInstallationDocumentId: legacyDocument?.id ?? null,
        createdAt,
        updatedAt: createdAt,
      },
    })
    summary.genericCertificatesCreated += 1
  }

  const link = buildFutureScrapCertificateLinkMetadata({
    companyId: installation.companyId,
    installationId: installation.id,
    linkedByUserId: legacyDocument?.uploadedById ?? null,
  })
  const existingLink = await prisma.documentLink.findUnique({
    where: {
      documentId_entityType_entityId_role: {
        documentId: document.id,
        entityType: link.entityType,
        entityId: link.entityId,
        role: link.role,
      },
    },
  })

  if (existingLink) {
    summary.alreadyRepresented += 1
    return
  }

  if (!dryRun) {
    await prisma.documentLink.create({
      data: {
        documentId: document.id,
        ...link,
      },
    })
  }
  summary.linksCreated += 1
}

function printSummary(summary: BackfillScrapCertificatesSummary) {
  console.log("FgasPortal scrap certificate backfill")
  console.log("====================================")
  console.log(`Dry run: ${summary.dryRun ? "ja" : "nej"}`)
  console.log(`Installations scanned: ${summary.installationsScanned}`)
  console.log(`Legacy certificates found: ${summary.legacyCertificatesFound}`)
  console.log(
    `Created generic documents: ${summary.genericCertificatesCreated}`
  )
  console.log(`Created scrap certificate links: ${summary.linksCreated}`)
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
  if (!dryRun && process.env.CONFIRM_BACKFILL_SCRAP_CERTIFICATES !== "true") {
    throw new Error(
      "SÃ¤tt CONFIRM_BACKFILL_SCRAP_CERTIFICATES=true och kÃ¶r med --apply fÃ¶r att skriva Ã¤ndringar."
    )
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const summary = await backfillScrapCertificates(
      prisma as BackfillScrapCertificatesPrismaClient,
      { dryRun }
    )
    printSummary(summary)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith("backfill-scrap-certificates.ts")) {
  void main().catch((error) => {
    console.error("Scrap certificate backfill failed:", error)
    process.exit(1)
  })
}
