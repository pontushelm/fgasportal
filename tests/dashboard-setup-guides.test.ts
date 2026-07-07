import { describe, expect, it } from "vitest"
import { getTourCardPosition } from "@/components/onboarding/guided-page-tour"
import type { DashboardSetupStep } from "@/lib/dashboard/setup-assistant"
import {
  SETUP_GUIDE_QUERY_PARAM,
  getDashboardSetupGuide,
  getSetupGuideHref,
  shouldUseSetupGuide,
} from "@/lib/dashboard/setup-guides"

describe("dashboard setup guides", () => {
  it("adds the setup guide query parameter to setup links", () => {
    const step = {
      id: "reports",
      route: "/dashboard/reports?year=2026",
    } as Pick<DashboardSetupStep, "id" | "route">

    expect(getSetupGuideHref(step)).toBe(
      `/dashboard/reports?year=2026&${SETUP_GUIDE_QUERY_PARAM}=reports`
    )
  })

  it("only enables guided setup for owner and admin setup steps", () => {
    expect(shouldUseSetupGuide("OWNER", "dashboard")).toBe(true)
    expect(shouldUseSetupGuide("ADMIN", "company")).toBe(true)
    expect(shouldUseSetupGuide("MEMBER", "dashboard")).toBe(false)
    expect(shouldUseSetupGuide("CONTRACTOR", "contractorDashboard")).toBe(false)
  })

  it("returns short guided introductions for owner and admin setup steps", () => {
    const guide = getDashboardSetupGuide("installations")

    expect(guide).toMatchObject({
      id: "installations",
      title: "Aggregatregistret",
    })
    expect(guide?.steps.length).toBeGreaterThanOrEqual(3)
  })

  it("ignores unknown guide identifiers", () => {
    expect(getDashboardSetupGuide("unknown")).toBeNull()
    expect(getDashboardSetupGuide(null)).toBeNull()
  })

  it("uses a safe centered position when no target element exists", () => {
    expect(getTourCardPosition(null)).toEqual({
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    })
  })
})
