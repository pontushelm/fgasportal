import { beforeEach, describe, expect, it, vi } from "vitest"

const companyFindUnique = vi.fn()
const hashPassword = vi.fn()
const invitationFindUnique = vi.fn()
const transaction = vi.fn()
const userFindUnique = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    company: {
      findUnique: companyFindUnique,
    },
    invitation: {
      findUnique: invitationFindUnique,
    },
    user: {
      findUnique: userFindUnique,
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  hashPassword,
}))

vi.mock("@/lib/service-organizations", () => ({
  ensureServiceOrganizationForLegacyCompany: vi.fn(),
  mapServiceOrganizationRole: vi.fn(),
}))

describe("registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INTERNAL_ADMIN_EMAILS = "pontus@helmpolar.se"
    companyFindUnique.mockResolvedValue(null)
    hashPassword.mockResolvedValue("hashed-password")
    invitationFindUnique.mockResolvedValue(null)
    transaction.mockImplementation((callback) => callback(createTx()))
    userFindUnique.mockResolvedValue(null)
  })

  it("rejects public registration without invitation", async () => {
    const { POST } = await import("@/app/api/auth/register/route")

    const response = await POST(
      createRequest({
        userEmail: "customer@example.com",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain("pilotfas")
    expect(companyFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it("allows internal admin registration without invitation", async () => {
    const { POST } = await import("@/app/api/auth/register/route")
    const tx = createTx()
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(
      createRequest({
        userEmail: "Pontus@HelmPolar.se",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(tx.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Pilot Fastigheter",
          orgNumber: "5567037485",
        }),
      })
    )
    expect(tx.companyMembership.create).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        isActive: true,
        role: "OWNER",
        userId: "user-1",
      },
    })
    expect(body).toMatchObject({
      companyId: "company-1",
      userId: "user-1",
    })
  })

  it("keeps invitation registration working", async () => {
    const { POST } = await import("@/app/api/auth/register/route")
    const tx = createTx({
      userId: "invited-user-1",
    })
    invitationFindUnique.mockResolvedValueOnce({
      id: "invitation-1",
      acceptedAt: null,
      companyId: "company-invited",
      email: "invited@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      isServicePartnerAdminInvite: false,
      role: "MEMBER",
      servicePartnerCompanyId: null,
      company: {
        name: "Inbjuden organisation",
      },
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(
      createRequest({
        companyName: undefined,
        inviteToken: "invite-token",
        orgNumber: undefined,
        userEmail: "invited@example.com",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        companyId: "company-invited",
        email: "invited@example.com",
        name: "Anna Pilot",
        password: "hashed-password",
        role: "MEMBER",
      },
    })
    expect(tx.invitation.update).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
      },
      data: {
        acceptedAt: expect.any(Date),
      },
    })
    expect(body).toMatchObject({
      companyId: "company-invited",
      companyName: "Inbjuden organisation",
      userId: "invited-user-1",
    })
  })
})

function createRequest(overrides: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    companyName: "Pilot Fastigheter",
    orgNumber: "556703-7485",
    userName: "Anna Pilot",
    userEmail: "customer@example.com",
    password: "Password1",
    confirmPassword: "Password1",
    ...overrides,
  }

  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key]
    }
  })

  return new Request("http://localhost/api/auth/register", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }) as never
}

function createTx({ userId = "user-1" } = {}) {
  return {
    company: {
      create: vi.fn().mockResolvedValue({
        id: "company-1",
        users: [
          {
            id: "user-1",
          },
        ],
      }),
    },
    companyMembership: {
      create: vi.fn(),
    },
    invitation: {
      update: vi.fn(),
    },
    serviceOrganizationMembership: {
      upsert: vi.fn(),
    },
    user: {
      create: vi.fn().mockResolvedValue({
        id: userId,
      }),
    },
  }
}
