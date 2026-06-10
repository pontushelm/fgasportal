import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildHealthReport,
  calculateOverallHealthStatus,
} from "@/lib/health/health-checks"

const authenticateApiRequest = vi.fn()
const queryRaw = vi.fn()
const blobList = vi.fn()

vi.mock("@vercel/blob", () => ({
  list: blobList,
}))

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}))

const healthyEnv = {
  BLOB_READ_WRITE_TOKEN: "blob-token",
  CRON_SECRET: "cron-secret",
  DATABASE_URL: "postgres://example",
  JWT_SECRET: "jwt-secret",
  RESEND_API_KEY: "resend-key",
}

const cronConfig = {
  crons: [
    {
      path: "/api/cron/inspection-reminders",
      schedule: "0 6 * * *",
    },
  ],
}

describe("health checks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryRaw.mockResolvedValue([{ ok: 1 }])
    blobList.mockResolvedValue({ blobs: [] })
  })

  it("returns a healthy report when all critical checks pass", async () => {
    const report = await buildHealthReport({
      blobList,
      cronConfig,
      env: healthyEnv,
      now: new Date("2026-06-10T10:00:00.000Z"),
      prisma: { $queryRaw: queryRaw } as never,
    })

    expect(report.overallStatus).toBe("HEALTHY")
    expect(report.generatedAt).toBe("2026-06-10T10:00:00.000Z")
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "database", status: "SUCCESS" }),
        expect.objectContaining({ id: "blob", status: "SUCCESS" }),
        expect.objectContaining({ id: "email", status: "SUCCESS" }),
        expect.objectContaining({ id: "cron", status: "SUCCESS" }),
      ])
    )
    expect(blobList).toHaveBeenCalledWith({ limit: 1, token: "blob-token" })
  })

  it("marks database failure as a critical issue", async () => {
    queryRaw.mockRejectedValueOnce(new Error("database unavailable"))

    const report = await buildHealthReport({
      blobList,
      cronConfig,
      env: healthyEnv,
      prisma: { $queryRaw: queryRaw } as never,
    })

    expect(report.overallStatus).toBe("CRITICAL")
    expect(report.checks.find((check) => check.id === "database")).toMatchObject({
      status: "ERROR",
      suggestedFix: expect.stringContaining("DATABASE_URL"),
    })
  })

  it("reports missing environment variables and integration config", async () => {
    const report = await buildHealthReport({
      blobList,
      cronConfig: { crons: [] },
      env: {},
      prisma: { $queryRaw: queryRaw } as never,
    })

    expect(report.overallStatus).toBe("CRITICAL")
    expect(report.checks.find((check) => check.id === "environment")).toMatchObject({
      status: "ERROR",
      explanation: expect.stringContaining("DATABASE_URL"),
    })
    expect(report.checks.find((check) => check.id === "blob")).toMatchObject({
      status: "ERROR",
    })
    expect(report.checks.find((check) => check.id === "email")).toMatchObject({
      status: "WARNING",
    })
    expect(report.checks.find((check) => check.id === "cron")).toMatchObject({
      status: "WARNING",
    })
  })

  it("calculates overall status from check severities", () => {
    expect(calculateOverallHealthStatus([{ status: "SUCCESS" }])).toBe("HEALTHY")
    expect(
      calculateOverallHealthStatus([
        { status: "SUCCESS" },
        { status: "WARNING" },
      ])
    ).toBe("NEEDS_ATTENTION")
    expect(
      calculateOverallHealthStatus([
        { status: "WARNING" },
        { status: "ERROR" },
      ])
    ).toBe("CRITICAL")
  })
})

describe("health API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryRaw.mockResolvedValue([{ ok: 1 }])
    blobList.mockResolvedValue({ blobs: [] })
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token"
    process.env.CRON_SECRET = "cron-secret"
    process.env.DATABASE_URL = "postgres://example"
    process.env.JWT_SECRET = "jwt-secret"
    process.env.RESEND_API_KEY = "resend-key"
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
  })

  it("allows OWNER users to view health", async () => {
    const { GET } = await import("@/app/api/dashboard/health/route")

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.overallStatus).toBe("HEALTHY")
  })

  it.each(["ADMIN", "MEMBER", "CONTRACTOR"] as const)(
    "denies %s users",
    async (role) => {
      const { GET } = await import("@/app/api/dashboard/health/route")
      authenticateApiRequest.mockResolvedValueOnce({
        user: {
          userId: "user-1",
          companyId: "company-1",
          role,
        },
      })

      const response = await GET(createRequest())

      expect(response.status).toBe(403)
      expect(queryRaw).not.toHaveBeenCalled()
      expect(blobList).not.toHaveBeenCalled()
    }
  )
})

function createRequest() {
  return new Request("http://localhost/api/dashboard/health") as never
}
