import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const certificationRecordFindMany = vi.fn()
const invitationFindMany = vi.fn()
const serviceOrganizationMembershipFindMany = vi.fn()
const servicePartnerCompanyFindFirst = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behorighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/db", () => ({
  prisma: {
    certificationRecord: {
      findMany: certificationRecordFindMany,
    },
    invitation: {
      findMany: invitationFindMany,
    },
    serviceOrganizationMembership: {
      findMany: serviceOrganizationMembershipFindMany,
    },
    servicePartnerCompany: {
      findFirst: servicePartnerCompanyFindFirst,
    },
  },
}))

const authUser = {
  userId: "owner-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "OWNER",
}

describe("servicepartner company detail lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: authUser })
    servicePartnerCompanyFindFirst.mockResolvedValue(createServicePartnerCompany())
    certificationRecordFindMany.mockResolvedValue([])
    invitationFindMany.mockResolvedValue([])
    serviceOrganizationMembershipFindMany.mockResolvedValue([])
  })

  it("includes derived lifecycle data in the detail response", async () => {
    const { GET } = await import("@/app/api/service-partner-companies/[id]/route")
    invitationFindMany.mockResolvedValueOnce([
      {
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    ])

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: "spc-1" }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.lifecycle).toMatchObject({
      status: "INVITED",
      label: "Inbjuden",
      severity: "warning",
    })
    expect(body.lifecycle.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "account",
          completed: false,
        }),
        expect.objectContaining({
          key: "company-certificate",
          completed: false,
        }),
      ])
    )
  })

  it("scopes the detail lookup to the authenticated company", async () => {
    const { GET } = await import("@/app/api/service-partner-companies/[id]/route")

    await GET(createRequest(), {
      params: Promise.resolve({ id: "spc-1" }),
    })

    expect(servicePartnerCompanyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1",
          id: "spc-1",
        },
      })
    )
  })
})

function createRequest() {
  return new NextRequest("http://localhost/api/service-partner-companies/spc-1")
}

function createServicePartnerCompany() {
  return {
    id: "spc-1",
    companyId: "company-1",
    name: "Kylservice AB",
    organizationNumber: "556000-0000",
    contactEmail: "kontakt@kylservice.example",
    phone: "010-100 10 10",
    certificateNumber: null,
    notes: null,
    serviceOrganizationId: "service-org-1",
    serviceOrganization: {
      id: "service-org-1",
      name: "Kylservice AB",
      organizationNumber: "556000-0000",
      contactEmail: "kontakt@kylservice.example",
      phone: "010-100 10 10",
      certificateNumber: null,
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    assignedInstallations: [],
    memberships: [],
  }
}
