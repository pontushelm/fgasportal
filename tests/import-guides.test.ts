import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  IMPORT_GUIDE_VERSION,
  getImportGuide,
  getImportGuideSeenStorageKey,
  shouldShowImportGuide,
  type ImportGuideType,
} from "@/lib/dashboard/import-guides"

const importTypes: ImportGuideType[] = ["properties", "installations", "events"]

describe("import guides", () => {
  it("stores seen state per company, user, import type, and version", () => {
    const key = getImportGuideSeenStorageKey({
      companyId: "company-a",
      importType: "properties",
      userId: "user-a",
    })

    expect(key).toBe(
      `helmpolar_import_guide_seen:company-a:user-a:properties:${IMPORT_GUIDE_VERSION}`
    )
    expect(
      getImportGuideSeenStorageKey({
        companyId: "company-a",
        importType: "installations",
        userId: "user-a",
      })
    ).not.toBe(key)
    expect(
      getImportGuideSeenStorageKey({
        companyId: "company-b",
        importType: "properties",
        userId: "user-a",
      })
    ).not.toBe(key)
    expect(
      getImportGuideSeenStorageKey({
        companyId: "company-a",
        importType: "properties",
        userId: "user-b",
      })
    ).not.toBe(key)
  })

  it("shows unseen guides automatically and allows manual reopening", () => {
    expect(shouldShowImportGuide({ storedValue: null })).toBe(true)
    expect(shouldShowImportGuide({ storedValue: "1" })).toBe(false)
    expect(
      shouldShowImportGuide({ isManualOpen: true, storedValue: "1" })
    ).toBe(true)
  })

  it("defines a separate focused guide for each import type", () => {
    const guides = importTypes.map(getImportGuide)

    expect(guides.map((guide) => guide.id)).toEqual([
      "import-properties",
      "import-installations",
      "import-events",
    ])
    expect(guides.map((guide) => guide.steps.length)).toEqual([4, 4, 4])
  })

  it("uses stable targets for rendered import controls only", () => {
    expect(getImportGuide("properties").steps.map((step) => step.selector)).toEqual([
      '[data-import-guide="properties-template"]',
      '[data-import-guide="properties-upload"]',
      undefined,
      undefined,
    ])
    expect(getImportGuide("installations").steps.map((step) => step.selector)).toEqual([
      undefined,
      '[data-import-guide="installations-template"]',
      '[data-import-guide="installations-upload"]',
      '[data-import-guide="installations-events-link"]',
    ])
    expect(getImportGuide("events").steps.map((step) => step.selector)).toEqual([
      undefined,
      '[data-import-guide="events-template"]',
      '[data-import-guide="events-upload"]',
      undefined,
    ])
  })

  it("does not expose the old skip action in onboarding copy", () => {
    const root = process.cwd()
    const setupAssistantSource = readFileSync(
      join(root, "components/dashboard/dashboard-setup-assistant.tsx"),
      "utf8"
    )
    const guidedTourSource = readFileSync(
      join(root, "components/onboarding/guided-page-tour.tsx"),
      "utf8"
    )
    const importGuideControllerSource = readFileSync(
      join(root, "components/onboarding/import-guide-controller.tsx"),
      "utf8"
    )

    expect(setupAssistantSource).not.toContain("Hoppa över för nu")
    expect(guidedTourSource).not.toContain("Hoppa över för nu")
    expect(guidedTourSource).toContain("Stäng guide")
    expect(guidedTourSource).toContain("Nästa")
    expect(guidedTourSource).toContain("Föregående")
    expect(guidedTourSource).toContain("Avsluta guide")
    expect(importGuideControllerSource).toContain('finishLabel="Klar"')
  })
})
