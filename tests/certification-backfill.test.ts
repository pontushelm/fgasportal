import { describe, expect, it, vi } from "vitest"
import { backfillCertificationRecords } from "@/scripts/backfill-certification-records"

describe("certification record backfill script", () => {
  it("creates company F-gas records from service organization certificates", async () => {
    const prisma = createFakePrisma({
      serviceOrganizations: [
        {
          id: "service-org-1",
          certificateNumber: "FCERT-1",
          companyLinks: [{ companyId: "company-1" }],
        },
      ],
    })

    const summary = await backfillCertificationRecords(prisma, { dryRun: false })

    expect(summary.serviceOrganizationsScanned).toBe(1)
    expect(summary.legacyCertificatesFound).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        serviceOrganizationId: "service-org-1",
        subjectType: "SERVICE_ORGANIZATION",
        certificateType: "COMPANY_FGAS",
        certificateNumber: "FCERT-1",
        status: "ACTIVE",
        verificationStatus: "SELF_DECLARED",
      }),
    })
  })

  it("is idempotent when an equivalent certification record exists", async () => {
    const prisma = createFakePrisma({
      existingRecordKeys: new Set(["company-1|service-org-1|FCERT-1"]),
      serviceOrganizations: [
        {
          id: "service-org-1",
          certificateNumber: "FCERT-1",
          companyLinks: [{ companyId: "company-1" }],
        },
      ],
    })

    const summary = await backfillCertificationRecords(prisma, { dryRun: false })

    expect(summary.alreadyRepresented).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(0)
    expect(prisma.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("backfills bridged legacy servicepartner company certificates", async () => {
    const prisma = createFakePrisma({
      servicePartnerCompanies: [
        {
          id: "legacy-spc-1",
          companyId: "company-1",
          serviceOrganizationId: "service-org-1",
          certificateNumber: "LEGACY-1",
        },
      ],
    })

    const summary = await backfillCertificationRecords(prisma, { dryRun: false })

    expect(summary.servicePartnerCompaniesScanned).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        serviceOrganizationId: "service-org-1",
        certificateNumber: "LEGACY-1",
      }),
    })
  })

  it("skips legacy servicepartner companies without a service organization bridge", async () => {
    const prisma = createFakePrisma({
      servicePartnerCompanies: [
        {
          id: "legacy-spc-1",
          companyId: "company-1",
          serviceOrganizationId: null,
          certificateNumber: "LEGACY-1",
        },
      ],
    })

    const summary = await backfillCertificationRecords(prisma, { dryRun: false })

    expect(summary.skipped).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(0)
    expect(prisma.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("does not write in dry-run mode", async () => {
    const prisma = createFakePrisma({
      serviceOrganizations: [
        {
          id: "service-org-1",
          certificateNumber: "FCERT-1",
          companyLinks: [{ companyId: "company-1" }],
        },
      ],
    })

    const summary = await backfillCertificationRecords(prisma)

    expect(summary.dryRun).toBe(true)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).not.toHaveBeenCalled()
  })
})

function createFakePrisma({
  existingRecordKeys = new Set<string>(),
  serviceOrganizations = [],
  servicePartnerCompanies = [],
}: {
  existingRecordKeys?: Set<string>
  serviceOrganizations?: Array<{
    id: string
    certificateNumber: string | null
    companyLinks: Array<{ companyId: string }>
  }>
  servicePartnerCompanies?: Array<{
    id: string
    companyId: string
    serviceOrganizationId: string | null
    certificateNumber: string | null
  }>
}) {
  return {
    certificationRecord: {
      create: vi.fn().mockResolvedValue({ id: "certification-record-1" }),
      findFirst: vi.fn((args) => {
        const where = args.where
        const key = `${where.companyId}|${where.serviceOrganizationId}|${where.certificateNumber}`
        return Promise.resolve(
          existingRecordKeys.has(key) ? { id: "existing-record" } : null
        )
      }),
    },
    serviceOrganization: {
      findMany: vi.fn().mockResolvedValue(serviceOrganizations),
    },
    servicePartnerCompany: {
      findMany: vi.fn().mockResolvedValue(servicePartnerCompanies),
    },
  }
}
