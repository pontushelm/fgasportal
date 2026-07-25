import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  IMPORT_GUIDE_VERSION,
  getImportGuide,
  getImportGuideOffer,
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
    expect(IMPORT_GUIDE_VERSION).toBe("v2")
    expect(
      getImportGuideSeenStorageKey({
        companyId: "company-a",
        guideVersion: "v1",
        importType: "properties",
        userId: "user-a",
      })
    ).not.toBe(key)
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

  it("defines a focused offer before each first-time guide", () => {
    expect(getImportGuideOffer("properties")).toMatchObject({
      title: "Vill du ha en genomgång?",
      description: expect.stringContaining("fastighetsregister"),
    })
    expect(getImportGuideOffer("installations").description).toContain(
      "aggregatregister"
    )
    expect(getImportGuideOffer("events").description).toContain(
      "historiska kontroller"
    )
  })

  it("defines a separate focused guide for each import type", () => {
    const guides = importTypes.map(getImportGuide)

    expect(guides.map((guide) => guide.id)).toEqual([
      "import-properties",
      "import-installations",
      "import-events",
    ])
    expect(guides.map((guide) => guide.steps.length)).toEqual([5, 5, 5])
    for (const guide of guides) {
      expect(guide.steps[0].title).toContain("Importera")
      expect(guide.steps[0].description).toContain("Excel")
      expect(guide.steps[1].title).toBe("Importmallen kan vara enklare")
      expect(guide.steps[2].title).toContain("Koppla")
      expect(guide.steps[4].title).toBe("Granska och genomför importen")
    }
  })

  it("uses stable targets for rendered import controls and mapping views", () => {
    expect(getImportGuide("properties").steps.map((step) => step.selector)).toEqual([
      '[data-import-guide="properties-upload"]',
      '[data-import-guide="properties-template"]',
      '[data-import-guide="properties-mapping"]',
      '[data-import-guide="properties-mapping"]',
      '[data-import-guide="properties-review"]',
    ])
    expect(getImportGuide("installations").steps.map((step) => step.selector)).toEqual([
      undefined,
      '[data-import-guide="installations-template"]',
      '[data-import-guide="installations-mapping"]',
      '[data-import-guide="installations-mapping"]',
      '[data-import-guide="installations-review"]',
    ])
    expect(getImportGuide("events").steps.map((step) => step.selector)).toEqual([
      undefined,
      '[data-import-guide="events-template"]',
      '[data-import-guide="events-mapping"]',
      '[data-import-guide="events-mapping"]',
      '[data-import-guide="events-review"]',
    ])
  })

  it("keeps upload targets available for the waiting state even before mapping", () => {
    const root = process.cwd()
    const controllerSource = readFileSync(
      join(root, "components/onboarding/import-guide-controller.tsx"),
      "utf8"
    )
    const propertiesImportSource = readFileSync(
      join(root, "components/dashboard/properties-import-page-client.tsx"),
      "utf8"
    )
    const installationsImportSource = readFileSync(
      join(root, "components/dashboard/installations-import-page-client.tsx"),
      "utf8"
    )
    const eventsImportSource = readFileSync(
      join(root, "components/dashboard/installation-event-import-page-client.tsx"),
      "utf8"
    )

    expect(controllerSource).toContain('"waiting-for-file"')
    expect(controllerSource).toContain("Ladda upp en Excel-fil")
    expect(controllerSource).toContain("isMappingReady")
    expect(propertiesImportSource).toContain('data-import-guide="properties-upload"')
    expect(installationsImportSource).toContain(
      'data-import-guide="installations-upload"'
    )
    expect(eventsImportSource).toContain('data-import-guide="events-upload"')
  })

  it("mounts mapping readiness from existing rendered mapping state", () => {
    const root = process.cwd()
    const sources = [
      "components/dashboard/properties-import-page-client.tsx",
      "components/dashboard/installations-import-page-client.tsx",
      "components/dashboard/installation-event-import-page-client.tsx",
    ].map((file) => readFileSync(join(root, file), "utf8"))

    for (const source of sources) {
      expect(source).toContain("isMappingReady={detectedColumns.length > 0}")
    }
    expect(sources[0]).toContain('data-import-guide="properties-mapping"')
    expect(sources[1]).toContain('data-import-guide="installations-mapping"')
    expect(sources[2]).toContain('data-import-guide="events-mapping"')
  })

  it("uses the offer first but reopens the guide directly from the manual link", () => {
    const source = readFileSync(
      join(process.cwd(), "components/onboarding/import-guide-controller.tsx"),
      "utf8"
    )

    expect(source).toContain('setPhase("offer")')
    expect(source).toContain("Visa genomgång")
    expect(source).toContain("Inte nu")
    expect(source).toContain("Visa importguiden")
    expect(source).toContain("onClick={() => startGuide(0)}")
    expect(source).toContain("markSeenAndClose")
    expect(source).toContain('event.key !== "Escape"')
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
