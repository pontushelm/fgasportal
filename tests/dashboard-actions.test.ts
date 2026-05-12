import { describe, expect, it } from "vitest"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import {
  filterActionWorkQueue,
  filterDashboardActions,
  getActionStableKey,
  getActionSummaryCounts,
  sanitizeActionFilterQueryParams,
  validateActionFilterQueryParams,
} from "@/lib/actions/action-filters"
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

  it("keeps deterministic action keys for future workflow state overlays", () => {
    const actions = generateDashboardActions({
      today: new Date("2026-05-08T12:00:00"),
      installations: [
        {
          id: "installation-1",
          name: "Aggregat 1",
          nextInspection: new Date("2026-04-01"),
          inspectionInterval: 12,
          complianceStatus: "OVERDUE",
          assignedContractorId: null,
          risk: { level: "LOW", score: 1 },
        },
      ],
      leakageEvents: [
        {
          id: "leak-1",
          installationId: "installation-1",
          installationName: "Aggregat 1",
          date: new Date("2026-05-05"),
        },
      ],
    })

    expect(actions.map(getActionStableKey)).toEqual([
      "OVERDUE_INSPECTION:installation-1:overdue-installation-1",
      "RECENT_LEAKAGE:installation-1:recent-leakage-leak-1",
      "NO_SERVICE_PARTNER:installation-1:no-service-partner-installation-1",
    ])
  })

  it("filters the operational action queue by metadata without changing server order", () => {
    const actions = generateDashboardActions({
      today: new Date("2026-05-08T12:00:00"),
      installations: [
        {
          id: "overdue",
          name: "Kylcentral A",
          equipmentId: "KA-1",
          propertyId: "property-1",
          propertyName: "Stadshuset",
          nextInspection: new Date("2026-04-01"),
          inspectionInterval: 12,
          complianceStatus: "OVERDUE",
          assignedContractorId: "contractor-1",
          assignedServiceContactId: "contractor-1",
          assignedServiceContactName: "Service Tekniker",
          servicePartnerCompanyId: "service-company-1",
          servicePartnerCompanyName: "Servicebolaget",
          risk: { level: "LOW", score: 1 },
        },
        {
          id: "due-soon",
          name: "Värmepump B",
          equipmentId: "VP-2",
          propertyName: "Skolan",
          nextInspection: new Date("2026-05-20"),
          inspectionInterval: 12,
          complianceStatus: "DUE_SOON",
          assignedContractorId: null,
          risk: { level: "LOW", score: 1 },
        },
      ],
      leakageEvents: [],
    })

    expect(
      filterActionWorkQueue(actions, {
        propertyId: "property-1",
        severity: "HIGH",
        serviceContactId: "contractor-1",
        servicePartnerCompanyId: "service-company-1",
        search: "ka-1",
        today: new Date("2026-05-08T12:00:00"),
      }).map((action) => action.id)
    ).toEqual(["overdue-overdue"])
    expect(
      filterActionWorkQueue(actions, {
        dueDate: "NEXT_30_DAYS",
        today: new Date("2026-05-08T12:00:00"),
      }).map((action) => action.id)
    ).toEqual(["due-soon-due-soon"])
  })

  it("summarizes operational action counts", () => {
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
          id: "due-soon",
          name: "Due soon aggregat",
          nextInspection: new Date("2026-05-20"),
          inspectionInterval: 12,
          complianceStatus: "DUE_SOON",
          assignedContractorId: "contractor-1",
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

    expect(getActionSummaryCounts(actions, new Date("2026-05-08T12:00:00"))).toEqual({
      total: 4,
      highSeverity: 2,
      overdue: 1,
      dueSoon: 1,
      leakageFollowUp: 1,
      missingServiceContact: 1,
    })
  })

  it("sanitizes and validates saved action view query params", () => {
    const queryParams = sanitizeActionFilterQueryParams({
      filter: "LEAKAGE",
      severity: "HIGH",
      property: "property-1",
      serviceContact: "contractor-1",
      servicePartnerCompany: "service-company-1",
      due: "NEXT_30_DAYS",
      q: "  kylrum  ",
      unexpected: "ignored",
      empty: "",
    })

    expect(queryParams).toEqual({
      filter: "LEAKAGE",
      severity: "HIGH",
      property: "property-1",
      serviceContact: "contractor-1",
      servicePartnerCompany: "service-company-1",
      due: "NEXT_30_DAYS",
      q: "kylrum",
    })
    expect(validateActionFilterQueryParams(queryParams)).toEqual(queryParams)
    expect(validateActionFilterQueryParams({ filter: "NOT_A_FILTER" })).toBeNull()
    expect(validateActionFilterQueryParams({ unexpected: "value" })).toBeNull()
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
