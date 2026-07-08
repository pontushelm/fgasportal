import { describe, expect, it } from "vitest"
import { shouldConfirmImportWorkspaceAction } from "@/components/dashboard/import-data-workspace"

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
})
