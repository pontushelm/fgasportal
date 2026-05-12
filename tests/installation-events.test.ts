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

  it("allows leakage amount while keeping leakage notes required", () => {
    const result = createInstallationEventSchema.safeParse({
      date: "2026-05-08",
      type: "LEAK",
      refrigerantAddedKg: "1.5",
      notes: "Läckage upptäckt vid kontroll",
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.refrigerantAddedKg).toBe(1.5)
  })
})
