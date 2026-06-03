import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const logActivity = vi.fn()
const propertyFindMany = vi.fn()
const propertyFindFirst = vi.fn()
const propertyUpdate = vi.fn()
const propertyDelete = vi.fn()

vi.mock("@/lib/auth", () => ({
  authenticateApiRequest,
  forbiddenResponse: () =>
    NextResponse.json({ error: "Behörighet saknas" }, { status: 403 }),
  isAdmin: (user: { role: string }) => user.role === "OWNER" || user.role === "ADMIN",
  isContractor: (user: { role: string }) => user.role === "CONTRACTOR",
}))

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      delete: propertyDelete,
      findMany: propertyFindMany,
      findFirst: propertyFindFirst,
      update: propertyUpdate,
    },
  },
}))

const routeContext = {
  params: Promise.resolve({ id: "property-1" }),
}

const validBody = {
  name: "Stadshuset",
  propertyDesignation: "Staden 1:1",
  municipality: "Stockholm",
  city: "Stockholm",
  address: "Storgatan 1",
  postalCode: "111 22",
  internalReference: "OBJ-1",
  description: "Huvudfastighet",
}

describe("property detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "user-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    logActivity.mockResolvedValue(undefined)
  })

  it("allows ADMIN to update property information in the current tenant", async () => {
    const { PATCH } = await import("@/app/api/properties/[id]/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "admin-1",
        companyId: "company-1",
        role: "ADMIN",
      },
    })
    propertyFindFirst
      .mockResolvedValueOnce({ id: "property-1" })
      .mockResolvedValueOnce(null)
    propertyUpdate.mockResolvedValueOnce({ id: "property-1", ...validBody })

    const response = await PATCH(createRequest("PATCH", validBody), routeContext)

    expect(response.status).toBe(200)
    expect(propertyFindFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: "property-1",
        companyId: "company-1",
      },
      select: {
        id: true,
      },
    })
    expect(propertyUpdate).toHaveBeenCalledWith({
      where: {
        id: "property-1",
      },
      data: validBody,
    })
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "property_updated",
        companyId: "company-1",
        entityId: "property-1",
        entityType: "PROPERTY",
      })
    )
  })

  it("allows OWNER to update property information", async () => {
    const { PATCH } = await import("@/app/api/properties/[id]/route")
    propertyFindFirst
      .mockResolvedValueOnce({ id: "property-1" })
      .mockResolvedValueOnce(null)
    propertyUpdate.mockResolvedValueOnce({ id: "property-1", ...validBody })

    const response = await PATCH(createRequest("PATCH", validBody), routeContext)

    expect(response.status).toBe(200)
  })

  it("prevents MEMBER and CONTRACTOR from updating property information", async () => {
    const { PATCH } = await import("@/app/api/properties/[id]/route")

    authenticateApiRequest.mockResolvedValueOnce({
      user: { userId: "member-1", companyId: "company-1", role: "MEMBER" },
    })
    const memberResponse = await PATCH(createRequest("PATCH", validBody), routeContext)

    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
      },
    })
    const contractorResponse = await PATCH(createRequest("PATCH", validBody), routeContext)

    expect(memberResponse.status).toBe(403)
    expect(contractorResponse.status).toBe(403)
    expect(propertyUpdate).not.toHaveBeenCalled()
  })

  it("rejects duplicate property designations within the same company", async () => {
    const { PATCH } = await import("@/app/api/properties/[id]/route")
    propertyFindFirst
      .mockResolvedValueOnce({ id: "property-1" })
      .mockResolvedValueOnce({ id: "property-2" })

    const response = await PATCH(createRequest("PATCH", validBody), routeContext)

    expect(response.status).toBe(409)
    expect(propertyUpdate).not.toHaveBeenCalled()
  })

  it("preserves tenant isolation when updating properties", async () => {
    const { PATCH } = await import("@/app/api/properties/[id]/route")
    propertyFindFirst.mockResolvedValueOnce(null)

    const response = await PATCH(createRequest("PATCH", validBody), routeContext)

    expect(response.status).toBe(404)
    expect(propertyUpdate).not.toHaveBeenCalled()
  })

  it("allows OWNER to delete a property without linked aggregat", async () => {
    const { DELETE } = await import("@/app/api/properties/[id]/route")
    propertyFindFirst.mockResolvedValueOnce({
      id: "property-1",
      name: "Stadshuset",
      propertyDesignation: "Staden 1:1",
      _count: {
        installations: 0,
      },
    })
    propertyDelete.mockResolvedValueOnce({})

    const response = await DELETE(createRequest("DELETE"), routeContext)

    expect(response.status).toBe(200)
    expect(propertyDelete).toHaveBeenCalledWith({
      where: {
        id: "property-1",
      },
    })
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "property_deleted",
        companyId: "company-1",
        entityId: "property-1",
        entityType: "PROPERTY",
      })
    )
  })

  it("prevents ADMIN from deleting a property", async () => {
    const { DELETE } = await import("@/app/api/properties/[id]/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "admin-1",
        companyId: "company-1",
        role: "ADMIN",
      },
    })

    const response = await DELETE(createRequest("DELETE"), routeContext)

    expect(response.status).toBe(403)
    expect(propertyDelete).not.toHaveBeenCalled()
  })

  it("prevents OWNER from deleting a property with linked aggregat", async () => {
    const { DELETE } = await import("@/app/api/properties/[id]/route")
    propertyFindFirst.mockResolvedValueOnce({
      id: "property-1",
      name: "Stadshuset",
      propertyDesignation: "Staden 1:1",
      _count: {
        installations: 2,
      },
    })

    const response = await DELETE(createRequest("DELETE"), routeContext)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain("aggregat kopplade")
    expect(propertyDelete).not.toHaveBeenCalled()
  })
})

describe("properties route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "user-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
  })

  it("returns all company properties for customer roles", async () => {
    const { GET } = await import("@/app/api/properties/route")
    propertyFindMany.mockResolvedValueOnce([{ id: "property-1" }])

    const response = await GET(createCollectionRequest())

    expect(response.status).toBe(200)
    expect(propertyFindMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
      },
      orderBy: [{ name: "asc" }],
    })
  })

  it("scopes contractor properties to delegated aggregat access", async () => {
    const { GET } = await import("@/app/api/properties/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "contractor-1",
        companyId: "company-1",
        role: "CONTRACTOR",
        isServicePartnerAdmin: true,
        servicePartnerCompanyId: "servicepartner-1",
      },
    })
    propertyFindMany.mockResolvedValueOnce([{ id: "property-1" }])

    const response = await GET(createCollectionRequest())

    expect(response.status).toBe(200)
    expect(propertyFindMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        installations: {
          some: {
            AND: [
              {
                companyId: "company-1",
              },
              {
                OR: [
                  {
                    assignedContractorId: "contractor-1",
                  },
                  {
                    assignedServicePartnerCompanyId: "servicepartner-1",
                  },
                ],
              },
            ],
          },
        },
      },
      orderBy: [{ name: "asc" }],
    })
  })
})

function createRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/properties/property-1", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  }) as never
}

function createCollectionRequest() {
  return new Request("http://localhost/api/properties", {
    method: "GET",
  }) as never
}
