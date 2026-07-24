import { describe, expect, it } from "vitest"
import { getLoadingSpinnerClass } from "@/components/ui/loading-state"

describe("loading state helpers", () => {
  it("uses a spinner class that respects reduced motion", () => {
    const className = getLoadingSpinnerClass("h-6 w-6")

    expect(className).toContain("motion-safe:animate-spin")
    expect(className).toContain("motion-reduce:animate-none")
    expect(className).toContain("h-6 w-6")
  })
})
