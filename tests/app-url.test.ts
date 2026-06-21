import { afterEach, describe, expect, it } from "vitest"
import { buildAppUrl, getAppUrl } from "@/lib/app-url"

const originalAppUrl = process.env.APP_URL

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL
  } else {
    process.env.APP_URL = originalAppUrl
  }
})

describe("app URL", () => {
  it("uses the Helm Polar production URL when APP_URL is missing", () => {
    delete process.env.APP_URL

    expect(getAppUrl()).toBe("https://app.helmpolar.se")
    expect(buildAppUrl("/dashboard/actions")).toBe(
      "https://app.helmpolar.se/dashboard/actions"
    )
  })

  it("uses and normalizes APP_URL when configured", () => {
    process.env.APP_URL = "https://preview.example.com/"

    expect(getAppUrl()).toBe("https://preview.example.com")
    expect(buildAppUrl("register?invite=token")).toBe(
      "https://preview.example.com/register?invite=token"
    )
  })
})
