import { describe, expect, it } from "vitest"
import { filterSearchableSelectOptions } from "@/components/ui/searchable-select"

describe("searchable select", () => {
  const options = [
    {
      label: "Stadshuset - Stadshuset 1, Malmö",
      searchText: "Storgatan 1 Malmö",
      value: "property-1",
    },
    {
      label: "Servicehuset - Service 2, Lund",
      searchText: "Servicestigen 4 Lund",
      value: "property-2",
    },
    {
      label: "Skolan",
      searchText: "Skolan 3 Kristianstad",
      value: "property-3",
    },
  ]

  it("filters options by label", () => {
    expect(filterSearchableSelectOptions(options, "service")).toEqual([
      options[1],
    ])
  })

  it("filters options by extra search text", () => {
    expect(filterSearchableSelectOptions(options, "storgatan")).toEqual([
      options[0],
    ])
  })

  it("limits visible options", () => {
    expect(filterSearchableSelectOptions(options, "", 2)).toEqual([
      options[0],
      options[1],
    ])
  })
})
