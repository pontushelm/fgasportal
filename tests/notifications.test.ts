import { describe, expect, it } from "vitest"
import {
  getReminderRecipients,
  selectLeakNotificationRecipients,
} from "@/lib/notification-recipient-selection"

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
