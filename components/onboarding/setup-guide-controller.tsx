"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { GuidedPageTour } from "@/components/onboarding/guided-page-tour"
import {
  API_CACHE_KEYS,
  useApiQuery,
} from "@/lib/client/api-cache"
import {
  SETUP_PROGRESS_UPDATED_EVENT,
  addCompletedSetupStep,
  getSetupCompletedStepsStorageKey,
  parseCompletedSetupSteps,
  serializeCompletedSetupSteps,
} from "@/lib/dashboard/setup-progress-storage"
import {
  getDashboardSetupGuide,
  SETUP_GUIDE_QUERY_PARAM,
} from "@/lib/dashboard/setup-guides"
import type { DashboardSetupRole } from "@/lib/dashboard/setup-assistant"

type CurrentUserResponse = {
  companyId: string
  role: DashboardSetupRole
}

export function SetupGuideController() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const requestedGuideId = searchParams.get(SETUP_GUIDE_QUERY_PARAM)
  const { data: currentUser } = useApiQuery<CurrentUserResponse>(
    requestedGuideId ? API_CACHE_KEYS.authMe : null
  )
  const guide = useMemo(
    () => getDashboardSetupGuide(requestedGuideId, currentUser?.role),
    [currentUser?.role, requestedGuideId]
  )

  if (!guide || !currentUser?.companyId) return null

  const activeGuide = guide
  const activeCompanyId = currentUser.companyId

  function clearGuideQuery() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(SETUP_GUIDE_QUERY_PARAM)
    const nextQuery = params.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }

  function finishGuide() {
    const storageKey = getSetupCompletedStepsStorageKey(activeCompanyId)
    const currentStepIds = parseCompletedSetupSteps(
      window.localStorage.getItem(storageKey)
    )
    const completedStepIds = addCompletedSetupStep(currentStepIds, activeGuide.id)
    window.localStorage.setItem(
      storageKey,
      serializeCompletedSetupSteps(completedStepIds)
    )
    window.dispatchEvent(
      new CustomEvent(SETUP_PROGRESS_UPDATED_EVENT, {
        detail: { companyId: activeCompanyId },
      })
    )
    clearGuideQuery()
  }

  return (
    <GuidedPageTour
      guide={activeGuide}
      onFinish={finishGuide}
      onSkip={clearGuideQuery}
    />
  )
}
