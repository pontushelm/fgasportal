import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"

/*
 * One-time Helm Polar production test-data cleanup.
 *
 * Dry run:
 *   PowerShell:
 *     $env:CONFIRM_CLEAN_PRODUCTION_TEST_DATA="true"
 *     npm.cmd exec tsx scripts/clean-production-test-data.ts
 *
 * Apply:
 *   PowerShell:
 *     $env:CONFIRM_CLEAN_PRODUCTION_TEST_DATA="true"
 *     npm.cmd exec tsx scripts/clean-production-test-data.ts --apply
 *
 * The script intentionally deletes runtime records only. It does not touch
 * Prisma migrations, schema files, Blob objects, or application code.
 */

type CleanupClient = PrismaClient | Prisma.TransactionClient

type CleanupOperation = {
  label: string
  count: () => Promise<number>
  deleteMany: () => Promise<{ count: number }>
}

type CleanupSummaryRow = {
  label: string
  count: number
}

const CONFIRMATION_ENV = "CONFIRM_CLEAN_PRODUCTION_TEST_DATA"
const REQUIRED_CONFIRMATION = "true"

function getCleanupOperations(client: CleanupClient): CleanupOperation[] {
  return [
    {
      label: "Document links",
      count: () => client.documentLink.count(),
      deleteMany: () => client.documentLink.deleteMany(),
    },
    {
      label: "Documents",
      count: () => client.document.count(),
      deleteMany: () => client.document.deleteMany(),
    },
    {
      label: "Certification records",
      count: () => client.certificationRecord.count(),
      deleteMany: () => client.certificationRecord.deleteMany(),
    },
    {
      label: "Notification digest logs",
      count: () => client.notificationDigestLog.count(),
      deleteMany: () => client.notificationDigestLog.deleteMany(),
    },
    {
      label: "Password reset tokens",
      count: () => client.passwordResetToken.count(),
      deleteMany: () => client.passwordResetToken.deleteMany(),
    },
    {
      label: "Saved filters",
      count: () => client.savedFilter.count(),
      deleteMany: () => client.savedFilter.deleteMany(),
    },
    {
      label: "Feedback",
      count: () => client.feedback.count(),
      deleteMany: () => client.feedback.deleteMany(),
    },
    {
      label: "Signed annual F-gas reports",
      count: () => client.signedAnnualFgasReport.count(),
      deleteMany: () => client.signedAnnualFgasReport.deleteMany(),
    },
    {
      label: "Signed report artifacts",
      count: () => client.signedReportArtifact.count(),
      deleteMany: () => client.signedReportArtifact.deleteMany(),
    },
    {
      label: "Installation documents",
      count: () => client.installationDocument.count(),
      deleteMany: () => client.installationDocument.deleteMany(),
    },
    {
      label: "Installation events",
      count: () => client.installationEvent.count(),
      deleteMany: () => client.installationEvent.deleteMany(),
    },
    {
      label: "Inspections",
      count: () => client.inspection.count(),
      deleteMany: () => client.inspection.deleteMany(),
    },
    {
      label: "Reminder logs",
      count: () => client.reminderLog.count(),
      deleteMany: () => client.reminderLog.deleteMany(),
    },
    {
      label: "Activity logs",
      count: () => client.activityLog.count(),
      deleteMany: () => client.activityLog.deleteMany(),
    },
    {
      label: "Invitations",
      count: () => client.invitation.count(),
      deleteMany: () => client.invitation.deleteMany(),
    },
    {
      label: "Installations",
      count: () => client.installation.count(),
      deleteMany: () => client.installation.deleteMany(),
    },
    {
      label: "Properties",
      count: () => client.property.count(),
      deleteMany: () => client.property.deleteMany(),
    },
    {
      label: "Company-service organization links",
      count: () => client.companyServiceOrganization.count(),
      deleteMany: () => client.companyServiceOrganization.deleteMany(),
    },
    {
      label: "Company memberships",
      count: () => client.companyMembership.count(),
      deleteMany: () => client.companyMembership.deleteMany(),
    },
    {
      label: "Service organization memberships",
      count: () => client.serviceOrganizationMembership.count(),
      deleteMany: () => client.serviceOrganizationMembership.deleteMany(),
    },
    {
      label: "Service partner companies",
      count: () => client.servicePartnerCompany.count(),
      deleteMany: () => client.servicePartnerCompany.deleteMany(),
    },
    {
      label: "Service organizations",
      count: () => client.serviceOrganization.count(),
      deleteMany: () => client.serviceOrganization.deleteMany(),
    },
    {
      label: "Users",
      count: () => client.user.count(),
      deleteMany: () => client.user.deleteMany(),
    },
    {
      label: "Companies",
      count: () => client.company.count(),
      deleteMany: () => client.company.deleteMany(),
    },
  ]
}

function describeDatabaseTarget(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl)
    return {
      databaseName: parsed.pathname.replace(/^\//, "") || "(missing)",
      host: parsed.hostname || "(missing)",
      port: parsed.port || "(default)",
      protocol: parsed.protocol.replace(":", "") || "(unknown)",
    }
  } catch {
    return {
      databaseName: "(invalid DATABASE_URL)",
      host: "(unknown)",
      port: "(unknown)",
      protocol: "(unknown)",
    }
  }
}

function assertConfirmed() {
  if (process.env[CONFIRMATION_ENV] !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Refusing to run. Set ${CONFIRMATION_ENV}=true to confirm this one-time cleanup.`
    )
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.")
  }
}

function printHeader(databaseUrl: string, dryRun: boolean) {
  const target = describeDatabaseTarget(databaseUrl)

  console.log("Helm Polar production test-data cleanup")
  console.log("======================================")
  console.log(`Mode: ${dryRun ? "dry-run" : "APPLY - DELETING DATA"}`)
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "(not set)"}`)
  console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV || "(not set)"}`)
  console.log(
    `Database: ${target.protocol}://${target.host}:${target.port}/${target.databaseName}`
  )
  console.log("DATABASE_URL credentials are never printed.")
  console.log("")
}

async function runDryRun(client: CleanupClient): Promise<CleanupSummaryRow[]> {
  const rows: CleanupSummaryRow[] = []

  for (const operation of getCleanupOperations(client)) {
    rows.push({
      label: operation.label,
      count: await operation.count(),
    })
  }

  return rows
}

async function runCleanup(client: CleanupClient): Promise<CleanupSummaryRow[]> {
  const rows: CleanupSummaryRow[] = []

  for (const operation of getCleanupOperations(client)) {
    const result = await operation.deleteMany()
    rows.push({
      label: operation.label,
      count: result.count,
    })
  }

  return rows
}

function printSummary(rows: CleanupSummaryRow[], dryRun: boolean) {
  console.log(dryRun ? "Rows that would be deleted" : "Deleted rows")
  console.log("==========================")

  for (const row of rows) {
    console.log(`${row.label.padEnd(38)} ${row.count}`)
  }

  const total = rows.reduce((sum, row) => sum + row.count, 0)
  console.log("-".repeat(46))
  console.log(`${"Total".padEnd(38)} ${total}`)

  if (dryRun) {
    console.log("")
    console.log("Dry run only. No data was deleted.")
    console.log(
      `To apply, rerun with --apply and ${CONFIRMATION_ENV}=true in the environment.`
    )
  }
}

async function main() {
  loadEnv({ quiet: true })
  assertConfirmed()

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required.")

  const dryRun = !process.argv.includes("--apply")
  printHeader(databaseUrl, dryRun)

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  try {
    const rows = dryRun
      ? await runDryRun(prisma)
      : await prisma.$transaction((tx) => runCleanup(tx), {
          timeout: 120_000,
        })
    printSummary(rows, dryRun)
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((error) => {
  console.error("")
  console.error("Cleanup failed.")
  console.error(error)
  process.exit(1)
})
