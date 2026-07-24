import { describe, expect, it } from "vitest"
import {
  getTourCardPosition,
  getTourTargetScrollBehavior,
  shouldScrollTourTarget,
} from "@/components/onboarding/guided-page-tour"
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

  it("enables guided setup for role-specific setup steps", () => {
    expect(shouldUseSetupGuide("OWNER", "dashboard")).toBe(true)
    expect(shouldUseSetupGuide("ADMIN", "company")).toBe(true)
    expect(shouldUseSetupGuide("MEMBER", "dashboard")).toBe(true)
    expect(shouldUseSetupGuide("MEMBER", "personalOverview")).toBe(true)
    expect(shouldUseSetupGuide("CONTRACTOR", "contractorDashboard")).toBe(true)
    expect(shouldUseSetupGuide("CONTRACTOR", "servicePartnerSetup")).toBe(true)
    expect(shouldUseSetupGuide("MEMBER", "servicePartnerSetup")).toBe(false)
  })

  it("returns short guided introductions for owner and admin setup steps", () => {
    const guide = getDashboardSetupGuide("installations", "OWNER")

    expect(guide).toMatchObject({
      id: "installations",
      title: "Aggregatregistret",
    })
    expect(guide?.steps.length).toBeGreaterThanOrEqual(3)
  })

  it("uses user-facing role labels in the colleagues guide", () => {
    const guide = getDashboardSetupGuide("colleagues", "ADMIN")
    const roleStep = guide?.steps.find((step) =>
      step.title.includes("roller")
    )

    expect(roleStep?.description).toContain("Ägare och ansvariga")
    expect(roleStep?.description).not.toContain("OWNER")
    expect(roleStep?.description).not.toContain("ADMIN")
    expect(guide?.steps[0].selector).toBe('[data-tour="invite-users-section"]')
  })

  it("uses the refined property onboarding import copy", () => {
    const guide = getDashboardSetupGuide("properties", "OWNER")

    expect(guide?.steps[2].description).toBe(
      "Du kan börja med att importera era fastigheter om ni har data i Excel, och komplettera manuellt senare."
    )
  })

  it("uses servicepartner onboarding copy that explains direct technician registration", () => {
    const guide = getDashboardSetupGuide("servicePartner", "OWNER")

    expect(guide?.steps[0].description).toBe(
      "Ni kan koppla eller bjuda in servicepartners och kyltekniker till aggregat så att kontroller och händelser registreras på rätt plats direkt av dem, istället för att själva behöva lägga till händelserna."
    )
  })

  it("returns member-specific guided introductions", () => {
    expect(getDashboardSetupGuide("dashboard", "MEMBER")).toMatchObject({
      id: "dashboard",
      description: expect.stringContaining("register"),
    })
    expect(getDashboardSetupGuide("documentsEvents", "MEMBER")).toMatchObject({
      id: "documentsEvents",
      title: "Dokument och händelser",
    })
  })

  it("returns contractor-specific guided introductions", () => {
    expect(getDashboardSetupGuide("contractorDashboard", "CONTRACTOR")).toMatchObject({
      id: "contractorDashboard",
      title: "Servicepartnerdashboarden",
    })
    expect(getDashboardSetupGuide("actions", "CONTRACTOR")).toMatchObject({
      id: "actions",
      title: "Öppna uppdrag",
    })
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

  it("scrolls a guided tour target once for each active selector", () => {
    const scrollKey = 'colleagues:0:[data-tour="invite-users-section"]'

    expect(
      shouldScrollTourTarget({
        scrolledTargetKey: "",
        scrollKey,
        selector: '[data-tour="invite-users-section"]',
      })
    ).toBe(true)
    expect(
      shouldScrollTourTarget({
        scrolledTargetKey: scrollKey,
        scrollKey,
        selector: '[data-tour="invite-users-section"]',
      })
    ).toBe(false)
    expect(
      shouldScrollTourTarget({
        scrolledTargetKey: "",
        scrollKey,
        selector: undefined,
      })
    ).toBe(false)
  })

  it("respects reduced motion when choosing guided tour scroll behavior", () => {
    expect(getTourTargetScrollBehavior(true)).toBe("auto")
    expect(getTourTargetScrollBehavior(false)).toBe("smooth")
  })
})
