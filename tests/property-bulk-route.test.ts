import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const logActivity = vi.fn()
const propertyFindMany = vi.fn()
const propertyDeleteMany = vi.fn()
const propertyUpdateMany = vi.fn()
const transaction = vi.fn()

vi.mock("@/lib/auth", () => ({
  authenticateApiRequest,
  forbiddenResponse: () =>
    NextResponse.json({ error: "BehÃ¶righet saknas" }, { status: 403 }),
  isAdmin: (user: { role: string }) => user.role === "OWNER" || user.role === "ADMIN",
}))

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    property: {
      deleteMany: propertyDeleteMany,
      findMany: propertyFindMany,
      updateMany: propertyUpdateMany,
    },
  },
}))

describe("property bulk route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "owner-1",
        companyId: "company-1",
        role: "OWNER",
      },
    })
    logActivity.mockResolvedValue("activity-1")
    transaction.mockImplementation(async (callback) =>
      callback({
        property: {
          deleteMany: propertyDeleteMany,
        },
      })
    )
  })

  it("deletes only properties without linked installations", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")
    propertyFindMany.mockResolvedValueOnce([
      propertyRow("property-a", "A", 0),
      propertyRow("property-b", "B", 2),
    ])

    const response = await POST(
      createBulkRequest({
        action: "DELETE",
        propertyIds: ["property-a", "property-b"],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(propertyDeleteMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        id: {
          in: ["property-a"],
        },
      },
    })
    expect(body).toMatchObject({
      blockedCount: 1,
      deletedCount: 1,
    })
    expect(body.blocked[0]).toMatchObject({
      id: "property-b",
      installationCount: 2,
      name: "B",
    })
  })

  it("prevents ADMIN from bulk deleting properties", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "admin-1",
        companyId: "company-1",
        role: "ADMIN",
      },
    })

    const response = await POST(
      createBulkRequest({ action: "DELETE", propertyIds: ["property-a"] })
    )

    expect(response.status).toBe(403)
    expect(propertyDeleteMany).not.toHaveBeenCalled()
  })

  it("clears only explicitly selected nullable fields for company properties", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")
    propertyFindMany.mockResolvedValueOnce([
      propertyRow("property-a", "A", 0),
      propertyRow("property-b", "B", 0),
    ])

    const response = await POST(
      createBulkRequest({
        action: "CLEAR_FIELDS",
        fields: ["address", "municipality"],
        propertyIds: ["property-a", "property-b", "other-company-property"],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(propertyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          id: {
            in: ["property-a", "property-b", "other-company-property"],
          },
        },
      })
    )
    expect(propertyUpdateMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        id: {
          in: ["property-a", "property-b"],
        },
      },
      data: {
        address: null,
        municipality: null,
      },
    })
    expect(body).toMatchObject({ updatedCount: 2 })
  })

  it("sets municipality without changing other fields", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")
    propertyFindMany.mockResolvedValueOnce([propertyRow("property-a", "A", 0)])

    const response = await POST(
      createBulkRequest({
        action: "SET_MUNICIPALITY",
        municipality: " KungÃ¤lv ",
        propertyIds: ["property-a"],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(propertyUpdateMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        id: {
          in: ["property-a"],
        },
      },
      data: {
        municipality: "KungÃ¤lv",
      },
    })
    expect(body).toMatchObject({
      municipality: "KungÃ¤lv",
      updatedCount: 1,
    })
  })

  it("rejects empty municipality values", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")

    const response = await POST(
      createBulkRequest({
        action: "SET_MUNICIPALITY",
        municipality: " ",
        propertyIds: ["property-a"],
      })
    )

    expect(response.status).toBe(400)
    expect(propertyUpdateMany).not.toHaveBeenCalled()
  })

  it("rejects MEMBER bulk updates", async () => {
    const { POST } = await import("@/app/api/properties/bulk/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        userId: "member-1",
        companyId: "company-1",
        role: "MEMBER",
      },
    })

    const response = await POST(
      createBulkRequest({
        action: "CLEAR_FIELDS",
        fields: ["address"],
        propertyIds: ["property-a"],
      })
    )

    expect(response.status).toBe(403)
    expect(propertyUpdateMany).not.toHaveBeenCalled()
  })
})

function propertyRow(id: string, name: string, installationCount: number) {
  return {
    id,
    name,
    propertyDesignation: `${name}:1`,
    _count: {
      installations: installationCount,
    },
  }
}

function createBulkRequest(body: unknown) {
  return new Request("http://localhost/api/properties/bulk", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as never
}
