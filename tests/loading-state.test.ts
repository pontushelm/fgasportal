import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { getLoadingSpinnerClass } from "@/components/ui/loading-state"

describe("loading state helpers", () => {
  it("uses a spinner class that respects reduced motion", () => {
    const className = getLoadingSpinnerClass("h-6 w-6")

    expect(className).toContain("motion-safe:animate-spin")
    expect(className).toContain("motion-reduce:animate-none")
    expect(className).toContain("h-6 w-6")
  })

  it("exposes an accessible shared loading status", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ui/loading-state.tsx"),
      "utf8"
    )

    expect(source).toContain('role="status"')
    expect(source).toContain("motion-safe:animate-spin")
    expect(source).toContain("motion-reduce:animate-none")
  })
})
