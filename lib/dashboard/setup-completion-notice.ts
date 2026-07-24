import type { DashboardSetupRole } from "@/lib/dashboard/setup-assistant"

const SETUP_COMPLETION_NOTICE_PREFIX = "helmpolar_setup_completion_seen"

export function getSetupCompletionNoticeStorageKey({
  companyId,
  role,
  totalStepCount,
  userId,
}: {
  companyId: string
  role: DashboardSetupRole
  totalStepCount: number
  userId: string
}) {
  return [
    SETUP_COMPLETION_NOTICE_PREFIX,
    companyId,
    userId,
    role,
    String(totalStepCount),
  ].join(":")
}

export function shouldShowSetupCompletionNotice({
  currentIsComplete,
  previousIsComplete,
  storedValue,
}: {
  currentIsComplete: boolean
  previousIsComplete: boolean | null
  storedValue: string | null
}) {
  return previousIsComplete === false && currentIsComplete && storedValue !== "1"
}
