import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const sendInvitationEmail = vi.fn()
const transaction = vi.fn()
const userFindUnique = vi.fn()
const companyFindFirst = vi.fn()

vi.mock("@/lib/auth", () => ({
  authenticateApiRequest,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    company: {
      findFirst: companyFindFirst,
    },
    user: {
      findUnique: userFindUnique,
    },
  },
}))

vi.mock("@/lib/email", () => ({
  sendInvitationEmail,
}))

vi.mock("@/lib/app-url", () => ({
  buildAppUrl: (path: string) => `https://app.helmpolar.se${path}`,
}))

describe("internal admin pilot organization API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INTERNAL_ADMIN_EMAILS = "pontus@helmpolar.se"
    authenticateApiRequest.mockResolvedValue({
      user: {
        userId: "internal-admin-1",
        companyId: "helm-systems",
        role: "OWNER",
      },
    })
    userFindUnique.mockResolvedValue({
      id: "internal-admin-1",
      email: "pontus@helmpolar.se",
      isActive: true,
    })
    companyFindFirst.mockResolvedValue(null)
    sendInvitationEmail.mockResolvedValue({ id: "email-1" })
    transaction.mockImplementation((callback) => callback(createTx()))
  })

  it("denies non-internal admins", async () => {
    const { POST } = await import("@/app/api/admin/pilot-organizations/route")
    userFindUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "customer@example.com",
      isActive: true,
    })

    const response = await POST(createRequest())

    expect(response.status).toBe(404)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("creates company and owner invitation for a new user", async () => {
    const { POST } = await import("@/app/api/admin/pilot-organizations/route")
    const tx = createTx({
      existingUser: null,
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(tx.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactEmail: "owner@example.com",
        contactPerson: "Anna Pilot",
        name: "Pilot Fastigheter",
        planType: "pilot",
      }),
      select: {
        id: true,
        name: true,
      },
    })
    expect(tx.invitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-new",
        email: "owner@example.com",
        invitedByUserId: "internal-admin-1",
        role: "OWNER",
      }),
      select: {
        email: true,
        id: true,
        token: true,
      },
    })
    expect(sendInvitationEmail).toHaveBeenCalledWith({
      companyName: "Pilot Fastigheter",
      inviteUrl: "https://app.helmpolar.se/register?invite=invite-token",
      role: "OWNER",
      to: "owner@example.com",
    })
    expect(body).toMatchObject({
      contactEmail: "owner@example.com",
      emailSent: true,
      invitationCreated: true,
    })
  })

  it("reuses existing user and upserts owner membership", async () => {
    const { POST } = await import("@/app/api/admin/pilot-organizations/route")
    const tx = createTx({
      existingUser: {
        id: "existing-user-1",
        email: "owner@example.com",
        name: "Anna Pilot",
      },
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(tx.companyMembership.upsert).toHaveBeenCalledWith({
      where: {
        userId_companyId: {
          companyId: "company-new",
          userId: "existing-user-1",
        },
      },
      create: {
        companyId: "company-new",
        isActive: true,
        role: "OWNER",
        userId: "existing-user-1",
      },
      update: {
        isActive: true,
        role: "OWNER",
      },
      select: {
        id: true,
      },
    })
    expect(tx.invitation.create).not.toHaveBeenCalled()
    expect(sendInvitationEmail).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      existingUserReused: true,
      invitationCreated: false,
      membershipId: "membership-owner",
    })
  })

  it("creates invite link without sending email when requested", async () => {
    const { POST } = await import("@/app/api/admin/pilot-organizations/route")

    const response = await POST(
      createRequest({
        sendInvitationEmail: false,
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(sendInvitationEmail).not.toHaveBeenCalled()
    expect(body).toMatchObject({
      emailSent: false,
      inviteLink: "https://app.helmpolar.se/register?invite=invite-token",
      invitationCreated: true,
    })
  })
})

function createRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/admin/pilot-organizations", {
    body: JSON.stringify({
      organizationName: "Pilot Fastigheter",
      contactName: "Anna Pilot",
      contactEmail: "OWNER@example.com",
      sendInvitationEmail: true,
      ...overrides,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  }) as never
}

function createTx({
  existingUser = null,
}: {
  existingUser?: { id: string; email: string; name: string } | null
} = {}) {
  return {
    company: {
      create: vi.fn().mockResolvedValue({
        id: "company-new",
        name: "Pilot Fastigheter",
      }),
    },
    companyMembership: {
      upsert: vi.fn().mockResolvedValue({
        id: "membership-owner",
      }),
    },
    invitation: {
      create: vi.fn().mockResolvedValue({
        id: "invitation-1",
        email: "owner@example.com",
        token: "invite-token",
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUser),
    },
  }
}
