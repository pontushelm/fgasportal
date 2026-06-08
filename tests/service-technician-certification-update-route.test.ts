import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const serviceOrganizationMembershipFindFirst = vi.fn()
const transaction = vi.fn()

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
    serviceOrganizationMembership: {
      findFirst: serviceOrganizationMembershipFindFirst,
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

const serviceAdmin = {
  userId: "service-admin-1",
  membershipId: "membership-admin-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  isServicePartnerAdmin: true,
}

describe("servicepartner technician certification update API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: serviceAdmin })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    serviceOrganizationMembershipFindFirst.mockResolvedValue(
      createTechnicianMembership()
    )
    transaction.mockImplementation((callback) => callback(createTransactionClient()))
  })

  it("allows servicepartner admin to create technician certificate", async () => {
    const { PATCH } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/route"
    )
    const tx = createTransactionClient({
      certificationRecordFindFirst: vi.fn().mockResolvedValue(null),
      certificationRecordCreate: vi.fn().mockResolvedValue(
        createCertificationRecord({
          certificateNumber: "PCERT-1",
          issuer: "INCERT",
          category: "Kategori I",
          validUntil: new Date("2027-01-01T00:00:00.000Z"),
        })
      ),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await PATCH(
      createRequest({
        certificateNumber: " PCERT-1 ",
        issuer: "INCERT",
        category: "Kategori I",
        validUntil: "2027-01-01",
      }),
      createContext()
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(tx.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        certificateNumber: "PCERT-1",
        certificateType: "PERSONAL_FGAS",
        companyId: "company-1",
        serviceOrganizationId: "service-org-1",
        subjectType: "TECHNICIAN",
        userId: "technician-1",
        verificationStatus: "SELF_DECLARED",
      }),
    })
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificationNumber: "PCERT-1",
          certificationIssuer: "INCERT",
          certificationCategory: "Kategori I",
        }),
      })
    )
    expect(tx.companyMembership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isCertifiedCompany: true,
          certificationNumber: "PCERT-1",
          certificationOrganization: "INCERT",
        }),
      })
    )
    expect(body).toMatchObject({
      certificateNumber: "PCERT-1",
      source: "CertificationRecord",
      status: {
        label: "Giltigt",
      },
    })
  })

  it("allows servicepartner admin to update existing technician certificate", async () => {
    const { PATCH } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/route"
    )
    const tx = createTransactionClient({
      certificationRecordFindFirst: vi.fn().mockResolvedValue({
        id: "cert-record-1",
      }),
      certificationRecordUpdate: vi.fn().mockResolvedValue(
        createCertificationRecord({
          id: "cert-record-1",
          certificateNumber: "PCERT-UPDATED",
        })
      ),
    })
    transaction.mockImplementationOnce((callback) => callback(tx))

    const response = await PATCH(
      createRequest({
        certificateNumber: "PCERT-UPDATED",
        issuer: "",
        category: "",
        validUntil: "",
      }),
      createContext()
    )

    expect(response.status).toBe(200)
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: expect.objectContaining({
        certificateNumber: "PCERT-UPDATED",
        status: "ACTIVE",
        verificationStatus: "SELF_DECLARED",
        updatedByUserId: "service-admin-1",
      }),
    })
    expect(tx.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("does not allow normal technicians to update another technician certificate", async () => {
    const { PATCH } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...serviceAdmin,
        isServicePartnerAdmin: false,
      },
    })

    const response = await PATCH(
      createRequest({ certificateNumber: "PCERT-1" }),
      createContext()
    )

    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("does not allow customer admins to update technician certificates through this route", async () => {
    const { PATCH } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/route"
    )
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...serviceAdmin,
        role: "ADMIN",
        servicePartnerCompanyId: null,
        isServicePartnerAdmin: false,
      },
    })

    const response = await PATCH(
      createRequest({ certificateNumber: "PCERT-1" }),
      createContext()
    )

    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it("cannot update a technician outside the service organization", async () => {
    const { PATCH } = await import(
      "@/app/api/dashboard/service/technicians/[userId]/certification/route"
    )
    serviceOrganizationMembershipFindFirst.mockResolvedValueOnce(null)

    const response = await PATCH(
      createRequest({ certificateNumber: "PCERT-1" }),
      createContext()
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toContain("Teknikern hittades inte")
    expect(transaction).not.toHaveBeenCalled()
  })
})

function createRequest(body: Record<string, unknown>) {
  return new Request(
    "http://localhost/api/dashboard/service/technicians/technician-1/certification",
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }
  ) as never
}

function createContext() {
  return {
    params: Promise.resolve({
      userId: "technician-1",
    }),
  }
}

function createTechnicianMembership() {
  return {
    user: {
      id: "technician-1",
      certificationNumber: null,
      certificationIssuer: null,
      certificationValidUntil: null,
      certificationCategory: null,
      memberships: [
        {
          id: "company-membership-1",
          certificationNumber: null,
          certificationOrganization: null,
          certificationValidUntil: null,
        },
      ],
    },
  }
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
      findFirst: vi.fn().mockResolvedValue({
        id: "company-membership-1",
        certificationNumber: null,
        certificationOrganization: null,
        certificationValidUntil: null,
      }),
      update: vi.fn().mockResolvedValue({
        id: "company-membership-1",
        certificationNumber: "PCERT-1",
        certificationOrganization: "INCERT",
        certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
      }),
    },
    user: {
      update: vi.fn().mockResolvedValue({
        id: "technician-1",
        certificationNumber: "PCERT-1",
        certificationIssuer: "INCERT",
        certificationValidUntil: new Date("2027-01-01T00:00:00.000Z"),
        certificationCategory: "Kategori I",
      }),
    },
  }
}

function createCertificationRecord(overrides = {}) {
  return {
    id: "cert-record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    userId: "technician-1",
    subjectType: "TECHNICIAN",
    certificateType: "PERSONAL_FGAS",
    certificateNumber: "PCERT-1",
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
