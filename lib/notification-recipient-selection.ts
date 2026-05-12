export type ReminderRecipient = {
  id: string
  email: string
  notifyInspectionReminderEmails: boolean
}

export function getReminderRecipients(installation: {
  company: {
    sendInspectionRemindersToContractors: boolean
    memberships: Array<{ user: ReminderRecipient }>
    id: string
  }
  assignedContractor: {
    id: string
    email: string
    role: string
    isActive: boolean
    notifyInspectionReminderEmails: boolean
    memberships: Array<{ companyId: string }>
  } | null
}) {
  const recipientsByEmail = new Map<string, ReminderRecipient>()

  for (const { user: admin } of installation.company.memberships) {
    if (admin.email) {
      recipientsByEmail.set(admin.email.toLowerCase(), admin)
    }
  }

  const contractor = installation.assignedContractor

  if (
    installation.company.sendInspectionRemindersToContractors &&
    contractor?.email &&
    contractor.isActive &&
    contractor.memberships.some(
      (membership) => membership.companyId === installation.company.id
    ) &&
    contractor.notifyInspectionReminderEmails
  ) {
    recipientsByEmail.set(contractor.email.toLowerCase(), {
      id: contractor.id,
      email: contractor.email,
      notifyInspectionReminderEmails: contractor.notifyInspectionReminderEmails,
    })
  }

  return Array.from(recipientsByEmail.values())
}

export type LeakNotificationRecipient = {
  id: string
  email: string
}

export function selectLeakNotificationRecipients(
  memberships: Array<{
    role: string
    isActive: boolean
    user: {
      id: string
      email: string
      isActive: boolean
      notifyLeakEmails: boolean
    }
  }>
): LeakNotificationRecipient[] {
  const recipientsByEmail = new Map<string, LeakNotificationRecipient>()

  memberships.forEach((membership) => {
    if (
      !membership.isActive ||
      !["OWNER", "ADMIN"].includes(membership.role) ||
      !membership.user.isActive ||
      !membership.user.notifyLeakEmails ||
      !membership.user.email
    ) {
      return
    }

    const normalizedEmail = membership.user.email.toLowerCase()
    if (!recipientsByEmail.has(normalizedEmail)) {
      recipientsByEmail.set(normalizedEmail, {
        id: membership.user.id,
        email: membership.user.email,
      })
    }
  })

  return Array.from(recipientsByEmail.values())
}
