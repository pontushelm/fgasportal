const DEMO_INTRO_STORAGE_PREFIX = "helmpolar_demo_intro_seen"

export function getDemoIntroStorageKey(companyId: string) {
  return `${DEMO_INTRO_STORAGE_PREFIX}:${companyId}`
}

export function shouldShowDemoIntroduction({
  isDemoTenant,
  storedValue,
}: {
  isDemoTenant: boolean
  storedValue: string | null
}) {
  return isDemoTenant && storedValue !== "1"
}
