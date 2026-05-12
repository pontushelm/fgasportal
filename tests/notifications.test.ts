import { describe, expect, it } from "vitest"
import {
  buildActionQueueUrl,
  getInspectionActionQueueUrl,
  getLeakageActionQueueUrl,
  getMissingServiceContactActionQueueUrl,
} from "@/lib/actions/action-links"
import {
  buildContractorAssignmentEmailText,
  buildInspectionReminderEmailText,
} from "@/lib/email"
import {
  getReminderRecipients,
  selectLeakNotificationRecipients,
} from "@/lib/notification-recipient-selection"

describe("notification action deep links", () => {
  const appUrl = "https://app.example.com"

  it("builds inspection reminder links using existing action filter names", () => {
    expect(
      getInspectionActionQueueUrl({
        appUrl,
        status: "OVERDUE",
      })
    ).toBe(
      "https://app.example.com/dashboard/actions?filter=OVERDUE_INSPECTIONS&due=OVERDUE"
    )
    expect(
      getInspectionActionQueueUrl({
        appUrl,
        status: "DUE_SOON",
        serviceContactId: "contractor-1",
      })
    ).toBe(
      "https://app.example.com/dashboard/actions?filter=UPCOMING_INSPECTIONS&due=NEXT_30_DAYS&serviceContact=contractor-1"
    )
  })

  it("builds leakage and service contact action queue links", () => {
    expect(getLeakageActionQueueUrl(appUrl)).toBe(
      "https://app.example.com/dashboard/actions?filter=LEAKAGE"
    )
    expect(getMissingServiceContactActionQueueUrl(appUrl)).toBe(
      "https://app.example.com/dashboard/actions?filter=NO_SERVICE_PARTNER"
    )
    expect(
      buildActionQueueUrl(`${appUrl}/`, {
        serviceContactId: "contractor-1",
      })
    ).toBe("https://app.example.com/dashboard/actions?serviceContact=contractor-1")
  })

  it("builds service partner company filtered action queue links", () => {
    expect(
      getInspectionActionQueueUrl({
        appUrl,
        status: "OVERDUE",
        serviceContactId: "contractor-1",
        servicePartnerCompanyId: "service-company-1",
      })
    ).toBe(
      "https://app.example.com/dashboard/actions?filter=OVERDUE_INSPECTIONS&due=OVERDUE&servicePartnerCompany=service-company-1"
    )
    expect(
      buildActionQueueUrl(appUrl, {
        servicePartnerCompanyId: "service-company-1",
      })
    ).toBe(
      "https://app.example.com/dashboard/actions?servicePartnerCompany=service-company-1"
    )
  })
})

describe("service partner notification copy", () => {
  it("adds service partner company context to inspection reminder emails", () => {
    const text = buildInspectionReminderEmailText({
      installationName: "Kyl A",
      location: "Plan 2",
      nextInspection: new Date("2026-06-01T00:00:00.000Z"),
      status: "OVERDUE",
      installationUrl: "https://app.example.com/dashboard/installations/1",
      actionQueueUrl:
        "https://app.example.com/dashboard/actions?servicePartnerCompany=service-company-1",
      servicePartnerCompanyName: "Elins kylföretag",
      servicePartnerCompanySummary: {
        overdueCount: 3,
        dueSoonCount: 5,
      },
    })

    expect(text).toContain(
      "Påminnelsen gäller aggregat som är tilldelade dig som servicekontakt hos Elins kylföretag."
    )
    expect(text).toContain(
      "För Elins kylföretag finns 3 försenade kontroller och 5 kommande kontroller kopplade till era servicekontakter."
    )
  })

  it("keeps inspection reminder copy generic without service partner metadata", () => {
    const text = buildInspectionReminderEmailText({
      installationName: "Kyl A",
      location: null,
      nextInspection: new Date("2026-06-01T00:00:00.000Z"),
      status: "DUE_SOON",
      installationUrl: "https://app.example.com/dashboard/installations/1",
      actionQueueUrl: "https://app.example.com/dashboard/actions",
    })

    expect(text).not.toContain("servicekontakt hos")
    expect(text).toContain("Ett aggregat har kontroll inom 30 dagar i FgasPortal.")
  })

  it("adds service partner company context to assignment notifications", () => {
    const text = buildContractorAssignmentEmailText({
      contractorPortalUrl: "https://app.example.com/dashboard/service",
      actionQueueUrl:
        "https://app.example.com/dashboard/actions?servicePartnerCompany=service-company-1",
      servicePartnerCompanyName: "Elins kylföretag",
    })

    expect(text).toContain(
      "Ett eller flera aggregat har tilldelats dig som servicekontakt hos Elins kylföretag."
    )
  })
})

describe("inspection reminder recipients", () => {
  const admin = {
    id: "admin",
    email: "admin@example.com",
    notifyInspectionReminderEmails: true,
  }
  const contractor = {
    id: "contractor",
    email: "contractor@example.com",
    role: "CONTRACTOR",
    isActive: true,
    notifyInspectionReminderEmails: true,
    memberships: [{ companyId: "company-a" }],
  }

  it("always includes owner/admin recipients from the company membership list", () => {
    const recipients = getReminderRecipients({
      company: {
        id: "company-a",
        sendInspectionRemindersToContractors: false,
        memberships: [{ user: admin }],
      },
      assignedContractor: contractor,
    })

    expect(recipients).toEqual([admin])
  })

  it("only includes assigned contractors when the company toggle is enabled", () => {
    const recipients = getReminderRecipients({
      company: {
        id: "company-a",
        sendInspectionRemindersToContractors: true,
        memberships: [{ user: admin }],
      },
      assignedContractor: contractor,
    })

    expect(recipients.map((recipient) => recipient.email)).toEqual([
      "admin@example.com",
      "contractor@example.com",
    ])
  })

  it("does not include contractors from another company", () => {
    const recipients = getReminderRecipients({
      company: {
        id: "company-a",
        sendInspectionRemindersToContractors: true,
        memberships: [{ user: admin }],
      },
      assignedContractor: {
        ...contractor,
        memberships: [{ companyId: "company-b" }],
      },
    })

    expect(recipients).toEqual([admin])
  })
})

describe("leak notification recipients", () => {
  it("selects active owners/admins with leak emails enabled and dedupes by email", () => {
    const recipients = selectLeakNotificationRecipients([
      {
        role: "OWNER",
        isActive: true,
        user: {
          id: "owner",
          email: "alerts@example.com",
          isActive: true,
          notifyLeakEmails: true,
        },
      },
      {
        role: "ADMIN",
        isActive: true,
        user: {
          id: "admin",
          email: "ALERTS@example.com",
          isActive: true,
          notifyLeakEmails: true,
        },
      },
    ])

    expect(recipients).toEqual([
      {
        id: "owner",
        email: "alerts@example.com",
      },
    ])
  })

  it("excludes contractors, inactive users and users who disabled leak emails", () => {
    const recipients = selectLeakNotificationRecipients([
      {
        role: "CONTRACTOR",
        isActive: true,
        user: {
          id: "contractor",
          email: "contractor@example.com",
          isActive: true,
          notifyLeakEmails: true,
        },
      },
      {
        role: "ADMIN",
        isActive: true,
        user: {
          id: "admin-disabled",
          email: "admin-disabled@example.com",
          isActive: true,
          notifyLeakEmails: false,
        },
      },
      {
        role: "OWNER",
        isActive: true,
        user: {
          id: "owner-inactive",
          email: "owner-inactive@example.com",
          isActive: false,
          notifyLeakEmails: true,
        },
      },
    ])

    expect(recipients).toEqual([])
  })
})
