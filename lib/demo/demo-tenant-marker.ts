function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 32)
}

export function getDemoTenantPropertyIdPrefix(companyId: string) {
  return `demo_${safeId(companyId)}_property_`
}
