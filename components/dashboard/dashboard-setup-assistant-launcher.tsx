"use client"

import {
  DashboardSetupAssistant,
  type DashboardSetupAssistantData,
} from "@/components/dashboard/dashboard-setup-assistant"
import { API_CACHE_KEYS, useApiQuery } from "@/lib/client/api-cache"

type DashboardSetupResponse = {
  setup: DashboardSetupAssistantData
}

export function DashboardSetupAssistantLauncher() {
  const { data } = useApiQuery<DashboardSetupResponse>(API_CACHE_KEYS.dashboard)

  if (!data?.setup) return null

  return <DashboardSetupAssistant defaultCollapsed setup={data.setup} />
}
