import { describe, expect, it } from "vitest"
import {
  buildLegacyServicePartnerCompanyCertificationRecordData,
  buildServiceOrganizationCompanyFgasCertificationRecordData,
  calculateCertificationRecordStatus,
  normalizeCertificateNumber,
  selectActiveCompanyFgasCertificate,
} from "@/lib/certifications"

describe("certification helpers", () => {
  it("normalizes certificate numbers without changing meaningful characters", () => {
    expect(normalizeCertificateNumber("  FGAS  123-AB  ")).toBe("FGAS 123-AB")
    expect(normalizeCertificateNumber("   ")).toBeNull()
    expect(normalizeCertificateNumber(null)).toBeNull()
  })

  it("calculates certification status from active record data", () => {
    const today = new Date("2026-06-01T00:00:00.000Z")

    expect(
      calculateCertificationRecordStatus({
        certificateNumber: "CERT-1",
        today,
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
      }).status
    ).toBe("VALID")
    expect(
      calculateCertificationRecordStatus({
        certificateNumber: "CERT-1",
        today,
        validUntil: new Date("2026-06-15T00:00:00.000Z"),
      }).status
    ).toBe("EXPIRING_SOON")
    expect(
      calculateCertificationRecordStatus({
        certificateNumber: "CERT-1",
        today,
        validUntil: new Date("2026-05-31T00:00:00.000Z"),
      }).status
    ).toBe("EXPIRED")
    expect(
      calculateCertificationRecordStatus({
        certificateNumber: null,
        today,
      }).status
    ).toBe("MISSING")
    expect(
      calculateCertificationRecordStatus({
        certificateNumber: "CERT-1",
        status: "REVOKED",
        today,
      }).status
    ).toBe("INACTIVE")
  })

  it("maps service organization certificate data to a company F-gas certification record", () => {
    expect(
      buildServiceOrganizationCompanyFgasCertificationRecordData({
        companyId: "company-1",
        createdByUserId: "user-1",
        serviceOrganization: {
          id: "service-org-1",
          certificateNumber: " FCERT-123 ",
        },
      })
    ).toEqual({
      companyId: "company-1",
      serviceOrganizationId: "service-org-1",
      userId: null,
      subjectType: "SERVICE_ORGANIZATION",
      certificateType: "COMPANY_FGAS",
      certificateNumber: "FCERT-123",
      issuer: null,
      category: null,
      validFrom: null,
      validUntil: null,
      status: "ACTIVE",
      verificationStatus: "SELF_DECLARED",
      verifiedAt: null,
      verifiedByUserId: null,
      documentId: null,
      notes: null,
      createdByUserId: "user-1",
      updatedByUserId: "user-1",
    })
  })

  it("maps bridged legacy servicepartner company certificate data", () => {
    expect(
      buildLegacyServicePartnerCompanyCertificationRecordData({
        legacyCompany: {
          companyId: "company-1",
          serviceOrganizationId: "service-org-1",
          certificateNumber: "LEGACY-1",
        },
      })
    ).toMatchObject({
      companyId: "company-1",
      serviceOrganizationId: "service-org-1",
      subjectType: "SERVICE_ORGANIZATION",
      certificateType: "COMPANY_FGAS",
      certificateNumber: "LEGACY-1",
    })
    expect(
      buildLegacyServicePartnerCompanyCertificationRecordData({
        legacyCompany: {
          companyId: "company-1",
          serviceOrganizationId: null,
          certificateNumber: "LEGACY-1",
        },
      })
    ).toBeNull()
  })

  it("chooses the best active company F-gas certificate", () => {
    const selected = selectActiveCompanyFgasCertificate(
      [
        createRecord({
          id: "expired",
          certificateNumber: "OLD",
          validUntil: new Date("2026-05-01"),
        }),
        createRecord({
          id: "valid",
          certificateNumber: "NEW",
          validUntil: new Date("2027-01-01"),
        }),
        createRecord({
          id: "deleted",
          certificateNumber: "DELETED",
          status: "DELETED",
          validUntil: new Date("2028-01-01"),
        }),
      ],
      new Date("2026-06-01")
    )

    expect(selected?.id).toBe("valid")
  })
})

function createRecord(
  overrides: Partial<Parameters<typeof selectActiveCompanyFgasCertificate>[0][number]>
) {
  return {
    id: "record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    subjectType: "SERVICE_ORGANIZATION" as const,
    certificateType: "COMPANY_FGAS" as const,
    certificateNumber: "CERT-1",
    status: "ACTIVE" as const,
    verificationStatus: "SELF_DECLARED" as const,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  }
}
