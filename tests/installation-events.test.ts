import { describe, expect, it } from "vitest"
import {
  getInstallationEventAmountLabel,
  hasInstallationEventAmount,
} from "@/lib/installation-events"
import { createInstallationEventSchema } from "@/lib/validations"

describe("installation event labels", () => {
  it("uses event-specific amount labels", () => {
    expect(getInstallationEventAmountLabel("REFILL", { includeUnit: true })).toBe(
      "Påfylld mängd (kg)"
    )
    expect(getInstallationEventAmountLabel("LEAK", { includeUnit: true })).toBe(
      "Läckagemängd (kg)"
    )
    expect(
      getInstallationEventAmountLabel("REFRIGERANT_CHANGE", { includeUnit: true })
    ).toBe("Ny fyllnadsmängd (kg)")
    expect(getInstallationEventAmountLabel("RECOVERY", { includeUnit: true })).toBe(
      "Omhändertagen mängd (kg)"
    )
  })

  it("does not show amount fields for simple event types", () => {
    expect(hasInstallationEventAmount("SERVICE")).toBe(false)
    expect(hasInstallationEventAmount("REPAIR")).toBe(false)
    expect(hasInstallationEventAmount("INSPECTION")).toBe(false)
  })
})

describe("installation event validation", () => {
  it("blocks refrigerant replacement without a new refrigerant", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "REFRIGERANT_CHANGE",
      refrigerantAddedKg: "10",
      notes: "Byte registrerat",
    })

    expect(result.success).toBe(false)
  })

  it("blocks refrigerant replacement without a new fill amount", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "REFRIGERANT_CHANGE",
      newRefrigerantType: "R449A",
      notes: "Byte registrerat",
    })

    expect(result.success).toBe(false)
  })

  it("accepts comma decimals for structured recovery amounts", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "RECOVERY",
      refrigerantAddedKg: "4,5",
      notes: "Tömning utförd",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.refrigerantAddedKg).toBe(4.5)
  })

  it("requires refill amount for refill events", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "REFILL",
      notes: "Påfyllning utförd",
    })

    expect(result.success).toBe(false)
  })

  it("allows leakage amount without requiring notes", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "LEAK",
      refrigerantAddedKg: "1.5",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.refrigerantAddedKg).toBe(1.5)
  })

  it("accepts recovery amount in the dedicated recovered amount field", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "RECOVERY",
      recoveredRefrigerantKg: "12,25",
      notes: "Tömning inför service",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.recoveredRefrigerantKg).toBe(12.25)
  })

  it("accepts correction metadata without changing event validation", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "LEAK",
      refrigerantAddedKg: "1.5",
      correctingEventId: "event_123",
      supersededReason: "Fel mängd registrerad",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.correctingEventId).toBe("event_123")
    expect(result.data.supersededReason).toBe("Fel mängd registrerad")
  })
})
