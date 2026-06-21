import { shouldShowDemoIntroduction } from "@/lib/dashboard/demo-introduction"

const PILOT_WELCOME_STORAGE_PREFIX = "helmpolar_pilot_welcome_seen"

export type DashboardOnboardingOverlay =
  | "pilotWelcome"
  | "demoIntroduction"
  | null

export function getPilotWelcomeStorageKey(companyId: string, userId: string) {
  return `${PILOT_WELCOME_STORAGE_PREFIX}:${companyId}:${userId}`
}

export function getFirstDashboardOnboardingOverlay({
  demoIntroStoredValue,
  isDemoTenant,
  pilotWelcomeStoredValue,
}: {
  demoIntroStoredValue: string | null
  isDemoTenant: boolean
  pilotWelcomeStoredValue: string | null
}): DashboardOnboardingOverlay {
  if (pilotWelcomeStoredValue !== "1") return "pilotWelcome"

  if (
    shouldShowDemoIntroduction({
      isDemoTenant,
      storedValue: demoIntroStoredValue,
    })
  ) {
    return "demoIntroduction"
  }

  return null
}
