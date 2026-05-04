import type { UserRole } from "@/lib/auth"

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Ägare",
  ADMIN: "Ansvarig",
  MEMBER: "Medlem",
  CONTRACTOR: "Servicepartner",
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  OWNER:
    "Full åtkomst. Kan hantera användare, roller, fakturauppgifter och företagsinställningar.",
  ADMIN:
    "Kan hantera installationer, fastigheter, dokument och rapporter, men inte användare eller fakturauppgifter.",
  MEMBER:
    "Kan arbeta med företagets data men har begränsad åtkomst till inställningar.",
  CONTRACTOR:
    "Extern roll med åtkomst till tilldelade installationer och serviceuppgifter.",
}

export function formatRoleLabel(role: UserRole | string) {
  return ROLE_LABELS[role as UserRole] ?? role
}

export function formatRoleDescription(role: UserRole | string) {
  return ROLE_DESCRIPTIONS[role as UserRole] ?? ""
}

export function isAdminRole(role: UserRole | string | undefined) {
  return role === "OWNER" || role === "ADMIN"
}
