import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const generateDemoTenant = vi.fn()

vi.mock("@/lib/auth", () => {
  return {
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/demo/demo-tenant", async () => {
  const actual = await vi.importActual<typeof import("@/lib/demo/demo-tenant")>(
    "@/lib/demo/demo-tenant"
  )

  return {
    ...actual,
    generateDemoTenant,
  }
})

describe("demo tenant API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    generateDemoTenant.mockResolvedValue({
      eventsCreated: 300,
      installationsCreated: 240,
      propertiesCreated: 24,
      servicePartnerCompaniesCreated: 4,
      techniciansCreated: 9,
      intentionalIssues: {
        expiringCertificates: 2,
        missingMunicipalityProperties: 2,
        missingPropertyAssignments: 18,
        missingRefrigerantCharge: 6,
        missingRefrigerantType: 7,
        unknownRefrigerants: 4,
      },
    })
  })

  it("allows OWNER users to generate demo data with explicit confirmation", async () => {
    const { POST } = await import("@/app/api/demo/tenant/route")

    const response = await POST(createRequest({ confirm: true }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(generateDemoTenant).toHaveBeenCalledWith({
      companyId: "company-1",
      confirmed: true,
      ownerUserId: "owner-1",
    })
    expect(body.summary.installationsCreated).toBe(240)
  })

  it.each(["ADMIN", "MEMBER", "CONTRACTOR"] as const)(
    "denies %s users",
    async (role) => {
      const { POST } = await import("@/app/api/demo/tenant/route")
      authenticateApiRequest.mockResolvedValueOnce({
        user: {
          userId: "user-1",
          companyId: "company-1",
          role,
        },
      })

      const response = await POST(createRequest({ confirm: true }))

      expect(response.status).toBe(403)
      expect(generateDemoTenant).not.toHaveBeenCalled()
    }
  )

  it("passes missing confirmation to the generator safeguard", async () => {
    const { POST } = await import("@/app/api/demo/tenant/route")

    const response = await POST(createRequest({ confirm: false }))

    expect(response.status).toBe(201)
    expect(generateDemoTenant).toHaveBeenCalledWith({
      companyId: "company-1",
      confirmed: false,
      ownerUserId: "owner-1",
    })
  })
})

function createRequest(body: unknown) {
  return new Request("http://localhost/api/demo/tenant", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }) as never
}
