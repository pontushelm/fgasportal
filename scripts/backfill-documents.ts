import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"
import {
  buildFutureDocumentLinksFromInstallationDocument,
  buildFutureDocumentMetadataFromInstallationDocument,
  buildFutureDocumentMetadataFromScrapCertificate,
  buildFutureScrapCertificateLinkMetadata,
  type FutureDocumentLinkMetadata,
  type LegacyInstallationDocumentForMetadata,
} from "../lib/documents/documentHelpers"

type BackfillPrismaClient = {
  document: {
    count(args?: unknown): Promise<number>
    create(args: unknown): Promise<{ id: string }>
    findFirst(args: unknown): Promise<{ id: string } | null>
    findUnique(args: unknown): Promise<{ id: string } | null>
  }
  documentLink: {
    create(args: unknown): Promise<{ id: string }>
    findUnique(args: unknown): Promise<{ id: string } | null>
  }
  installation: {
    findMany(args: unknown): Promise<unknown[]>
  }
  installationDocument: {
    count(args?: unknown): Promise<number>
    findMany(args: unknown): Promise<unknown[]>
  }
}

type LegacyInstallationDocument = LegacyInstallationDocumentForMetadata & {
  createdAt: Date
}

type LegacyScrapCertificateInstallation = {
  id: string
  companyId: string
  scrappedAt: Date | null
  scrappedByCompanyMembershipId: string | null
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

export type BackfillDocumentsSummary = {
  installationDocumentCount: number
  documentsBefore: number
  documentsAfter: number
  documentsCreated: number
  installationLinksCreated: number
  eventLinksCreated: number
  scrapCertificateLinksCreated: number
  skippedAlreadyMigrated: number
  skippedExistingScrapDocuments: number
  dryRun: boolean
}

export type BackfillDocumentsOptions = {
  batchSize?: number
  dryRun?: boolean
}

const DEFAULT_BATCH_SIZE = 100

export async function backfillDocuments(
  prisma: BackfillPrismaClient,
  { batchSize = DEFAULT_BATCH_SIZE, dryRun = true }: BackfillDocumentsOptions = {}
): Promise<BackfillDocumentsSummary> {
  const summary: BackfillDocumentsSummary = {
    installationDocumentCount: await prisma.installationDocument.count(),
    documentsBefore: await prisma.document.count(),
    documentsAfter: 0,
    documentsCreated: 0,
    installationLinksCreated: 0,
    eventLinksCreated: 0,
    scrapCertificateLinksCreated: 0,
    skippedAlreadyMigrated: 0,
    skippedExistingScrapDocuments: 0,
    dryRun,
  }

  let cursor: string | undefined
  while (true) {
    const documents = (await prisma.installationDocument.findMany({
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      take: batchSize,
    })) as LegacyInstallationDocument[]

    if (documents.length === 0) break

    for (const legacyDocument of documents) {
      await backfillInstallationDocument(prisma, legacyDocument, summary, dryRun)
    }

    cursor = documents[documents.length - 1]?.id
  }

  await backfillScrapCertificateLinks(prisma, summary, dryRun)

  summary.documentsAfter = dryRun
    ? summary.documentsBefore + summary.documentsCreated
    : await prisma.document.count()

  return summary
}

async function backfillInstallationDocument(
  prisma: BackfillPrismaClient,
  legacyDocument: LegacyInstallationDocument,
  summary: BackfillDocumentsSummary,
  dryRun: boolean
) {
  const existingDocument = await prisma.document.findUnique({
    where: {
      legacyInstallationDocumentId: legacyDocument.id,
    },
  })

  if (existingDocument) {
    summary.skippedAlreadyMigrated += 1
    await ensureInstallationDocumentLinks(
      prisma,
      existingDocument.id,
      legacyDocument,
      summary,
      dryRun
    )
    return
  }

  if (dryRun) {
    summary.documentsCreated += 1
    summary.installationLinksCreated += 1
    if (legacyDocument.eventId) summary.eventLinksCreated += 1
    return
  }

  const createdDocument = await prisma.document.create({
    data: {
      ...buildFutureDocumentMetadataFromInstallationDocument(legacyDocument),
      createdAt: legacyDocument.createdAt,
      updatedAt: legacyDocument.createdAt,
    },
  })
  summary.documentsCreated += 1

  await ensureInstallationDocumentLinks(
    prisma,
    createdDocument.id,
    legacyDocument,
    summary,
    dryRun
  )
}

async function ensureInstallationDocumentLinks(
  prisma: BackfillPrismaClient,
  documentId: string,
  legacyDocument: LegacyInstallationDocument,
  summary: BackfillDocumentsSummary,
  dryRun: boolean
) {
  for (const link of buildFutureDocumentLinksFromInstallationDocument(
    legacyDocument
  )) {
    const created = await createDocumentLinkIfMissing(
      prisma,
      documentId,
      link,
      dryRun
    )
    if (!created) continue

    if (link.entityType === "INSTALLATION") summary.installationLinksCreated += 1
    if (link.entityType === "INSTALLATION_EVENT") summary.eventLinksCreated += 1
  }
}

async function backfillScrapCertificateLinks(
  prisma: BackfillPrismaClient,
  summary: BackfillDocumentsSummary,
  dryRun: boolean
) {
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
      scrappedByCompanyMembershipId: true,
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
  })) as LegacyScrapCertificateInstallation[]

  for (const installation of installations) {
    if (!installation.scrapCertificateBlobPath) continue

    const legacyDocument = installation.documents.find(
      (document) => document.blobPath === installation.scrapCertificateBlobPath
    )
    let document = legacyDocument
      ? await prisma.document.findUnique({
          where: {
            legacyInstallationDocumentId: legacyDocument.id,
          },
        })
      : null

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
        summary.documentsCreated += 1
        summary.scrapCertificateLinksCreated += 1
        continue
      }

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
            createdAt: legacyDocument?.createdAt ?? installation.scrappedAt,
          }),
          createdAt:
            legacyDocument?.createdAt ?? installation.scrappedAt ?? new Date(),
          updatedAt:
            legacyDocument?.createdAt ?? installation.scrappedAt ?? new Date(),
        },
      })
      summary.documentsCreated += 1
    } else if (legacyDocument) {
      summary.skippedExistingScrapDocuments += 1
    }

    const created = await createDocumentLinkIfMissing(
      prisma,
      document.id,
      buildFutureScrapCertificateLinkMetadata({
        companyId: installation.companyId,
        installationId: installation.id,
        linkedByUserId: legacyDocument?.uploadedById ?? null,
      }),
      dryRun
    )

    if (created) summary.scrapCertificateLinksCreated += 1
  }
}

async function createDocumentLinkIfMissing(
  prisma: BackfillPrismaClient,
  documentId: string,
  link: FutureDocumentLinkMetadata,
  dryRun: boolean
) {
  const existingLink = await prisma.documentLink.findUnique({
    where: {
      documentId_entityType_entityId_role: {
        documentId,
        entityType: link.entityType,
        entityId: link.entityId,
        role: link.role,
      },
    },
  })

  if (existingLink) return false
  if (dryRun) return true

  await prisma.documentLink.create({
    data: {
      documentId,
      ...link,
    },
  })
  return true
}

function printSummary(summary: BackfillDocumentsSummary) {
  console.log("Helm Polar document backfill")
  console.log("============================")
  console.log(`Dry run: ${summary.dryRun ? "ja" : "nej"}`)
  console.log(`InstallationDocument-rader: ${summary.installationDocumentCount}`)
  console.log(`Document före: ${summary.documentsBefore}`)
  console.log(`Document efter: ${summary.documentsAfter}`)
  console.log(`Document skapade: ${summary.documentsCreated}`)
  console.log(`Installationslänkar skapade: ${summary.installationLinksCreated}`)
  console.log(`Händelselänkar skapade: ${summary.eventLinksCreated}`)
  console.log(
    `Skrotningsintygslänkar skapade: ${summary.scrapCertificateLinksCreated}`
  )
  console.log(`Hoppade över redan migrerade: ${summary.skippedAlreadyMigrated}`)
  console.log(
    `Skrotningsintyg med befintligt dokument: ${summary.skippedExistingScrapDocuments}`
  )
}

async function main() {
  loadEnv({ quiet: true })

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL saknas.")
  }

  const dryRun = !process.argv.includes("--apply")
  if (!dryRun && process.env.CONFIRM_BACKFILL_DOCUMENTS !== "true") {
    throw new Error(
      "Sätt CONFIRM_BACKFILL_DOCUMENTS=true och kör med --apply för att skriva ändringar."
    )
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })

  try {
    const summary = await backfillDocuments(prisma as BackfillPrismaClient, {
      dryRun,
    })
    printSummary(summary)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith("backfill-documents.ts")) {
  void main().catch((error) => {
    console.error("Document backfill failed:", error)
    process.exit(1)
  })
}
