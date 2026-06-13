import { describe, expect, it } from "vitest"
import {
  buildDashboardSetupProgress,
  buildDashboardSetupSteps,
} from "@/lib/dashboard/setup-assistant"

describe("dashboard setup assistant", () => {
  it("starts with company information as the next step for an empty account", () => {
    const progress = buildDashboardSetupProgress({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: false,
      dataQualityIssueCount: 0,
      eventCount: 0,
      installationCount: 0,
      installationsMissingPropertyCount: 0,
      propertyCount: 0,
      servicePartnerConnected: false,
    })

    expect(progress.completedCount).toBe(1)
    expect(progress.totalCount).toBe(9)
    expect(progress.nextStep?.id).toBe("company")
  })

  it("selects the recommended import sequence before reports", () => {
    const noProperties = buildDashboardSetupProgress({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 0,
      installationCount: 0,
      installationsMissingPropertyCount: 0,
      propertyCount: 0,
      servicePartnerConnected: false,
    })
    expect(noProperties.nextStep).toMatchObject({
      id: "properties",
      route: "/dashboard/properties/import",
    })

    const noInstallations = buildDashboardSetupProgress({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 0,
      installationCount: 0,
      installationsMissingPropertyCount: 0,
      propertyCount: 2,
      servicePartnerConnected: false,
    })
    expect(noInstallations.nextStep).toMatchObject({
      id: "installations",
      route: "/dashboard/installations/import",
    })

    const noEvents = buildDashboardSetupProgress({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 0,
      installationCount: 3,
      installationsMissingPropertyCount: 0,
      propertyCount: 2,
      servicePartnerConnected: false,
    })
    expect(noEvents.nextStep).toMatchObject({
      id: "events",
      route: "/dashboard/installations/import-events",
    })
  })

  it("prioritizes data quality before reports when issues exist", () => {
    const progress = buildDashboardSetupProgress({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 4,
      eventCount: 2,
      installationCount: 3,
      installationsMissingPropertyCount: 0,
      propertyCount: 2,
      servicePartnerConnected: true,
    })

    expect(progress.nextStep).toMatchObject({
      id: "dataQuality",
      route: "/dashboard/data-quality",
    })
  })

  it("treats servicepartner as complete when skipped", () => {
    const steps = buildDashboardSetupSteps({
      actionItemCount: 0,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
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

  it("completes actions automatically when there are no actions", () => {
    const steps = buildDashboardSetupSteps({
      actionItemCount: 0,
      actionsReviewed: false,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })

    expect(steps.find((step) => step.id === "actions")).toMatchObject({
      completed: true,
    })
  })

  it("requires opening Actions when actionable items exist", () => {
    const unread = buildDashboardSetupSteps({
      actionItemCount: 2,
      actionsReviewed: false,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })
    expect(unread.find((step) => step.id === "actions")?.completed).toBe(false)

    const reviewed = buildDashboardSetupSteps({
      actionItemCount: 2,
      actionsReviewed: true,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })
    expect(reviewed.find((step) => step.id === "actions")?.completed).toBe(true)
  })

  it("requires actual preview or readiness plus report page visit before report completion", () => {
    const notVisited = buildDashboardSetupSteps({
      actionItemCount: 0,
      annualReportPageVisited: false,
      annualReportPreviewReviewed: false,
      annualReportReadinessSatisfied: true,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })
    expect(notVisited.find((step) => step.id === "reports")?.completed).toBe(false)

    const visitedAndReady = buildDashboardSetupSteps({
      actionItemCount: 0,
      annualReportPageVisited: true,
      annualReportPreviewReviewed: false,
      annualReportReadinessSatisfied: true,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })
    expect(visitedAndReady.find((step) => step.id === "reports")?.completed).toBe(true)

    const previewed = buildDashboardSetupSteps({
      actionItemCount: 0,
      annualReportPageVisited: false,
      annualReportPreviewReviewed: true,
      annualReportReadinessSatisfied: false,
      companyInfoCompleted: true,
      dataQualityIssueCount: 0,
      eventCount: 1,
      installationCount: 1,
      installationsMissingPropertyCount: 0,
      propertyCount: 1,
      servicePartnerConnected: true,
    })
    expect(previewed.find((step) => step.id === "reports")?.completed).toBe(true)
  })
})
