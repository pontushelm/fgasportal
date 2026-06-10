import { describe, expect, it } from "vitest"
import {
  buildDashboardSetupProgress,
  buildDashboardSetupSteps,
} from "@/lib/dashboard/setup-assistant"

describe("dashboard setup assistant", () => {
  it("starts with company information as the next step for an empty account", () => {
    const progress = buildDashboardSetupProgress({
      companyInfoCompleted: false,
      installationCount: 0,
      installationsMissingPropertyCount: 0,
      propertyCount: 0,
      servicePartnerConnected: false,
    })

    expect(progress.completedCount).toBe(0)
    expect(progress.totalCount).toBe(7)
    expect(progress.percent).toBe(0)
    expect(progress.nextStep?.id).toBe("company")
  })

  it("calculates progress and selects the first incomplete step", () => {
    const progress = buildDashboardSetupProgress({
      companyInfoCompleted: true,
      installationCount: 2,
      installationsMissingPropertyCount: 1,
      propertyCount: 1,
      servicePartnerConnected: false,
    })

    expect(progress.completedCount).toBe(3)
    expect(progress.percent).toBe(43)
    expect(progress.nextStep?.id).toBe("installationProperties")
  })

  it("treats servicepartner as complete when skipped", () => {
    const steps = buildDashboardSetupSteps({
      companyInfoCompleted: true,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: false,
      servicePartnerSkipped: true,
    })

    expect(steps.find((step) => step.id === "servicePartner")).toMatchObject({
      completed: true,
      optional: true,
    })
  })

  it("requires actions and annual report preview review before completion", () => {
    const almostComplete = buildDashboardSetupProgress({
      companyInfoCompleted: true,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
      actionsReviewed: false,
      annualReportPreviewReviewed: false,
    })

    expect(almostComplete.isComplete).toBe(false)
    expect(almostComplete.nextStep?.id).toBe("actions")

    const complete = buildDashboardSetupProgress({
      companyInfoCompleted: true,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
      actionsReviewed: true,
      annualReportPreviewReviewed: true,
    })

    expect(complete.isComplete).toBe(true)
    expect(complete.nextStep).toBeNull()
    expect(complete.completedCount).toBe(7)
  })
})
