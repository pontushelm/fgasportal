import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const authenticateApiRequest = vi.fn()
const ensureServiceOrganizationForLegacyCompany = vi.fn()
const servicePartnerCompanyFindFirst = vi.fn()
const certificationRecordFindMany = vi.fn()
const transaction = vi.fn()
const logActivity = vi.fn()

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")

  return {
    ...actual,
    authenticateApiRequest,
    forbiddenResponse: () =>
      NextResponse.json({ error: "Behorighet saknas" }, { status: 403 }),
  }
})

vi.mock("@/lib/activity-log", () => ({
  logActivity,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transaction,
    certificationRecord: {
      findMany: certificationRecordFindMany,
    },
    servicePartnerCompany: {
      findFirst: servicePartnerCompanyFindFirst,
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

const authUser = {
  userId: "service-admin-1",
  membershipId: "membership-1",
  companyId: "company-1",
  role: "CONTRACTOR",
  servicePartnerCompanyId: "spc-1",
  isServicePartnerAdmin: true,
}

const legacyCompany = {
  id: "spc-1",
  companyId: "company-1",
  serviceOrganizationId: "service-org-1",
  name: "Kyl AB",
  organizationNumber: "556000-0000",
  contactEmail: "kontakt@kyl.example",
  phone: "010-100 10 10",
  certificateNumber: "LEGACY-1",
  serviceOrganization: {
    id: "service-org-1",
    name: "Kyl AB",
    organizationNumber: "556000-0000",
    contactEmail: "kontakt@kyl.example",
    phone: "010-100 10 10",
    certificateNumber: "LEGACY-1",
  },
}

describe("servicepartner company certification settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateApiRequest.mockResolvedValue({ user: authUser })
    ensureServiceOrganizationForLegacyCompany.mockResolvedValue({
      legacyServicePartnerCompanyId: "spc-1",
      serviceOrganizationId: "service-org-1",
    })
    servicePartnerCompanyFindFirst.mockResolvedValue(legacyCompany)
    certificationRecordFindMany.mockResolvedValue([])
    logActivity.mockResolvedValue(undefined)
  })

  it("reads active CertificationRecord before legacy certificate fields", async () => {
    const { GET } = await import("@/app/api/dashboard/service/company/route")
    certificationRecordFindMany.mockResolvedValueOnce([
      createCertificationRecord({
        certificateNumber: "CERT-2026",
        issuer: "Incert",
        validUntil: new Date("2027-01-31T00:00:00.000Z"),
      }),
    ])

    const response = await GET(createRequest("GET"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.certificateNumber).toBe("CERT-2026")
    expect(body.certification).toMatchObject({
      certificateNumber: "CERT-2026",
      issuer: "Incert",
      source: "CERTIFICATION_RECORD",
    })
    expect(body.certification.validUntil).toBe("2027-01-31T00:00:00.000Z")
  })

  it("falls back to legacy certificate fields when no CertificationRecord exists", async () => {
    const { GET } = await import("@/app/api/dashboard/service/company/route")

    const response = await GET(createRequest("GET"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.certificateNumber).toBe("LEGACY-1")
    expect(body.certification).toMatchObject({
      certificateNumber: "LEGACY-1",
      issuer: null,
      source: "LEGACY",
    })
  })

  it("creates CertificationRecord and syncs legacy certificate fields on write", async () => {
    const { PATCH } = await import("@/app/api/dashboard/service/company/route")
    const tx = createTransactionClient({
      certificationRecordFindFirst: vi.fn().mockResolvedValue(null),
      certificationRecordCreate: vi.fn().mockResolvedValue(
        createCertificationRecord({
          certificateNumber: " CERT-NEW ",
          issuer: "Incert",
          validUntil: new Date("2027-03-01T00:00:00.000Z"),
        })
      ),
    })
    transaction.mockImplementation((callback) => callback(tx))

    const response = await PATCH(
      createRequest(
        "PATCH",
        JSON.stringify({
          name: "Kyl AB",
          contactEmail: "kontakt@kyl.example",
          phone: "010-100 10 10",
          certificateNumber: " CERT-NEW ",
          certificateIssuer: "Incert",
          certificateValidUntil: "2027-03-01",
        })
      )
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(tx.serviceOrganization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificateNumber: "CERT-NEW",
        }),
      })
    )
    expect(tx.servicePartnerCompany.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          certificateNumber: "CERT-NEW",
        }),
      })
    )
    expect(tx.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        certificateNumber: "CERT-NEW",
        certificateType: "COMPANY_FGAS",
        companyId: "company-1",
        issuer: "Incert",
        serviceOrganizationId: "service-org-1",
        subjectType: "SERVICE_ORGANIZATION",
        updatedByUserId: "service-admin-1",
        verificationStatus: "SELF_DECLARED",
      }),
    })
    expect(body.certification.source).toBe("CERTIFICATION_RECORD")
  })

  it("updates an existing CertificationRecord on write", async () => {
    const { PATCH } = await import("@/app/api/dashboard/service/company/route")
    const tx = createTransactionClient({
      certificationRecordFindFirst: vi.fn().mockResolvedValue({
        id: "cert-record-1",
      }),
      certificationRecordUpdate: vi.fn().mockResolvedValue(
        createCertificationRecord({
          id: "cert-record-1",
          certificateNumber: "CERT-UPDATED",
        })
      ),
    })
    transaction.mockImplementation((callback) => callback(tx))

    const response = await PATCH(
      createRequest(
        "PATCH",
        JSON.stringify({
          name: "Kyl AB",
          contactEmail: "",
          phone: "",
          certificateNumber: "CERT-UPDATED",
          certificateIssuer: "",
          certificateValidUntil: "",
        })
      )
    )

    expect(response.status).toBe(200)
    expect(tx.certificationRecord.update).toHaveBeenCalledWith({
      where: {
        id: "cert-record-1",
      },
      data: expect.objectContaining({
        certificateNumber: "CERT-UPDATED",
        verificationStatus: "SELF_DECLARED",
      }),
    })
    expect(tx.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("does not allow servicepartner technicians to edit company certification", async () => {
    const { PATCH } = await import("@/app/api/dashboard/service/company/route")
    authenticateApiRequest.mockResolvedValueOnce({
      user: {
        ...authUser,
        isServicePartnerAdmin: false,
      },
    })

    const response = await PATCH(
      createRequest(
        "PATCH",
        JSON.stringify({
          name: "Kyl AB",
          certificateNumber: "CERT-1",
        })
      )
    )

    expect(response.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })
})

function createRequest(method: "GET" | "PATCH", body?: string) {
  return new Request("http://localhost/api/dashboard/service/company", {
    body,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method,
  }) as never
}

function createCertificationRecord(overrides = {}) {
  return {
    id: "cert-record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    userId: null,
    subjectType: "SERVICE_ORGANIZATION",
    certificateType: "COMPANY_FGAS",
    certificateNumber: "CERT-1",
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    status: "ACTIVE",
    verificationStatus: "SELF_DECLARED",
    verifiedAt: null,
    verifiedByUserId: null,
    documentId: null,
    notes: null,
    createdByUserId: "service-admin-1",
    updatedByUserId: "service-admin-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function createTransactionClient({
  certificationRecordCreate = vi.fn().mockResolvedValue(createCertificationRecord()),
  certificationRecordFindFirst = vi.fn().mockResolvedValue(null),
  certificationRecordUpdate = vi.fn().mockResolvedValue(createCertificationRecord()),
} = {}) {
  return {
    certificationRecord: {
      create: certificationRecordCreate,
      findFirst: certificationRecordFindFirst,
      update: certificationRecordUpdate,
    },
    serviceOrganization: {
      update: vi.fn().mockResolvedValue({
        id: "service-org-1",
        certificateNumber: "CERT-NEW",
      }),
    },
    servicePartnerCompany: {
      update: vi.fn().mockResolvedValue({
        ...legacyCompany,
        certificateNumber: "CERT-NEW",
        serviceOrganization: {
          ...legacyCompany.serviceOrganization,
          certificateNumber: "CERT-NEW",
        },
      }),
    },
  }
}
