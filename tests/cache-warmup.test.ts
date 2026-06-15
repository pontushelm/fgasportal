import { afterEach, describe, expect, it, vi } from "vitest"
import { mutate as mutateGlobal } from "swr"
import {
  DASHBOARD_CACHE_WARMUP_SESSION_KEY,
  getDashboardCacheWarmupKeys,
  shouldRunDashboardCacheWarmup,
  warmDashboardCache,
} from "@/lib/client/cache-warmup"
import { API_CACHE_KEYS } from "@/lib/client/api-cache"

vi.mock("swr", () => ({
  default: vi.fn(),
  mutate: vi.fn(),
}))

describe("dashboard cache warmup", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(mutateGlobal).mockReset()
  })

  it("prepares a focused list of safe dashboard cache keys", () => {
    const keys = getDashboardCacheWarmupKeys({ reportYear: 2026 })

    expect(keys).toEqual([
      API_CACHE_KEYS.dashboard,
      API_CACHE_KEYS.actions,
      API_CACHE_KEYS.dataQuality,
      API_CACHE_KEYS.properties,
      API_CACHE_KEYS.propertiesOverview,
      API_CACHE_KEYS.installations,
      API_CACHE_KEYS.installationsFilterSource,
      API_CACHE_KEYS.contractorsOverview,
      API_CACHE_KEYS.reportsFgas(
        "reportType=annual&year=2026&overviewOnly=1"
      ),
      API_CACHE_KEYS.notifications,
    ])
  })

  it("does not include detail, event or document endpoints", () => {
    const keys = getDashboardCacheWarmupKeys({ reportYear: 2026 })

    expect(keys.some((key) => /\/api\/installations\/[^?]+$/.test(key))).toBe(
      false
    )
    expect(keys.some((key) => key.includes("/documents"))).toBe(false)
    expect(keys.some((key) => key.includes("/events"))).toBe(false)
    expect(keys.some((key) => key.includes("/download"))).toBe(false)
  })

  it("runs once per session", async () => {
    const storage = createMemoryStorage()
    const fetchMock = mockSuccessfulFetch()
    vi.mocked(mutateGlobal).mockResolvedValue(undefined)

    const first = await warmDashboardCache({ reportYear: 2026, storage })
    const second = await warmDashboardCache({ reportYear: 2026, storage })

    expect(first.attempted).toBe(true)
    expect(second.attempted).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(first.keys.length)
    expect(storage.getItem(DASHBOARD_CACHE_WARMUP_SESSION_KEY)).toBe("true")
  })

  it("detects whether warmup should run from session storage", () => {
    const storage = createMemoryStorage()

    expect(shouldRunDashboardCacheWarmup(storage)).toBe(true)
    storage.setItem(DASHBOARD_CACHE_WARMUP_SESSION_KEY, "true")
    expect(shouldRunDashboardCacheWarmup(storage)).toBe(false)
  })

  it("handles failed fetches without throwing", async () => {
    const storage = createMemoryStorage()
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            String(input).includes("/api/dashboard/actions")
              ? { error: "Kunde inte hämta åtgärder" }
              : { ok: true }
          ),
          {
            headers: { "Content-Type": "application/json" },
            status: String(input).includes("/api/dashboard/actions") ? 500 : 200,
          }
        )
      )
    )
    vi.mocked(mutateGlobal).mockResolvedValue(undefined)

    await expect(
      warmDashboardCache({ reportYear: 2026, storage })
    ).resolves.toMatchObject({
      attempted: true,
      rejected: 1,
    })
  })
})

function mockSuccessfulFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  )
}

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}
