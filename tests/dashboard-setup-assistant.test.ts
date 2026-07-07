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
    expect(progress.nextStep?.id).toBe("dashboard")
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
      "dashboard",
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
        "dashboard",
        "company",
        "properties",
        "installations",
        "dataQuality",
        "colleagues",
        "reports",
        "actions",
      ],
    })
    const servicePartnerStep = progress.steps.find(
      (step) => step.id === "servicePartner"
    )

    expect(servicePartnerStep).toMatchObject({ completed: false, optional: true })
    expect(progress.completedCount).toBe(8)
    expect(progress.nextStep?.id).toBe("servicePartner")
  })

  it("uses the admin setup steps for owners and admins", () => {
    const ownerSteps = buildDashboardSetupSteps({ ...readyTenant, role: "OWNER" })
    const adminSteps = buildDashboardSetupSteps({ ...readyTenant, role: "ADMIN" })

    expect(ownerSteps.map((step) => step.id)).toEqual([
      "dashboard",
      "properties",
      "installations",
      "reports",
      "dataQuality",
      "actions",
      "servicePartner",
      "colleagues",
      "company",
    ])
    expect(adminSteps.map((step) => step.id)).toEqual(
      ownerSteps.map((step) => step.id)
    )
  })

  it("uses member-oriented setup steps", () => {
    const progress = buildDashboardSetupProgress({
      ...readyTenant,
      completedStepIds: ["dashboard", "installations"],
      role: "MEMBER",
    })

    expect(progress.totalCount).toBe(6)
    expect(progress.completedCount).toBe(2)
    expect(progress.percent).toBe(33)
    expect(progress.steps.map((step) => step.id)).toEqual([
      "dashboard",
      "installations",
      "actions",
      "reports",
      "documentsEvents",
      "personalOverview",
    ])
  })

  it("uses contractor-oriented setup steps", () => {
    const progress = buildDashboardSetupProgress({
      ...readyTenant,
      completedStepIds: ["contractorDashboard", "assignedInstallations"],
      role: "CONTRACTOR",
    })

    expect(progress.totalCount).toBe(6)
    expect(progress.completedCount).toBe(2)
    expect(progress.percent).toBe(33)
    expect(progress.steps.map((step) => step.id)).toEqual([
      "contractorDashboard",
      "assignedInstallations",
      "registerServiceEvent",
      "certificateStatus",
      "actions",
      "servicePartnerSetup",
    ])
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

  it("is complete only when all role-specific setup steps are completed", () => {
    const progress = buildDashboardSetupProgress({
      ...readyTenant,
      completedStepIds: [
        "dashboard",
        "properties",
        "installations",
        "reports",
        "dataQuality",
        "actions",
        "servicePartner",
        "colleagues",
        "company",
      ],
      role: "OWNER",
    })

    expect(progress.isComplete).toBe(true)
    expect(progress.completedCount).toBe(progress.totalCount)
    expect(progress.nextStep).toBeNull()
  })
})
