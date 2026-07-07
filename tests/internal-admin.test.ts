import { afterEach, describe, expect, it } from "vitest"
import {
  getInternalAdminEmails,
  isInternalAdminEmail,
} from "@/lib/internal-admin-config"

const originalInternalAdminEmails = process.env.INTERNAL_ADMIN_EMAILS

afterEach(() => {
  process.env.INTERNAL_ADMIN_EMAILS = originalInternalAdminEmails
})

describe("internal admin authorization", () => {
  it("parses comma-separated internal admin emails", () => {
    process.env.INTERNAL_ADMIN_EMAILS =
      "pontus@helmpolar.se, admin@example.com "

    expect(Array.from(getInternalAdminEmails())).toEqual([
      "pontus@helmpolar.se",
      "admin@example.com",
    ])
  })

  it("matches emails case-insensitively", () => {
    process.env.INTERNAL_ADMIN_EMAILS = "pontus@helmpolar.se"

    expect(isInternalAdminEmail("Pontus@HelmPolar.se")).toBe(true)
    expect(isInternalAdminEmail("user@customer.se")).toBe(false)
  })

  it("denies access when no allow-list is configured", () => {
    delete process.env.INTERNAL_ADMIN_EMAILS

    expect(isInternalAdminEmail("pontus@helmpolar.se")).toBe(false)
  })
})
