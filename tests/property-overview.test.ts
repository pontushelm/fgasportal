import { describe, expect, it } from "vitest"
import type { DashboardAction } from "@/lib/actions/generate-actions"
import {
  calculatePropertyLeakageClimateImpact,
  filterPropertyActions,
} from "@/lib/property-overview"

describe("property overview helpers", () => {
  it("calculates current-year leakage climate impact separately from installed CO2e", () => {
    const impact = calculatePropertyLeakageClimateImpact({
      refrigerantType: "R404A",
      year: 2026,
      events: [
        { date: "2026-02-01", refrigerantAddedKg: 2 },
        { date: "2025-02-01", refrigerantAddedKg: 10 },
      ],
    })

    expect(impact.leakageEventsCount).toBe(1)
    expect(impact.leakageAmountKg).toBe(2)
    expect(impact.leakageCo2eTon).toBeCloseTo(7.844)
    expect(impact.isLeakageCo2eIncomplete).toBe(false)
  })

  it("marks leakage climate impact as incomplete when amount or GWP is unknown", () => {
    const impact = calculatePropertyLeakageClimateImpact({
      refrigerantType: "UNKNOWN-GAS",
      year: 2026,
      events: [
        { date: "2026-02-01", refrigerantAddedKg: 2 },
        { date: "2026-03-01", refrigerantAddedKg: null },
      ],
    })

    expect(impact.leakageEventsCount).toBe(2)
    expect(impact.unknownLeakageCo2eCount).toBe(2)
    expect(impact.isLeakageCo2eIncomplete).toBe(true)
  })

  it("filters generated actions to installations that belong to a property", () => {
    const actions = [
      createAction("action-a", "installation-a"),
      createAction("action-b", "installation-b"),
    ]

    expect(filterPropertyActions(actions, ["installation-b"]).map((action) => action.id))
      .toEqual(["action-b"])
  })
})

function createAction(id: string, installationId: string): DashboardAction {
  return {
    id,
    type: "OVERDUE_INSPECTION",
    severity: "HIGH",
    priority: "HIGH",
    title: "Försenad kontroll",
    description: "Test",
    installationId,
    installationName: "Aggregat",
    equipmentId: null,
    propertyName: "Fastighet",
    href: `/dashboard/installations/${installationId}`,
    dueDate: null,
    createdAt: null,
    createdFrom: "inspection",
    source: "inspection",
    sortPriority: 101,
  }
}
