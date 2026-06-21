import { describe, expect, it } from "vitest"
import {
  buildDashboardSetupProgress,
  buildDashboardSetupSteps,
  type DashboardSetupInput,
  type DashboardSetupStepId,
} from "@/lib/dashboard/setup-assistant"
import {
  addCompletedSetupStep,
  getSetupCompletedStepsStorageKey,
  parseCompletedSetupSteps,
  serializeCompletedSetupSteps,
} from "@/lib/dashboard/setup-progress-storage"

const readyTenant: DashboardSetupInput = {
  actionItemCount: 0,
  annualReportReadinessSatisfied: true,
  companyInfoCompleted: true,
  dataQualityIssueCount: 0,
  eventCount: 12,
  installationCount: 3,
  installationsMissingPropertyCount: 0,
  propertyCount: 2,
  servicePartnerConnected: true,
}

describe("dashboard setup assistant", () => {
  it("starts first-time onboarding at zero even when tenant data is ready", () => {
    const progress = buildDashboardSetupProgress(readyTenant)

    expect(progress.completedCount).toBe(0)
    expect(progress.totalCount).toBe(9)
    expect(progress.percent).toBe(0)
    expect(progress.nextStep?.id).toBe("company")
  })

  it("does not complete actions just because there are no actions", () => {
    const steps = buildDashboardSetupSteps(readyTenant)

    expect(steps.find((step) => step.id === "actions")).toMatchObject({
      completed: false,
      description: expect.stringContaining("inga åtgärder"),
    })
  })

  it("does not complete reports just because report data is ready", () => {
    const steps = buildDashboardSetupSteps(readyTenant)

    expect(steps.find((step) => step.id === "reports")).toMatchObject({
      completed: false,
      description: expect.stringContaining("redo"),
    })
  })

  it("completes only explicitly acknowledged steps", () => {
    const completedStepIds: DashboardSetupStepId[] = [
      "company",
      "properties",
      "actions",
    ]
    const progress = buildDashboardSetupProgress({
      ...readyTenant,
      completedStepIds,
    })

    expect(progress.completedCount).toBe(3)
    expect(progress.percent).toBe(33)
    expect(progress.nextStep?.id).toBe("installations")
    expect(progress.steps.find((step) => step.id === "actions")?.completed).toBe(
      true
    )
    expect(progress.steps.find((step) => step.id === "reports")?.completed).toBe(
      false
    )
  })

  it("keeps optional steps recommended but does not count them as complete", () => {
    const progress = buildDashboardSetupProgress({
      ...readyTenant,
      completedStepIds: [
        "company",
        "properties",
        "installations",
        "installationProperties",
      ],
    })
    const eventStep = progress.steps.find((step) => step.id === "events")

    expect(eventStep).toMatchObject({ completed: false, optional: true })
    expect(progress.completedCount).toBe(4)
    expect(progress.nextStep?.id).toBe("events")
  })

  it("persists completed steps in a company-scoped value", () => {
    const firstStep = addCompletedSetupStep([], "company")
    const nextSteps = addCompletedSetupStep(firstStep, "actions")
    const storedValue = serializeCompletedSetupSteps(nextSteps)

    expect(getSetupCompletedStepsStorageKey("company-a")).toBe(
      "helmpolar_setup_completed_steps:company-a"
    )
    expect(getSetupCompletedStepsStorageKey("company-b")).not.toBe(
      getSetupCompletedStepsStorageKey("company-a")
    )
    expect(parseCompletedSetupSteps(storedValue)).toEqual([
      "company",
      "actions",
    ])
  })

  it("ignores invalid or corrupt persisted step data", () => {
    expect(parseCompletedSetupSteps("not-json")).toEqual([])
    expect(
      parseCompletedSetupSteps(JSON.stringify(["company", "unknown", 42]))
    ).toEqual(["company"])
  })
})
