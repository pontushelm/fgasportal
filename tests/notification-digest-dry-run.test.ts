import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DashboardAction } from "@/lib/actions/generate-actions"
import { runNotificationDigestDryRun } from "@/lib/notifications/run-notification-digest"

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  companyFindMany: vi.fn(),
  loadDashboardActions: vi.fn(),
  notificationDigestLogFindUnique: vi.fn(),
}))

const loadActions = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest: mocks.authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/db", () => ({
  prisma: {
    company: {
      findMany: mocks.companyFindMany,
    },
    notificationDigestLog: {
      findUnique: mocks.notificationDigestLogFindUnique,
    },
  },
}))

vi.mock("@/lib/actions/load-dashboard-actions", () => ({
  loadDashboardActions: mocks.loadDashboardActions,
}))

const prisma = {
  company: {
    findMany: mocks.companyFindMany,
  },
  notificationDigestLog: {
    findUnique: mocks.notificationDigestLogFindUnique,
  },
}

describe("notification digest dry-run service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.companyFindMany.mockResolvedValue([
      createCompany({
        users: [createUser()],
      }),
    ])
    mocks.notificationDigestLogFindUnique.mockResolvedValue(null)
    loadActions.mockResolvedValue([createAction("OVERDUE_INSPECTION", "HIGH")])
  })

  it("marks enabled recipients with items as WOULD_SEND", async () => {
    const result = await runNotificationDigestDryRun({
      digestDate: new Date("2026-06-10T08:00:00.000Z"),
      loadActions,
      prisma,
    })

    expect(result).toMatchObject({
      companiesChecked: 1,
      eligibleRecipients: 1,
      recipientsChecked: 1,
      skippedAlreadySent: 0,
      skippedDisabled: 0,
      skippedNoItems: 0,
    })
    expect(result.results[0]).toMatchObject({
      decision: "WOULD_SEND",
      email: "owner@example.com",
      totalItems: 1,
    })
    expect(mocks.notificationDigestLogFindUnique).toHaveBeenCalled()
  })

  it("skips recipients with no digest items", async () => {
    loadActions.mockResolvedValueOnce([])

    const result = await runNotificationDigestDryRun({
      digestDate: new Date("2026-06-10T08:00:00.000Z"),
      loadActions,
      prisma,
    })

    expect(result.eligibleRecipients).toBe(0)
    expect(result.skippedNoItems).toBe(1)
    expect(result.results[0].decision).toBe("SKIP_NO_ITEMS")
    expect(mocks.notificationDigestLogFindUnique).not.toHaveBeenCalled()
  })

  it("skips recipients already sent today", async () => {
    mocks.notificationDigestLogFindUnique.mockResolvedValueOnce({
      id: "digest-log-1",
    })

    const result = await runNotificationDigestDryRun({
      digestDate: new Date("2026-06-10T08:00:00.000Z"),
      loadActions,
      prisma,
    })

    expect(result.eligibleRecipients).toBe(0)
    expect(result.skippedAlreadySent).toBe(1)
    expect(result.results[0].decision).toBe("SKIP_ALREADY_SENT")
  })

  it("skips disabled company settings", async () => {
    mocks.companyFindMany.mockResolvedValueOnce([
      createCompany({
        sendAnnualReportReminders: false,
        sendCertificateReminders: false,
        sendInspectionRemindersToContractors: false,
        users: [createUser()],
      }),
    ])

    const result = await runNotificationDigestDryRun({
      loadActions,
      prisma,
    })

    expect(result.skippedDisabled).toBe(1)
    expect(result.results[0].decision).toBe("SKIP_DISABLED")
    expect(loadActions).not.toHaveBeenCalled()
  })

  it("skips disabled user notifications", async () => {
    mocks.companyFindMany.mockResolvedValueOnce([
      createCompany({
        users: [
          createUser({
            notifyAnnualReportDeadlineEmails: false,
            notifyInspectionReminderEmails: false,
            notifyLeakEmails: false,
          }),
        ],
      }),
    ])

    const result = await runNotificationDigestDryRun({
      loadActions,
      prisma,
    })

    expect(result.skippedDisabled).toBe(1)
    expect(result.results[0].decision).toBe("SKIP_DISABLED")
    expect(loadActions).not.toHaveBeenCalled()
  })

  it("does not write digest logs during dry-run", async () => {
    await runNotificationDigestDryRun({
      loadActions,
      prisma,
    })

    expect("upsert" in prisma.notificationDigestLog).toBe(false)
  })
})

describe("notification digest dry-run API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    mocks.companyFindMany.mockResolvedValue([
      createCompany({ users: [createUser()] }),
    ])
    mocks.notificationDigestLogFindUnique.mockResolvedValue(null)
    mocks.loadDashboardActions.mockResolvedValue([
      createAction("OVERDUE_INSPECTION", "HIGH"),
    ])
  })

  it("allows OWNER to run a dry-run", async () => {
    const { POST } = await import(
      "@/app/api/dashboard/notifications/digest/dry-run/route"
    )

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.eligibleRecipients).toBe(1)
    expect(mocks.loadDashboardActions).toHaveBeenCalled()
  })

  it.each(["ADMIN", "MEMBER", "CONTRACTOR"] as const)(
    "denies %s users",
    async (role) => {
      const { POST } = await import(
        "@/app/api/dashboard/notifications/digest/dry-run/route"
      )
      mocks.authenticateApiRequest.mockResolvedValueOnce({
        user: {
          userId: "user-1",
          companyId: "company-1",
          role,
        },
      })

      const response = await POST(createRequest())

      expect(response.status).toBe(403)
      expect(mocks.loadDashboardActions).not.toHaveBeenCalled()
    }
  )
})

function createCompany(overrides = {}) {
  return {
    id: "company-1",
    sendAnnualReportReminders: false,
    sendCertificateReminders: false,
    sendInspectionRemindersToContractors: true,
    users: [createUser()],
    ...overrides,
  }
}

function createUser(overrides = {}) {
  return {
    id: "owner-1",
    email: "owner@example.com",
    memberships: [
      {
        companyId: "company-1",
        id: "membership-owner-1",
        isServicePartnerAdmin: false,
        role: "OWNER",
        servicePartnerCompany: null,
        servicePartnerCompanyId: null,
      },
    ],
    notifyAnnualReportDeadlineEmails: true,
    notifyInspectionReminderEmails: true,
    notifyLeakEmails: true,
    ...overrides,
  }
}

function createAction(
  type: DashboardAction["type"],
  severity: DashboardAction["severity"]
): DashboardAction {
  return {
    id: `${type}-1`,
    assignedServiceContactEmail: null,
    assignedServiceContactId: null,
    assignedServiceContactName: null,
    createdAt: null,
    createdFrom: "inspection",
    description: "Test",
    dueDate: null,
    equipmentId: null,
    href: "/dashboard/actions",
    installationId: "installation-1",
    installationName: "Aggregat 1",
    priority: severity,
    propertyId: null,
    propertyName: null,
    servicePartnerCompanyId: null,
    servicePartnerCompanyName: null,
    severity,
    sortPriority: 1,
    source: "inspection",
    title: "Test",
    type,
  }
}

function createRequest() {
  return new Request(
    "http://localhost/api/dashboard/notifications/digest/dry-run",
    { method: "POST" }
  ) as never
}
