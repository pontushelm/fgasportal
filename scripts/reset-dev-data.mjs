import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { config as loadEnv } from "dotenv"

loadEnv({ quiet: true })

const REQUIRED_CONFIRMATION = "true"

function fail(message) {
  console.error(`\nReset avbruten: ${message}`)
  process.exit(1)
}

function describeDatabaseTarget(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    const databaseName = parsed.pathname.replace(/^\//, "") || "(ingen databas i URL)"
    return {
      databaseName,
      host: parsed.hostname,
      port: parsed.port || "(standard)",
      protocol: parsed.protocol.replace(":", ""),
    }
  } catch {
    return {
      databaseName: "(okänd)",
      host: "(ogiltig DATABASE_URL)",
      port: "(okänd)",
      protocol: "(okänd)",
    }
  }
}

function assertSafeToRun() {
  if (process.env.NODE_ENV === "production") {
    fail("NODE_ENV=production är inte tillåtet.")
  }

  if (process.env.VERCEL) {
    fail("VERCEL är satt. Scriptet får inte köras i Vercel-miljö.")
  }

  if (process.env.VERCEL_ENV) {
    fail("VERCEL_ENV är satt. Scriptet får bara köras manuellt i lokal/dev.")
  }

  if (process.env.CONFIRM_RESET_DEV_DATA !== REQUIRED_CONFIRMATION) {
    fail(
      "sätt CONFIRM_RESET_DEV_DATA=true för att bekräfta att all dev/testdata ska tas bort."
    )
  }

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL saknas.")
  }
}

function printTarget(databaseUrl) {
  const target = describeDatabaseTarget(databaseUrl)

  console.log("FgasPortal dev/testdata-reset")
  console.log("================================")
  console.log(`NODE_ENV: ${process.env.NODE_ENV || "(inte satt)"}`)
  console.log(`Databas: ${target.protocol}://${target.host}:${target.port}/${target.databaseName}`)
  console.log("Hemligheter i DATABASE_URL skrivs inte ut.")
  console.log("")
}

async function deleteTable(tx, summary, label, operation) {
  const result = await operation(tx)
  summary.push({
    label,
    count: result.count,
  })
}

function printSummary(summary) {
  console.log("\nBorttagna rader")
  console.log("===============")

  for (const row of summary) {
    console.log(`${row.label.padEnd(36)} ${row.count}`)
  }

  const total = summary.reduce((sum, row) => sum + row.count, 0)
  console.log("-".repeat(42))
  console.log(`${"Totalt".padEnd(36)} ${total}`)
}

async function main() {
  assertSafeToRun()

  const databaseUrl = process.env.DATABASE_URL
  printTarget(databaseUrl)

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })

  const summary = []

  try {
    await prisma.$transaction(
      async (tx) => {
        await deleteTable(tx, summary, "Dokumentmetadata", (client) =>
          client.installationDocument.deleteMany()
        )
        await deleteTable(tx, summary, "Händelser", (client) =>
          client.installationEvent.deleteMany()
        )
        await deleteTable(tx, summary, "Kontroller", (client) =>
          client.inspection.deleteMany()
        )
        await deleteTable(tx, summary, "Påminnelseloggar", (client) =>
          client.reminderLog.deleteMany()
        )
        await deleteTable(tx, summary, "Aktivitetsloggar", (client) =>
          client.activityLog.deleteMany()
        )
        await deleteTable(tx, summary, "Sparade filter", (client) =>
          client.savedFilter.deleteMany()
        )
        await deleteTable(tx, summary, "Signerade årsrapporter", (client) =>
          client.signedAnnualFgasReport.deleteMany()
        )
        await deleteTable(tx, summary, "Feedback", (client) =>
          client.feedback.deleteMany()
        )
        await deleteTable(tx, summary, "Inbjudningar", (client) =>
          client.invitation.deleteMany()
        )
        await deleteTable(tx, summary, "Aggregat", (client) =>
          client.installation.deleteMany()
        )
        await deleteTable(tx, summary, "Fastigheter", (client) =>
          client.property.deleteMany()
        )
        await deleteTable(tx, summary, "Kund-serviceorganisationslänkar", (client) =>
          client.companyServiceOrganization.deleteMany()
        )
        await deleteTable(tx, summary, "Företagsmedlemskap", (client) =>
          client.companyMembership.deleteMany()
        )
        await deleteTable(tx, summary, "Serviceorganisationsmedlemskap", (client) =>
          client.serviceOrganizationMembership.deleteMany()
        )
        await deleteTable(tx, summary, "Servicepartnerföretag", (client) =>
          client.servicePartnerCompany.deleteMany()
        )
        await deleteTable(tx, summary, "Serviceorganisationer", (client) =>
          client.serviceOrganization.deleteMany()
        )
        await deleteTable(tx, summary, "Lösenordsåterställningar", (client) =>
          client.passwordResetToken.deleteMany()
        )
        await deleteTable(tx, summary, "Användare", (client) =>
          client.user.deleteMany()
        )
        await deleteTable(tx, summary, "Företag", (client) =>
          client.company.deleteMany()
        )
      },
      {
        timeout: 120_000,
      }
    )

    printSummary(summary)
    console.log("\nKlart. Ingen ny seed-data skapades.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("\nReset misslyckades.")
  console.error(error)
  process.exit(1)
})
