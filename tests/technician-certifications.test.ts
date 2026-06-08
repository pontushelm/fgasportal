import { describe, expect, it } from "vitest"
import {
  buildTechnicianCertification,
  buildTechnicianPersonalFgasCertificationRecordData,
  selectActiveTechnicianCertificate,
} from "@/lib/technician-certifications"

describe("technician certification helpers", () => {
  it("prefers active CertificationRecord over legacy user and membership fields", () => {
    const certification = buildTechnicianCertification({
      records: [
        createTechnicianRecord({
          certificateNumber: "REC-1",
          issuer: "INCERT",
          validUntil: new Date("2027-01-01"),
        }),
      ],
      user: {
        certificationNumber: "USER-1",
        certificationIssuer: "Legacy user issuer",
        certificationValidUntil: new Date("2028-01-01"),
      },
      membership: {
        certificationNumber: "MEMBER-1",
        certificationOrganization: "Legacy membership issuer",
        certificationValidUntil: new Date("2029-01-01"),
      },
      today: new Date("2026-06-01"),
    })

    expect(certification.source).toBe("CERTIFICATION_RECORD")
    expect(certification.certificateNumber).toBe("REC-1")
    expect(certification.issuer).toBe("INCERT")
    expect(certification.status.status).toBe("VALID")
  })

  it("prefers user legacy fields over company membership legacy fields", () => {
    const certification = buildTechnicianCertification({
      user: {
        certificationNumber: "USER-1",
        certificationIssuer: "User issuer",
        certificationCategory: "Kategori I",
        certificationValidUntil: new Date("2027-01-01"),
      },
      membership: {
        certificationNumber: "MEMBER-1",
        certificationOrganization: "Membership issuer",
        certificationValidUntil: new Date("2028-01-01"),
      },
      today: new Date("2026-06-01"),
    })

    expect(certification.source).toBe("USER_LEGACY")
    expect(certification.certificateNumber).toBe("USER-1")
    expect(certification.issuer).toBe("User issuer")
    expect(certification.category).toBe("Kategori I")
  })

  it("falls back to membership legacy fields when no record or user certificate exists", () => {
    const certification = buildTechnicianCertification({
      user: {
        certificationNumber: null,
      },
      membership: {
        certificationNumber: " MEMBER-1 ",
        certificationOrganization: "Membership issuer",
        certificationValidUntil: new Date("2027-01-01"),
      },
      today: new Date("2026-06-01"),
    })

    expect(certification.source).toBe("MEMBERSHIP_LEGACY")
    expect(certification.certificateNumber).toBe("MEMBER-1")
    expect(certification.issuer).toBe("Membership issuer")
  })

  it("calculates technician status labels including missing validity", () => {
    const today = new Date("2026-06-01")

    expect(
      buildTechnicianCertification({
        records: [
          createTechnicianRecord({
            certificateNumber: "VALID-1",
            validUntil: new Date("2027-01-01"),
          }),
        ],
        today,
      }).status
    ).toMatchObject({ status: "VALID", label: "Giltigt" })

    expect(
      buildTechnicianCertification({
        records: [
          createTechnicianRecord({
            certificateNumber: "SOON-1",
            validUntil: new Date("2026-06-15"),
          }),
        ],
        today,
      }).status
    ).toMatchObject({ status: "EXPIRING_SOON", label: "Går snart ut" })

    expect(
      buildTechnicianCertification({
        records: [
          createTechnicianRecord({
            certificateNumber: "OLD-1",
            validUntil: new Date("2026-05-01"),
          }),
        ],
        today,
      }).status
    ).toMatchObject({ status: "EXPIRED", label: "Utgått" })

    expect(
      buildTechnicianCertification({
        records: [
          createTechnicianRecord({
            certificateNumber: "NO-DATE-1",
            validUntil: null,
          }),
        ],
        today,
      }).status
    ).toMatchObject({ status: "VALIDITY_MISSING", label: "Giltighet saknas" })

    expect(buildTechnicianCertification({ today }).status).toMatchObject({
      status: "MISSING",
      label: "Saknas",
    })
  })

  it("selects the best active technician personal F-gas certificate", () => {
    const selected = selectActiveTechnicianCertificate(
      [
        createTechnicianRecord({
          id: "expired",
          certificateNumber: "OLD",
          validUntil: new Date("2026-05-01"),
        }),
        createTechnicianRecord({
          id: "valid",
          certificateNumber: "NEW",
          validUntil: new Date("2027-01-01"),
        }),
        createTechnicianRecord({
          id: "company-cert",
          subjectType: "SERVICE_ORGANIZATION",
          certificateType: "COMPANY_FGAS",
          certificateNumber: "COMPANY",
          validUntil: new Date("2028-01-01"),
        }),
      ],
      new Date("2026-06-01")
    )

    expect(selected?.id).toBe("valid")
  })

  it("builds CertificationRecord data for technician personal F-gas certificates", () => {
    expect(
      buildTechnicianPersonalFgasCertificationRecordData({
        category: " Kategori I ",
        certificateNumber: " PCERT  123 ",
        companyId: "company-1",
        issuer: " INCERT ",
        serviceOrganizationId: "service-org-1",
        userId: "user-1",
        validUntil: "2027-01-01",
      })
    ).toEqual({
      companyId: "company-1",
      serviceOrganizationId: "service-org-1",
      userId: "user-1",
      subjectType: "TECHNICIAN",
      certificateType: "PERSONAL_FGAS",
      certificateNumber: "PCERT 123",
      issuer: "INCERT",
      category: "Kategori I",
      validFrom: null,
      validUntil: new Date("2027-01-01"),
      status: "ACTIVE",
      verificationStatus: "SELF_DECLARED",
      verifiedAt: null,
      verifiedByUserId: null,
      documentId: null,
      notes: null,
      createdByUserId: null,
      updatedByUserId: null,
    })
  })
})

function createTechnicianRecord(overrides = {}) {
  return {
    id: "record-1",
    companyId: "company-1",
    serviceOrganizationId: "service-org-1",
    userId: "user-1",
    subjectType: "TECHNICIAN" as const,
    certificateType: "PERSONAL_FGAS" as const,
    certificateNumber: "CERT-1",
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: null,
    status: "ACTIVE" as const,
    verificationStatus: "SELF_DECLARED" as const,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  }
}
