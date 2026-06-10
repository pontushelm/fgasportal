import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DashboardAction } from "@/lib/actions/generate-actions"
import { buildNotificationDigest } from "@/lib/notifications/build-notification-digest"

const authenticateApiRequest = vi.fn()
const loadDashboardActions = vi.fn()
const companyFindUnique = vi.fn()
const companyUpdate = vi.fn()
const userFindUnique = vi.fn()
const userUpdate = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/actions/load-dashboard-actions", () => ({
  loadDashboardActions,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    company: {
      findUnique: companyFindUnique,
      update: companyUpdate,
    },
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
    },
  },
}))

const owner = {
  userId: "owner-1",
  companyId: "company-1",
  role: "OWNER",
}

describe("notification digest", () => {
  it("groups inspection and certificate actions", () => {
    const digest = buildNotificationDigest({
      actions: [
        createAction("OVERDUE_INSPECTION", "HIGH"),
        createAction("DUE_SOON_INSPECTION", "MEDIUM"),
        createAction("TECHNICIAN_CERTIFICATE_EXPIRED", "HIGH"),
        createAction("SERVICEPARTNER_CERTIFICATE_EXPIRING", "MEDIUM"),
      ],
      enabled: {
        reports: false,
      },
    })

    expect(digest.inspections.count).toBe(2)
    expect(digest.certificates.count).toBe(2)
    expect(digest.reports.count).toBe(0)
    expect(digest.totalItems).toBe(4)
    expect(digest.inspections.items.map((item) => item.id)).toEqual([
      "DUE_SOON_INSPECTION",
      "OVERDUE_INSPECTION",
    ])
  })

  it("returns an empty digest when categories are disabled and no actions exist", () => {
    const digest = buildNotificationDigest({
      actions: [],
      enabled: {
        certificates: false,
        inspections: false,
        reports: false,
      },
    })

    expect(digest.totalItems).toBe(0)
    expect(digest.inspections.items).toEqual([])
    expect(digest.certificates.items).toEqual([])
    expect(digest.reports.items).toEqual([])
  })

  it("adds annual report reminder foundation when report reminders are enabled", () => {
    const digest = buildNotificationDigest({
      actions: [],
      today: new Date("2026-02-01T00:00:00.000Z"),
    })

    expect(digest.reports.items).toEqual([
      expect.objectContaining({
        id: "annual-report-season",
        label: "Årsrapportering 2026 närmar sig",
      }),
    ])
  })
})

describe("notification center API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: owner })
    loadDashboardActions.mockResolvedValue([createAction("OVERDUE_INSPECTION", "HIGH")])
    companyFindUnique.mockResolvedValue({
      sendAnnualReportReminders: true,
      sendCertificateReminders: true,
      sendInspectionRemindersToContractors: true,
    })
    userFindUnique.mockResolvedValue({
      notifyAnnualReportDeadlineEmails: true,
      notifyInspectionReminderEmails: true,
      notifyLeakEmails: true,
    })
    companyUpdate.mockResolvedValue({
      sendAnnualReportReminders: false,
      sendCertificateReminders: true,
      sendInspectionRemindersToContractors: true,
    })
    userUpdate.mockResolvedValue({
      notifyAnnualReportDeadlineEmails: false,
      notifyInspectionReminderEmails: false,
      notifyLeakEmails: false,
    })
  })

  it("returns grouped digest and settings", async () => {
    const { GET } = await import("@/app/api/dashboard/notifications/route")

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.digest.inspections.count).toBe(1)
    expect(body.settings).toMatchObject({
      canManageCompanySettings: true,
      company: {
        annualReportReminders: true,
        certificateReminders: true,
        inspectionReminders: true,
      },
      user: {
        receiveNotifications: true,
      },
    })
  })

  it("persists company and user notification settings for OWNER", async () => {
    const { PATCH } = await import("@/app/api/dashboard/notifications/route")

    const response = await PATCH(
      jsonRequest({
        company: {
          annualReportReminders: false,
          certificateReminders: true,
          inspectionReminders: true,
        },
        user: {
          receiveNotifications: false,
        },
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(companyUpdate).toHaveBeenCalledWith({
      where: {
        id: "company-1",
      },
      data: {
        sendAnnualReportReminders: false,
        sendCertificateReminders: true,
        sendInspectionRemindersToContractors: true,
      },
      select: {
        sendAnnualReportReminders: true,
        sendCertificateReminders: true,
        sendInspectionRemindersToContractors: true,
      },
    })
    expect(userUpdate).toHaveBeenCalledWith({
      where: {
        id: "owner-1",
      },
      data: {
        notifyAnnualReportDeadlineEmails: false,
        notifyInspectionReminderEmails: false,
        notifyLeakEmails: false,
      },
      select: {
        notifyAnnualReportDeadlineEmails: true,
        notifyInspectionReminderEmails: true,
        notifyLeakEmails: true,
      },
    })
    expect(body.settings.user.receiveNotifications).toBe(false)
  })

  it("prevents non-OWNER users from changing company notification settings", async () => {
    const { PATCH } = await import("@/app/api/dashboard/notifications/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "admin-1",
        companyId: "company-1",
        role: "ADMIN",
      },
    })

    const response = await PATCH(
      jsonRequest({
        company: {
          annualReportReminders: false,
          certificateReminders: false,
          inspectionReminders: false,
        },
      })
    )

    expect(response.status).toBe(403)
    expect(companyUpdate).not.toHaveBeenCalled()
  })
})

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
    createdFrom: type.includes("CERTIFICATE") ? "certification" : "inspection",
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
    source: type.includes("CERTIFICATE") ? "certification" : "inspection",
    title: "Test",
    type,
  }
}

function createRequest() {
  return new Request("http://localhost/api/dashboard/notifications") as never
}

function jsonRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/dashboard/notifications", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  }) as never
}
