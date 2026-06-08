import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const transaction = vi.fn()
const certificationRecordFindMany = vi.fn()
const companyMembershipFindFirst = vi.fn()
const userFindUnique = vi.fn()

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
    $transaction: transaction,
    certificationRecord: {
      findMany: certificationRecordFindMany,
    },
    companyMembership: {
      findFirst: companyMembershipFindFirst,
    },
    user: {
      findUnique: userFindUnique,
    },
  },
}))

vi.mock("@/lib/service-organizations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/service-organizations")>(
    "@/lib/service-organizations"
  )

  return {
    ...actual,
    ensureServiceOrganizationForLegacyCompany,
  }
})

const contractorUser = {
  userId: "contractor-user-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  serviceOrganizationId: "service-org-1",
  isServicePartnerAdmin: false,
}

describe("own technician certification API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: contractorUser })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    certificationRecordFindMany.mockResolvedValue([])
    userFindUnique.mockResolvedValue(createUserLegacy())
    companyMembershipFindFirst.mockResolvedValue(createMembershipLegacy())
    transaction.mockImplementation((callback) => callback(createTransactionClient()))
  })

  it("requires authentication", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    authenticateApiRequest.mockResolvedValueOnce({
      response: NextResponse.json({ error: "Saknar autentisering" }, { status: 401 }),
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
  })

  it("denies non-contractor roles", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...contractorUser,
        role: "ADMIN",
        servicePartnerCompanyId: null,
      },
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
    expect(ensureServiceOrganizationForLegacyCompany).not.toHaveBeenCalled()
  })

  it("returns CertificationRecord before legacy fields", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    certificationRecordFindMany.mockResolvedValueOnce([
      createCertificationRecord({
        certificateNumber: "REC-1",
        issuer: "INCERT",
      }),
    ])
    userFindUnique.mockResolvedValueOnce(
      createUserLegacy({ certificationNumber: "USER-1" })
    )

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      certificateNumber: "REC-1",
      issuer: "INCERT",
      source: "CertificationRecord",
    })
    expect(certificationRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          serviceOrganizationId: "service-org-1",
          userId: "contractor-user-1",
        }),
      })
    )
  })

  it("falls back to User legacy fields", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    userFindUnique.mockResolvedValueOnce(
      createUserLegacy({
        certificationNumber: "USER-1",
        certificationIssuer: "User issuer",
      })
    )

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      certificateNumber: "USER-1",
      issuer: "User issuer",
      source: "User legacy",
    })
  })

  it("falls back to active CompanyMembership legacy fields", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    userFindUnique.mockResolvedValueOnce(createUserLegacy())
    companyMembershipFindFirst.mockResolvedValueOnce(
      createMembershipLegacy({
        certificationNumber: "MEMBER-1",
        certificationOrganization: "Membership issuer",
      })
    )

    const response = await GET(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      certificateNumber: "MEMBER-1",
      issuer: "Membership issuer",
      source: "CompanyMembership legacy",
    })
  })

  it("creates own technician certificate and ignores request body userId", async () => {
    const { PATCH } = await import("@/app/api/user/technician-certification/route")
    const tx = createTransactionClient({
      certificationRecordCreate: vi.fn().mockResolvedValue(
        createCertificationRecord({
          certificateNumber: "OWN-1",
          issuer: "INCERT",
          category: "Kategori I",
          validUntil: new Date("2027-01-01T00:00:00.000Z"),
        })
      ),
      certificationRecordFindFirst: vi.fn().mockResolvedValue(null),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await PATCH(
      createRequest({
        userId: "other-user",
        certificateNumber: " OWN-1 ",
        issuer: "INCERT",
        category: "Kategori I",
        validUntil: "2027-01-01",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(tx.companyMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "membership-1",
          companyId: "company-1",
          userId: "contractor-user-1",
          role: "CONTRACTOR",
          isActive: true,
        }),
      })
    )
    expect(tx.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        certificateNumber: "OWN-1",
        companyId: "company-1",
        serviceOrganizationId: "service-org-1",
        userId: "contractor-user-1",
      }),
    })
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contractor-user-1" },
        data: expect.objectContaining({
          certificationNumber: "OWN-1",
          certificationIssuer: "INCERT",
          certificationCategory: "Kategori I",
        }),
      })
    )
    expect(tx.companyMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "membership-1" },
        data: expect.objectContaining({
          isCertifiedCompany: true,
          certificationNumber: "OWN-1",
          certificationOrganization: "INCERT",
        }),
      })
    )
    expect(body).toMatchObject({
      certificateNumber: "OWN-1",
      source: "CertificationRecord",
    })
  })

  it("updates an existing own technician certificate", async () => {
    const { PATCH } = await import("@/app/api/user/technician-certification/route")
    const tx = createTransactionClient({
      certificationRecordFindFirst: vi.fn().mockResolvedValue({
        id: "cert-record-1",
      }),
      certificationRecordUpdate: vi.fn().mockResolvedValue(
        createCertificationRecord({ certificateNumber: "UPDATED-1" })
      ),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await PATCH(
      createRequest({
        certificateNumber: "UPDATED-1",
        issuer: "",
        category: "",
        validUntil: "",
      })
    )

    expect(response.status).toBe(200)
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: expect.objectContaining({
        certificateNumber: "UPDATED-1",
        status: "ACTIVE",
        updatedByUserId: "contractor-user-1",
      }),
    })
    expect(tx.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("clears own technician certificate and syncs legacy fields", async () => {
    const { PATCH } = await import("@/app/api/user/technician-certification/route")
    const tx = createTransactionClient()
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await PATCH(createRequest({ certificateNumber: "" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(tx.certificationRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "contractor-user-1",
        }),
        data: {
          status: "DELETED",
          updatedByUserId: "contractor-user-1",
        },
      })
    )
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificationNumber: null,
          certificationIssuer: null,
          certificationValidUntil: null,
          certificationCategory: null,
        }),
      })
    )
    expect(tx.companyMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCertifiedCompany: false,
          certificationNumber: null,
          certificationOrganization: null,
          certificationValidUntil: null,
        }),
      })
    )
    expect(body).toMatchObject({
      certificateNumber: null,
      source: "none",
      status: {
        label: "Saknas",
      },
    })
  })

  it("denies contractors without servicepartner context", async () => {
    const { GET } = await import("@/app/api/user/technician-certification/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...contractorUser,
        servicePartnerCompanyId: null,
      },
    })

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
    expect(certificationRecordFindMany).not.toHaveBeenCalled()
  })
})

function createRequest(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/user/technician-certification", {
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
    method: body ? "PATCH" : "GET",
  }) as never
}

function createTransactionClient({
  certificationRecordCreate = vi.fn().mockResolvedValue(createCertificationRecord()),
  certificationRecordFindFirst = vi.fn().mockResolvedValue(null),
  certificationRecordUpdate = vi.fn().mockResolvedValue(createCertificationRecord()),
  certificationRecordUpdateMany = vi.fn().mockResolvedValue({ count: 0 }),
} = {}) {
  return {
    certificationRecord: {
      create: certificationRecordCreate,
      findFirst: certificationRecordFindFirst,
      update: certificationRecordUpdate,
      updateMany: certificationRecordUpdateMany,
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue(createMembershipLegacy()),
      update: vi.fn().mockResolvedValue(createMembershipLegacy()),
    },
    user: {
      update: vi.fn().mockResolvedValue(createUserLegacy()),
    },
  }
}

function createCertificationRecord(overrides = {}) {
  return {
    id: "cert-record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    userId: "contractor-user-1",
    subjectType: "TECHNICIAN",
    certificateType: "PERSONAL_FGAS",
    certificateNumber: "CERT-1",
    issuer: "INCERT",
    category: "Kategori I",
    validFrom: null,
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    status: "ACTIVE",
    verificationStatus: "SELF_DECLARED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function createUserLegacy(overrides = {}) {
  return {
    id: "contractor-user-1",
    certificationNumber: null,
    certificationIssuer: null,
    certificationValidUntil: null,
    certificationCategory: null,
    ...overrides,
  }
}

function createMembershipLegacy(overrides = {}) {
  return {
    id: "membership-1",
    certificationNumber: null,
    certificationOrganization: null,
    certificationValidUntil: null,
    ...overrides,
  }
}
