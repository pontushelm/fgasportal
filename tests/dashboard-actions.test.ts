import { describe, expect, it } from "vitest"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { filterDashboardActions } from "@/lib/actions/action-filters"
import {
  getCurrentYearRange,
  isDateInRange,
  summarizeCo2eCompleteness,
} from "@/lib/dashboard/compliance-metrics"

describe("dashboard action generation", () => {
  it("sorts urgent inspection and leakage actions before medium priority actions", () => {
    const actions = generateDashboardActions({
      today: new Date("2026-05-08T12:00:00"),
      installations: [
        {
          id: "due-soon",
          name: "Due soon aggregat",
          nextInspection: new Date("2026-05-20"),
          inspectionInterval: 12,
          complianceStatus: "DUE_SOON",
          assignedContractorId: "contractor-1",
          risk: { level: "LOW", score: 1 },
        },
        {
          id: "overdue",
          name: "Overdue aggregat",
          nextInspection: new Date("2026-04-01"),
          inspectionInterval: 12,
          complianceStatus: "OVERDUE",
          assignedContractorId: "contractor-1",
          risk: { level: "LOW", score: 1 },
        },
        {
          id: "missing-service",
          name: "Missing service aggregat",
          nextInspection: new Date("2026-07-01"),
          inspectionInterval: 12,
          complianceStatus: "OK",
          assignedContractorId: null,
          risk: { level: "LOW", score: 1 },
        },
      ],
      leakageEvents: [
        {
          id: "leak-1",
          installationId: "leaky",
          installationName: "Leaky aggregat",
          date: new Date("2026-05-05"),
        },
      ],
    })

    expect(actions.map((action) => action.type)).toEqual([
      "OVERDUE_INSPECTION",
      "RECENT_LEAKAGE",
      "DUE_SOON_INSPECTION",
      "NO_SERVICE_PARTNER",
    ])
    expect(actions.map((action) => action.sortPriority)).toEqual(
      [...actions.map((action) => action.sortPriority)].sort((first, second) => first - second)
    )
  })

  it("does not create recent leakage actions for old leakage events", () => {
    const actions = generateDashboardActions({
      today: new Date("2026-05-08T12:00:00"),
      installations: [],
      leakageEvents: [
        {
          id: "old-leak",
          installationId: "installation-1",
          installationName: "Old leak aggregat",
          date: new Date("2026-03-01"),
        },
      ],
    })

    expect(actions).toEqual([])
  })

  it("filters generated actions by operational category without changing order", () => {
    const actions = generateDashboardActions({
      today: new Date("2026-05-08T12:00:00"),
      installations: [
        {
          id: "overdue",
          name: "Overdue aggregat",
          nextInspection: new Date("2026-04-01"),
          inspectionInterval: 12,
          complianceStatus: "OVERDUE",
          assignedContractorId: null,
          risk: { level: "LOW", score: 1 },
        },
        {
          id: "risk",
          name: "Risk aggregat",
          nextInspection: null,
          inspectionInterval: null,
          complianceStatus: "OK",
          assignedContractorId: "contractor-1",
          risk: { level: "HIGH", score: 9 },
        },
      ],
      leakageEvents: [],
    })

    expect(filterDashboardActions(actions, "OVERDUE_INSPECTIONS").map((action) => action.type)).toEqual([
      "OVERDUE_INSPECTION",
    ])
    expect(filterDashboardActions(actions, "HIGH_RISK").map((action) => action.type)).toEqual([
      "HIGH_RISK",
    ])
  })
})

describe("dashboard compliance metrics", () => {
  it("identifies events in the current dashboard year", () => {
    const range = getCurrentYearRange(new Date("2026-05-08T12:00:00"))

    expect(isDateInRange(new Date("2026-01-01T00:00:00"), range)).toBe(true)
    expect(isDateInRange(new Date("2026-12-31T23:59:59"), range)).toBe(true)
    expect(isDateInRange(new Date("2025-12-31T23:59:59"), range)).toBe(false)
    expect(isDateInRange(new Date("2027-01-01T00:00:00"), range)).toBe(false)
  })

  it("marks total CO2e incomplete when any aggregat has unknown CO2e", () => {
    const summary = summarizeCo2eCompleteness([
      { co2eTon: 12.5 },
      { co2eTon: null },
      { co2eTon: 2 },
    ])

    expect(summary).toEqual({
      totalCo2eTon: 14.5,
      isComplete: false,
      unknownCo2eInstallations: 1,
    })
  })
})
