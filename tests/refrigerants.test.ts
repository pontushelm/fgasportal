import { describe, expect, it } from "vitest"
import {
  getRefrigerant,
  getRefrigerantGwp,
  normalizeRefrigerantCode,
} from "@/lib/refrigerants"

describe("refrigerant catalog", () => {
  it.each([
    ["R404A", "R404A"],
    ["R-404A", "R404A"],
    ["r404a", "R404A"],
    ["R 404 A", "R404A"],
    ["R404-A", "R404A"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeRefrigerantCode(input)).toBe(expected)
  })

  it.each([
    ["R404A", 3922],
    ["R410A", 2088],
    ["R407C", 1774],
    ["R134a", 1430],
    ["R32", 675],
    ["R449A", 1396],
    ["R744", 1],
  ])("returns GWP for %s", (code, expectedGwp) => {
    expect(getRefrigerantGwp(code)).toBe(expectedGwp)
  })

  it("keeps unknown refrigerants unknown", () => {
    expect(normalizeRefrigerantCode("R999X")).toBeNull()
    expect(getRefrigerant("R999X")).toBeNull()
    expect(getRefrigerantGwp("R999X")).toBeNull()
  })
})
