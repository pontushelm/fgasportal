import { describe, expect, it } from "vitest"
import {
  buildActionQueueUrl,
  getInspectionActionQueueUrl,
  getLeakageActionQueueUrl,
  getMissingServiceContactActionQueueUrl,
} from "@/lib/actions/action-links"
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
