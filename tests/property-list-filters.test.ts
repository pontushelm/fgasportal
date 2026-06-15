import { describe, expect, it } from "vitest"
import {
  EMPTY_PROPERTY_LIST_FILTERS,
  buildPropertyFilterOptions,
  hasActivePropertyListFilters,
  matchesPropertyListFilters,
} from "@/lib/dashboard/property-list-filters"

const properties = [
  {
    address: "Storgatan 1",
    city: "Malmö",
    municipality: "Malmö",
    name: "Skolan",
    propertyDesignation: "Skolan 1:2",
  },
  {
    address: "Storgatan 1",
    city: "Lund",
    municipality: "Lund",
    name: "Biblioteket",
    propertyDesignation: "Boken 3",
  },
  {
    address: null,
    city: null,
    municipality: "Malmö",
    name: "Kontoret",
    propertyDesignation: null,
  },
]

describe("property list filters", () => {
  it("builds unique searchable options from existing property data", () => {
    expect(buildPropertyFilterOptions(properties)).toEqual({
      address: ["Storgatan 1"],
      city: ["Lund", "Malmö"],
      municipality: ["Lund", "Malmö"],
      name: ["Biblioteket", "Kontoret", "Skolan"],
      propertyDesignation: ["Boken 3", "Skolan 1:2"],
    })
  })

  it("matches typed partial filter values", () => {
    expect(
      matchesPropertyListFilters(properties[0], {
        ...EMPTY_PROPERTY_LIST_FILTERS,
        name: "sko",
      })
    ).toBe(true)
    expect(
      matchesPropertyListFilters(properties[1], {
        ...EMPTY_PROPERTY_LIST_FILTERS,
        name: "sko",
      })
    ).toBe(false)
  })

  it("combines multiple field filters", () => {
    expect(
      matchesPropertyListFilters(properties[0], {
        ...EMPTY_PROPERTY_LIST_FILTERS,
        address: "stor",
        municipality: "malmö",
      })
    ).toBe(true)
    expect(
      matchesPropertyListFilters(properties[1], {
        ...EMPTY_PROPERTY_LIST_FILTERS,
        address: "stor",
        municipality: "malmö",
      })
    ).toBe(false)
  })

  it("detects active filters", () => {
    expect(hasActivePropertyListFilters(EMPTY_PROPERTY_LIST_FILTERS)).toBe(false)
    expect(
      hasActivePropertyListFilters({
        ...EMPTY_PROPERTY_LIST_FILTERS,
        city: "Lund",
      })
    ).toBe(true)
  })
})
