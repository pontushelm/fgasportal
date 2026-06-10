import type { PrismaClient } from "@prisma/client"

export type HealthCheckStatus = "SUCCESS" | "WARNING" | "ERROR"
export type OverallHealthStatus = "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL"

export type HealthCheckItem = {
  id: string
  component: string
  status: HealthCheckStatus
  explanation: string
  suggestedFix: string | null
}

export type HealthReport = {
  overallStatus: OverallHealthStatus
  generatedAt: string
  checks: HealthCheckItem[]
}

type BlobList = (options?: {
  limit?: number
  token?: string
}) => Promise<unknown>

type HealthCheckDependencies = {
  blobList?: BlobList
  cronConfig?: {
    crons?: Array<{
      path?: string
      schedule?: string
    }>
  }
  env?: Record<string, string | undefined>
  now?: Date
  prisma: Pick<PrismaClient, "$queryRaw">
}

const INSPECTION_REMINDER_CRON_PATH = "/api/cron/inspection-reminders"

export async function buildHealthReport({
  blobList,
  cronConfig,
  env = process.env,
  now = new Date(),
  prisma,
}: HealthCheckDependencies): Promise<HealthReport> {
  const checks = await Promise.all([
    checkDatabase(prisma),
    checkBlobStorage(env, blobList),
    checkEmail(env),
    checkSignedReports(env),
    checkEnvironment(env),
    checkCron(env, cronConfig),
  ])

  return {
    overallStatus: calculateOverallHealthStatus(checks),
    generatedAt: now.toISOString(),
    checks,
  }
}

export function calculateOverallHealthStatus(
  checks: Pick<HealthCheckItem, "status">[]
): OverallHealthStatus {
  if (checks.some((check) => check.status === "ERROR")) return "CRITICAL"
  if (checks.some((check) => check.status === "WARNING")) return "NEEDS_ATTENTION"
  return "HEALTHY"
}

async function checkDatabase(
  prisma: Pick<PrismaClient, "$queryRaw">
): Promise<HealthCheckItem> {
  try {
    await prisma.$queryRaw`SELECT 1`

    return {
      id: "database",
      component: "Databas",
      status: "SUCCESS",
      explanation: "Prisma kunde ansluta och köra en enkel kontrollfråga.",
      suggestedFix: null,
    }
  } catch {
    return {
      id: "database",
      component: "Databas",
      status: "ERROR",
      explanation: "Databaskontrollen misslyckades.",
      suggestedFix:
        "Kontrollera DATABASE_URL, Neon-status och att Prisma-migreringar är körda.",
    }
  }
}

async function checkBlobStorage(
  env: Record<string, string | undefined>,
  blobList?: BlobList
): Promise<HealthCheckItem> {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return {
      id: "blob",
      component: "Blob Storage",
      status: "ERROR",
      explanation: "BLOB_READ_WRITE_TOKEN saknas.",
      suggestedFix:
        "Lägg till BLOB_READ_WRITE_TOKEN i Vercel-miljön och lokala miljövariabler.",
    }
  }

  if (!blobList) {
    return {
      id: "blob",
      component: "Blob Storage",
      status: "WARNING",
      explanation: "Blob-token finns, men åtkomstkontrollen kunde inte köras.",
      suggestedFix: "Verifiera Blob-kopplingen i Vercel om filhämtningar misslyckas.",
    }
  }

  try {
    await blobList({ limit: 1, token })

    return {
      id: "blob",
      component: "Blob Storage",
      status: "SUCCESS",
      explanation: "Blob-konfigurationen finns och en read-only åtkomstkontroll lyckades.",
      suggestedFix: null,
    }
  } catch {
    return {
      id: "blob",
      component: "Blob Storage",
      status: "ERROR",
      explanation: "Blob-token finns, men åtkomstkontrollen misslyckades.",
      suggestedFix: "Kontrollera att Blob Store är kopplad till rätt Vercel-projekt.",
    }
  }
}

function checkEmail(env: Record<string, string | undefined>): HealthCheckItem {
  if (env.RESEND_API_KEY) {
    return {
      id: "email",
      component: "E-post",
      status: "SUCCESS",
      explanation: "RESEND_API_KEY finns konfigurerad.",
      suggestedFix: null,
    }
  }

  return {
    id: "email",
    component: "E-post",
    status: "WARNING",
    explanation: "RESEND_API_KEY saknas. Systemet kan köras, men e-post skickas inte.",
    suggestedFix: "Lägg till RESEND_API_KEY innan inbjudningar och notifieringar används.",
  }
}

function checkSignedReports(env: Record<string, string | undefined>): HealthCheckItem {
  if (env.BLOB_READ_WRITE_TOKEN) {
    return {
      id: "signed-reports",
      component: "Signerade rapporter",
      status: "SUCCESS",
      explanation: "Lagring för signerade rapportartefakter är konfigurerad.",
      suggestedFix: null,
    }
  }

  return {
    id: "signed-reports",
    component: "Signerade rapporter",
    status: "ERROR",
    explanation: "Signerade rapporter kräver Blob-lagring, men token saknas.",
    suggestedFix:
      "Konfigurera BLOB_READ_WRITE_TOKEN innan signerad PDF-export används.",
  }
}

function checkEnvironment(env: Record<string, string | undefined>): HealthCheckItem {
  const missing = ["DATABASE_URL", "JWT_SECRET"].filter((key) => !env[key])

  if (missing.length === 0) {
    return {
      id: "environment",
      component: "Miljövariabler",
      status: "SUCCESS",
      explanation: "Kritiska miljövariabler för databas och inloggning finns.",
      suggestedFix: null,
    }
  }

  return {
    id: "environment",
    component: "Miljövariabler",
    status: "ERROR",
    explanation: `Saknar kritiska miljövariabler: ${missing.join(", ")}.`,
    suggestedFix: "Lägg till saknade variabler i Vercel och lokal miljö.",
  }
}

function checkCron(
  env: Record<string, string | undefined>,
  cronConfig?: { crons?: Array<{ path?: string; schedule?: string }> }
): HealthCheckItem {
  const configuredCron = cronConfig?.crons?.find(
    (cron) => cron.path === INSPECTION_REMINDER_CRON_PATH
  )

  if (configuredCron && env.CRON_SECRET) {
    return {
      id: "cron",
      component: "Cron",
      status: "SUCCESS",
      explanation: `Påminnelsejobbet är konfigurerat (${configuredCron.schedule}).`,
      suggestedFix: null,
    }
  }

  const missingParts = [
    !configuredCron ? "vercel.json-cron" : null,
    !env.CRON_SECRET ? "CRON_SECRET" : null,
  ].filter((value): value is string => Boolean(value))

  return {
    id: "cron",
    component: "Cron",
    status: "WARNING",
    explanation: `Cron är inte komplett konfigurerat. Saknar: ${missingParts.join(", ")}.`,
    suggestedFix:
      "Verifiera vercel.json och CRON_SECRET innan automatiska påminnelser används.",
  }
}
