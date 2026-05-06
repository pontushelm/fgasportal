export function normalizeSwedishOrgNumber(value: string) {
  return value.replace(/-/g, "").trim()
}

export function isValidSwedishOrgNumber(value: string) {
  return /^\d{10}$/.test(normalizeSwedishOrgNumber(value))
}
