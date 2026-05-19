export function formatServicepartnerRoleLabel(user: {
  role: string
  isServicePartnerAdmin?: boolean
}) {
  if (user.role === "CONTRACTOR") {
    return user.isServicePartnerAdmin ? "Serviceansvarig" : "Tekniker"
  }

  return null
}
