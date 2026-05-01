import type { UserRole } from "@/lib/auth"

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Ägare",
  ADMIN: "Administratör",
  MEMBER: "Medlem",
  CONTRACTOR: "Servicepartner",
}

export function formatRoleLabel(role: UserRole | string) {
  return ROLE_LABELS[role as UserRole] ?? role
}

export function isAdminRole(role: UserRole | string | undefined) {
  return role === "OWNER" || role === "ADMIN"
}
