import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const getInstallationAccessWhereClause = vi.fn()
const installationFindMany = vi.fn()

vi.mock("@/lib/auth", () => ({
  authenticateApiRequest,
  forbiddenResponse: () => Response.json({ error: "Behörighet saknas" }, { status: 403 }),
  isAdmin: (user: { role: string }) => user.role === "OWNER" || user.role === "ADMIN",
}))

vi.mock("@/lib/access/installation-access", () => ({
  getInstallationAccessWhereClause,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    installation: {
      findMany: installationFindMany,
    },
  },
}))

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}))

vi.mock("@/lib/contractor-assignment-notifications", () => ({
  notifyContractorsAboutNewAssignments: vi.fn(),
}))

describe("installations filter-source API mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    getInstallationAccessWhereClause.mockReturnValue({ companyId: "company-1" })
    installationFindMany.mockResolvedValue([
      {
        id: "installation-1",
        refrigerantType: "R410A",
        property: {
          id: "property-1",
          name: "Stadshuset",
          municipality: "Stockholm",
          city: "Stockholm",
        },
        assignedContractor: {
          id: "contractor-1",
          name: "Tekniker",
          email: "tekniker@example.com",
          memberships: [
            {
              servicePartnerCompany: {
                id: "sp-1",
                name: "Kyl AB",
                organizationNumber: "556000-0000",
              },
            },
          ],
        },
        assignedServicePartnerCompany: null,
      },
    ])
  })

  it("returns lightweight filter-source rows scoped by the shared access helper", async () => {
    const { GET } = await import("@/app/api/installations/route")

    const response = await GET(createRequest("/api/installations?mode=filter-source"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getInstallationAccessWhereClause).toHaveBeenCalledWith({
      userId: "owner-1",
      companyId: "company-1",
      role: "OWNER",
    })
    expect(installationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ companyId: "company-1" }],
        },
      })
    )
    expect(installationFindMany.mock.calls[0][0].include).toBeUndefined()
    expect(installationFindMany.mock.calls[0][0].select.events).toBeUndefined()
    expect(body).toEqual([
      {
        id: "installation-1",
        refrigerantType: "R410A",
        property: {
          id: "property-1",
          name: "Stadshuset",
          municipality: "Stockholm",
          city: "Stockholm",
        },
        assignedContractor: {
          id: "contractor-1",
          name: "Tekniker",
          email: "tekniker@example.com",
          servicePartnerCompany: {
            id: "sp-1",
            name: "Kyl AB",
            organizationNumber: "556000-0000",
          },
        },
        assignedServicePartnerCompany: null,
      },
    ])
  })

  it("keeps contractor/servicepartner access delegated through the shared access helper", async () => {
    const { GET } = await import("@/app/api/installations/route")
    const contractorUser = {
      userId: "contractor-1",
      companyId: "company-1",
      role: "CONTRACTOR",
      servicePartnerCompanyId: "sp-1",
      isServicePartnerAdmin: true,
    }
    authenticateApiRequest.mockResolvedValueOnce({ user: contractorUser })
    getInstallationAccessWhereClause.mockReturnValueOnce({
      companyId: "company-1",
      assignedServicePartnerCompanyId: "sp-1",
    })

    await GET(createRequest("/api/installations?mode=filter-source"))

    expect(getInstallationAccessWhereClause).toHaveBeenCalledWith(contractorUser)
    expect(installationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              companyId: "company-1",
              assignedServicePartnerCompanyId: "sp-1",
            },
          ],
        },
      })
    )
  })
})

function createRequest(path: string) {
  return {
    nextUrl: new URL(`http://localhost${path}`),
  } as never
}
