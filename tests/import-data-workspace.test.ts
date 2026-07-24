import { describe, expect, it } from "vitest"
import {
  getImportWorkspaceOptionLayoutSignature,
  shouldConfirmImportWorkspaceAction,
} from "@/components/dashboard/import-data-workspace"
import { getEventImportNavigationMode } from "@/components/dashboard/installations-import-page-client"

describe("import data workspace", () => {
  it("does not warn when closing after a successful import", () => {
    expect(
      shouldConfirmImportWorkspaceAction({
        hasProgress: true,
        isBusy: false,
        isCompleted: true,
      })
    ).toBe(false)
  })

  it("still warns when import preparation is unfinished", () => {
    expect(
      shouldConfirmImportWorkspaceAction({
        hasProgress: true,
        isBusy: false,
        isCompleted: false,
      })
    ).toBe(true)
  })

  it("uses one shared card layout signature for import type choices", () => {
    expect(getImportWorkspaceOptionLayoutSignature()).toContain("flex h-full flex-col")
    expect(getImportWorkspaceOptionLayoutSignature()).toContain("rounded-2xl")
  })

  it("keeps event import navigation inside the workspace when embedded", () => {
    expect(
      getEventImportNavigationMode({
        embedded: true,
        hasWorkspaceSwitcher: true,
      })
    ).toBe("workspace")
  })

  it("uses the standalone event import route outside the workspace", () => {
    expect(
      getEventImportNavigationMode({
        embedded: false,
        hasWorkspaceSwitcher: true,
      })
    ).toBe("route")
    expect(
      getEventImportNavigationMode({
        embedded: true,
        hasWorkspaceSwitcher: false,
      })
    ).toBe("route")
  })
})
