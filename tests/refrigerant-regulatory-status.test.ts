import { describe, expect, it } from "vitest"
import { generateDashboardActions } from "@/lib/actions/generate-actions"
import { getRefrigerantRegulatoryStatus } from "@/lib/refrigerant-regulatory-status"

describe("refrigerant regulatory status", () => {
  it("marks very high GWP refrigerants as likely restriction follow-up", () => {
    const status = getRefrigerantRegulatoryStatus({
      refrigerantType: "R404A",
      refrigerantAmountKg: 10,
    })

    expect(status.status).toBe("RESTRICTED")
    expect(status.label).toContain("begränsningar")
  })

  it("marks common high GWP refrigerants as phase-out planning risk", () => {
    const status = getRefrigerantRegulatoryStatus({
      refrigerantType: "R410A",
      refrigerantAmountKg: 5,
    })

    expect(status.status).toBe("PHASE_OUT_RISK")
    expect(status.label).toContain("utfasning")
  })

  it("keeps lower GWP refrigerants as OK with cautious wording", () => {
    const status = getRefrigerantRegulatoryStatus({
      refrigerantType: "R32",
      refrigerantAmountKg: 5,
    })

    expect(status.status).toBe("OK")
    expect(status.description).toContain("Kontrollera alltid")
  })

  it("marks unknown refrigerants as unknown instead of safe", () => {
    const status = getRefrigerantRegulatoryStatus({
      refrigerantType: "R999X",
      refrigerantAmountKg: 5,
    })

    expect(status.status).toBe("UNKNOWN")
    expect(status.description).toContain("saknar känt GWP")
  })

  it("generates low-priority operational actions for follow-up refrigerants", () => {
    const actions = generateDashboardActions({
      leakageEvents: [],
      installations: [
        {
          id: "installation-1",
          name: "Kylrum 1",
          equipmentId: "KR1",
          propertyId: "property-1",
          propertyName: "Skolan",
          nextInspection: null,
          inspectionInterval: null,
          complianceStatus: "NOT_REQUIRED",
          assignedContractorId: "contractor-1",
          refrigerantType: "R404A",
          refrigerantAmount: 10,
          risk: { level: "LOW", score: 1 },
        },
      ],
    })

    expect(actions).toMatchObject([
      {
        type: "REFRIGERANT_REVIEW",
        severity: "LOW",
        createdFrom: "refrigerant",
      },
    ])
  })
})
