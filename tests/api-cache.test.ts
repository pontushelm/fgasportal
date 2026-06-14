import { afterEach, describe, expect, it, vi } from "vitest"
import { mutate as mutateGlobal } from "swr"
import {
  API_CACHE_KEYS,
  ApiFetchError,
  apiFetcher,
  invalidateInstallationCaches,
  isUnauthorizedApiError,
} from "@/lib/client/api-cache"

vi.mock("swr", () => ({
  default: vi.fn(),
  mutate: vi.fn(),
}))

describe("client API cache helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(mutateGlobal).mockReset()
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
    expect(API_CACHE_KEYS.dashboard).toBe("/api/dashboard/compliance")
    expect(API_CACHE_KEYS.notifications).toBe("/api/dashboard/notifications")
    expect(API_CACHE_KEYS.activity("page=1&pageSize=25")).toBe(
      "/api/activity?page=1&pageSize=25"
    )
    expect(API_CACHE_KEYS.company).toBe("/api/company")
    expect(API_CACHE_KEYS.companyInvitations).toBe("/api/company/invitations")
    expect(API_CACHE_KEYS.userTechnicianCertification).toBe(
      "/api/user/technician-certification"
    )
    expect(API_CACHE_KEYS.userTechnicianCertificationDocument).toBe(
      "/api/user/technician-certification/document"
    )
    expect(API_CACHE_KEYS.contractorsOverview).toBe("/api/contractors/overview")
    expect(API_CACHE_KEYS.serviceDashboard).toBe("/api/dashboard/service")
    expect(API_CACHE_KEYS.serviceTechnicians).toBe(
      "/api/dashboard/service/technicians"
    )
    expect(API_CACHE_KEYS.servicePartnerCompany("spc_1")).toBe(
      "/api/service-partner-companies/spc_1"
    )
    expect(API_CACHE_KEYS.contractorCertification("user_1")).toBe(
      "/api/company/contractors/user_1/certification"
    )
    expect(API_CACHE_KEYS.propertiesOverview).toBe("/api/properties/overview")
    expect(API_CACHE_KEYS.dataQuality).toBe("/api/dashboard/data-quality")
    expect(API_CACHE_KEYS.installations).toBe("/api/installations")
    expect(API_CACHE_KEYS.installationsFilterSource).toBe(
      "/api/installations?mode=filter-source"
    )
    expect(API_CACHE_KEYS.installationDetail("inst_1")).toBe(
      "/api/installations/inst_1"
    )
    expect(API_CACHE_KEYS.installationEvents("inst_1")).toBe(
      "/api/installations/inst_1/events"
    )
    expect(API_CACHE_KEYS.installationDocuments("inst_1")).toBe(
      "/api/installations/inst_1/documents"
    )
    expect(API_CACHE_KEYS.installationActivity("inst_1")).toBe(
      "/api/installations/inst_1/activity"
    )
    expect(API_CACHE_KEYS.servicePartnerCompanies).toBe(
      "/api/service-partner-companies"
    )
    expect(API_CACHE_KEYS.companyContractors).toBe("/api/company/contractors")
    expect(API_CACHE_KEYS.reportsFgas("reportType=annual&year=2026")).toBe(
      "/api/reports/fgas?reportType=annual&year=2026"
    )
    expect(
      API_CACHE_KEYS.reportsAnnualFgasHistory("reportType=annual&year=2026")
    ).toBe("/api/reports/annual-fgas/history?reportType=annual&year=2026")
    expect(API_CACHE_KEYS.savedFilters("actions")).toBe(
      "/api/saved-filters?page=actions"
    )
  })

  it("invalidates installation-related caches conservatively", async () => {
    vi.mocked(mutateGlobal).mockResolvedValue(undefined)

    await invalidateInstallationCaches("inst_1")

    const invalidatedKeys = vi.mocked(mutateGlobal).mock.calls.map(([key]) => key)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.installations)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.installationsFilterSource)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.dashboard)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.actions)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.dataQuality)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.properties)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.propertiesOverview)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.serviceDashboard)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.contractorsOverview)
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.installationDetail("inst_1"))
    expect(invalidatedKeys).toContain(API_CACHE_KEYS.installationEvents("inst_1"))
    expect(invalidatedKeys).toContain(
      API_CACHE_KEYS.installationDocuments("inst_1")
    )
    expect(invalidatedKeys).toContain(
      API_CACHE_KEYS.installationActivity("inst_1")
    )
    expect(
      invalidatedKeys.some(
        (key) => typeof key === "function"
      )
    ).toBe(true)
  })
})
