import { describe, expect, it } from "vitest"
import {
  ACTION_LIST_PAGE_SIZE,
  getInitialVisibleActionCount,
  getVisibleActionCount,
} from "@/lib/actions/action-list-display"

describe("action list display", () => {
  it("shows at most 50 actions initially", () => {
    expect(getInitialVisibleActionCount(12)).toBe(12)
    expect(getInitialVisibleActionCount(80)).toBe(ACTION_LIST_PAGE_SIZE)
  })

  it("increments visible actions without exceeding total count", () => {
    expect(getVisibleActionCount({ totalCount: 120, visibleCount: 50 })).toBe(100)
    expect(getVisibleActionCount({ totalCount: 120, visibleCount: 100 })).toBe(120)
  })
})
