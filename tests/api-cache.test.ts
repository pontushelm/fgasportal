import { afterEach, describe, expect, it, vi } from "vitest"
import {
  API_CACHE_KEYS,
  ApiFetchError,
  apiFetcher,
  isUnauthorizedApiError,
} from "@/lib/client/api-cache"

describe("client API cache helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches API data with credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    )

    await expect(apiFetcher<{ ok: boolean }>("/api/example")).resolves.toEqual({
      ok: true,
    })
    expect(fetchMock).toHaveBeenCalledWith("/api/example", {
      credentials: "include",
    })
  })

  it("throws API errors with server-provided messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Kunde inte hämta data" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      })
    )

    await expect(apiFetcher("/api/example")).rejects.toMatchObject({
      message: "Kunde inte hämta data",
      status: 500,
    })
  })

  it("identifies unauthorized API errors", () => {
    expect(isUnauthorizedApiError(new ApiFetchError("Logga in", 401))).toBe(true)
    expect(isUnauthorizedApiError(new ApiFetchError("Fel", 500))).toBe(false)
    expect(isUnauthorizedApiError(new Error("Fel"))).toBe(false)
  })

  it("exposes stable cache keys for migrated pages", () => {
    expect(API_CACHE_KEYS.actions).toBe("/api/dashboard/actions")
    expect(API_CACHE_KEYS.propertiesOverview).toBe("/api/properties/overview")
    expect(API_CACHE_KEYS.dataQuality).toBe("/api/dashboard/data-quality")
    expect(API_CACHE_KEYS.savedFilters("actions")).toBe(
      "/api/saved-filters?page=actions"
    )
  })
})
