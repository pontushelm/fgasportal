import { describe, expect, it } from "vitest"
import { formatServicepartnerRoleLabel } from "@/lib/servicepartner-role-labels"

describe("servicepartner role labels", () => {
  it("labels servicepartner admins as serviceansvarig", () => {
    expect(
      formatServicepartnerRoleLabel({
        role: "CONTRACTOR",
        isServicePartnerAdmin: true,
      })
    ).toBe("Serviceansvarig")
  })

  it("labels normal contractors as tekniker", () => {
    expect(
      formatServicepartnerRoleLabel({
        role: "CONTRACTOR",
        isServicePartnerAdmin: false,
      })
    ).toBe("Tekniker")
  })

  it("does not replace internal role labels", () => {
    expect(formatServicepartnerRoleLabel({ role: "ADMIN" })).toBeNull()
  })
})
