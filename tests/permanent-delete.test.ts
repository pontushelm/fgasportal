import { describe, expect, it } from "vitest"
import { isValidPermanentDeleteConfirmation } from "@/lib/installations/permanent-delete"

describe("permanent installation deletion confirmation", () => {
  it("accepts the equipment ID as confirmation", () => {
    expect(
      isValidPermanentDeleteConfirmation("AGG-001", {
        name: "Kylaggregat 1",
        equipmentId: "AGG-001",
      })
    ).toBe(true)
  })

  it("accepts the aggregat name as fallback confirmation", () => {
    expect(
      isValidPermanentDeleteConfirmation("kylaggregat 1", {
        name: "Kylaggregat 1",
        equipmentId: null,
      })
    ).toBe(true)
  })

  it("rejects unrelated confirmation text", () => {
    expect(
      isValidPermanentDeleteConfirmation("delete", {
        name: "Kylaggregat 1",
        equipmentId: "AGG-001",
      })
    ).toBe(false)
  })
})
