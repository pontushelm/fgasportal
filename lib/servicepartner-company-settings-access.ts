export type ServicePartnerSettingsUser = {
  role: string
  isServicePartnerAdmin?: boolean
  servicePartnerCompanyId?: string | null
}

export function canViewServicePartnerCompanySettings(
  user: ServicePartnerSettingsUser
) {
  return Boolean(user.role === "CONTRACTOR" && user.servicePartnerCompanyId)
}

export function canEditServicePartnerCompanySettings(
  user: ServicePartnerSettingsUser
) {
  return Boolean(
    canViewServicePartnerCompanySettings(user) && user.isServicePartnerAdmin
  )
}
