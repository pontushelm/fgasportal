import { describe, expect, it } from "vitest"
import {
  buildServicePartnerCompanyCertification,
  isServicePartnerCompanyCertificationWarning,
} from "@/lib/service-partner-company-certifications"

describe("service partner company certification status", () => {
  it("prefers active CertificationRecord over legacy certificate fields", () => {
    const certification = buildServicePartnerCompanyCertification({
      company: {
        companyId: "customer-1",
        certificateNumber: "LEGACY-1",
        serviceOrganization: {
          certificateNumber: "ORG-LEGACY-1",
        },
      },
      records: [
        createRecord({
          certificateNumber: "CERT-2026",
          issuer: "Incert",
          validUntil: new Date("2027-01-01T00:00:00.000Z"),
        }),
      ],
      today: new Date("2026-06-01T00:00:00.000Z"),
    })

    expect(certification).toMatchObject({
      certificateNumber: "CERT-2026",
      issuer: "Incert",
      source: "CERTIFICATION_RECORD",
      status: {
        status: "VALID",
        label: "Giltigt",
      },
    })
  })

  it("falls back to legacy service organization certificate fields", () => {
    const certification = buildServicePartnerCompanyCertification({
      company: {
        companyId: "customer-1",
        certificateNumber: "LEGACY-COMPANY",
        serviceOrganization: {
          certificateNumber: "LEGACY-ORG",
        },
      },
      records: [],
    })

    expect(certification).toMatchObject({
      certificateNumber: "LEGACY-ORG",
      source: "LEGACY",
      status: {
        status: "MISSING",
        label: "Giltighet saknas",
      },
    })
  })

  it("marks missing certificates as missing", () => {
    const certification = buildServicePartnerCompanyCertification({
      company: {
        companyId: "customer-1",
        certificateNumber: null,
        serviceOrganization: null,
      },
      records: [],
    })

    expect(certification).toMatchObject({
      certificateNumber: null,
      status: {
        status: "MISSING",
        label: "Saknas",
      },
    })
    expect(isServicePartnerCompanyCertificationWarning(certification)).toBe(true)
  })

  it("marks expired certificates as warnings", () => {
    const certification = buildServicePartnerCompanyCertification({
      company: {
        companyId: "customer-1",
        certificateNumber: null,
      },
      records: [
        createRecord({
          certificateNumber: "CERT-OLD",
          validUntil: new Date("2026-05-31T00:00:00.000Z"),
        }),
      ],
      today: new Date("2026-06-01T00:00:00.000Z"),
    })

    expect(certification.status).toMatchObject({
      status: "EXPIRED",
      label: "Utgått",
      variant: "danger",
    })
    expect(isServicePartnerCompanyCertificationWarning(certification)).toBe(true)
  })
})

function createRecord(overrides = {}) {
  return {
    id: "cert-record-1",
    companyId: "customer-1",
    serviceOrganizationId: "service-org-1",
    subjectType: "SERVICE_ORGANIZATION" as const,
    certificateType: "COMPANY_FGAS" as const,
    certificateNumber: "CERT-1",
    issuer: null,
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    status: "ACTIVE" as const,
    verificationStatus: "SELF_DECLARED" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}
