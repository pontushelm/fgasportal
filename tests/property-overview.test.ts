import { describe, expect, it } from "vitest"
import type { DashboardAction } from "@/lib/actions/generate-actions"
import {
  buildPropertyHistoricalMetrics,
  buildPropertyReportOverview,
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

  it("builds property report overview with unknown CO2e marked as incomplete", () => {
    const overview = buildPropertyReportOverview({
      year: 2026,
      propertyHasMunicipality: true,
      propertyHasDesignation: true,
      installations: [
        {
          refrigerantType: "R404A",
          refrigerantAmount: 10,
          hasLeakDetectionSystem: false,
          lastInspection: new Date("2026-01-10"),
          nextInspection: new Date("2026-07-10"),
          inspections: [{ inspectionDate: new Date("2026-01-10") }],
          events: [
            {
              date: new Date("2026-02-01"),
              type: "LEAK",
              refrigerantAddedKg: 1,
            },
            {
              date: new Date("2026-03-01"),
              type: "RECOVERY",
              refrigerantAddedKg: null,
              recoveredAmountKg: 2,
            },
          ],
        },
        {
          refrigerantType: "UNKNOWN-GAS",
          refrigerantAmount: 5,
          hasLeakDetectionSystem: false,
          lastInspection: null,
          nextInspection: null,
          inspections: [],
          events: [],
        },
      ],
    })

    expect(overview.controlRequiredInstallations).toBe(1)
    expect(overview.completeReportDataInstallations).toBe(1)
    expect(overview.installationsWithReportWarnings).toBe(1)
    expect(overview.leakageEventsThisYear).toBe(1)
    expect(overview.recoveredAmountKgThisYear).toBe(2)
    expect(overview.totalCo2eTon).toBeNull()
    expect(overview.unknownCo2eInstallations).toBe(1)
  })

  it("builds compact historical metrics per year", () => {
    const metrics = buildPropertyHistoricalMetrics([
      {
        refrigerantType: "R404A",
        refrigerantAmount: 10,
        hasLeakDetectionSystem: false,
        lastInspection: null,
        nextInspection: null,
        inspections: [
          { inspectionDate: new Date("2026-01-10") },
          { inspectionDate: new Date("2025-01-10") },
        ],
        events: [
          {
            date: new Date("2026-02-01"),
            type: "LEAK",
            refrigerantAddedKg: 1.5,
          },
          {
            date: new Date("2026-03-01"),
            type: "REFRIGERANT_CHANGE",
            refrigerantAddedKg: 8,
            recoveredAmountKg: 2.5,
          },
          {
            date: new Date("2025-03-01"),
            type: "RECOVERY",
            refrigerantAddedKg: 4,
          },
        ],
      },
    ])

    expect(metrics).toEqual([
      {
        year: 2026,
        leakageEventsCount: 1,
        leakedAmountKg: 1.5,
        recoveredAmountKg: 2.5,
        controlsPerformed: 1,
      },
      {
        year: 2025,
        leakageEventsCount: 0,
        leakedAmountKg: 0,
        recoveredAmountKg: 4,
        controlsPerformed: 1,
      },
    ])
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
    propertyId: null,
    propertyName: "Fastighet",
    assignedServiceContactId: null,
    assignedServiceContactName: null,
    assignedServiceContactEmail: null,
    servicePartnerCompanyId: null,
    servicePartnerCompanyName: null,
    href: `/dashboard/installations/${installationId}`,
    dueDate: null,
    createdAt: null,
    createdFrom: "inspection",
    source: "inspection",
    sortPriority: 101,
  }
}
