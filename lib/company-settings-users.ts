import type { UserRole } from "@/lib/auth"

export const COMPANY_SETTINGS_USER_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const
export const COMPANY_SETTINGS_ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"] as const

export type CompanySettingsUserRole = (typeof COMPANY_SETTINGS_USER_ROLES)[number]
export type CompanySettingsAssignableRole =
  (typeof COMPANY_SETTINGS_ASSIGNABLE_ROLES)[number]

export function isCompanySettingsUserRole(role: UserRole | string) {
  return COMPANY_SETTINGS_USER_ROLES.includes(role as CompanySettingsUserRole)
}
