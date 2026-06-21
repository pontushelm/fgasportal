import type { DashboardSetupStepId } from "@/lib/dashboard/setup-assistant"

const SETUP_PROGRESS_STORAGE_PREFIX = "helmpolar_setup_completed_steps"

export const DASHBOARD_SETUP_STEP_IDS: readonly DashboardSetupStepId[] = [
  "company",
  "properties",
  "installations",
  "installationProperties",
  "events",
  "dataQuality",
  "servicePartner",
  "actions",
  "reports",
]

export function getSetupCompletedStepsStorageKey(companyId: string) {
  return `${SETUP_PROGRESS_STORAGE_PREFIX}:${companyId}`
}

export function parseCompletedSetupSteps(
  storedValue: string | null
): DashboardSetupStepId[] {
  if (!storedValue) return []

  try {
    const parsed = JSON.parse(storedValue)
    if (!Array.isArray(parsed)) return []

    return DASHBOARD_SETUP_STEP_IDS.filter((stepId) =>
      parsed.includes(stepId)
    )
  } catch {
    return []
  }
}

export function addCompletedSetupStep(
  completedStepIds: readonly DashboardSetupStepId[],
  stepId: DashboardSetupStepId
) {
  return DASHBOARD_SETUP_STEP_IDS.filter(
    (candidate) => candidate === stepId || completedStepIds.includes(candidate)
  )
}

export function serializeCompletedSetupSteps(
  completedStepIds: readonly DashboardSetupStepId[]
) {
  return JSON.stringify(
    DASHBOARD_SETUP_STEP_IDS.filter((stepId) =>
      completedStepIds.includes(stepId)
    )
  )
}
