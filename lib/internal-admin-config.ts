export function getInternalAdminEmails() {
  return new Set(
    (process.env.INTERNAL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isInternalAdminEmail(email: string | null | undefined) {
  if (!email) return false

  return getInternalAdminEmails().has(email.trim().toLowerCase())
}
