import { describe, expect, it, vi } from "vitest"
import { backfillTechnicianCertifications } from "@/scripts/backfill-technician-certifications"

describe("technician certification backfill script", () => {
  it("creates technician CertificationRecord from user legacy fields", async () => {
    const prisma = createFakePrisma({
      memberships: [
        createMembership({
          user: {
            ...createMembership().user,
            certificationNumber: "USER-1",
            certificationIssuer: "INCERT",
            certificationCategory: "Kategori I",
            certificationValidUntil: new Date("2027-01-01"),
          },
        }),
      ],
    })

    const summary = await backfillTechnicianCertifications(prisma, {
      dryRun: false,
    })

    expect(summary.membershipsScanned).toBe(1)
    expect(summary.legacyUserCertificatesFound).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        userId: "user-1",
        serviceOrganizationId: "service-org-1",
        subjectType: "TECHNICIAN",
        certificateType: "PERSONAL_FGAS",
        certificateNumber: "USER-1",
        issuer: "INCERT",
        category: "Kategori I",
        validUntil: new Date("2027-01-01"),
        verificationStatus: "SELF_DECLARED",
      }),
    })
  })

  it("creates technician CertificationRecord from membership legacy fields", async () => {
    const prisma = createFakePrisma({
      memberships: [
        createMembership({
          certificationNumber: "MEMBER-1",
          certificationOrganization: "Kiwa",
          certificationValidUntil: new Date("2027-01-01"),
          user: {
            ...createMembership().user,
            certificationNumber: null,
          },
        }),
      ],
    })

    const summary = await backfillTechnicianCertifications(prisma, {
      dryRun: false,
    })

    expect(summary.legacyMembershipCertificatesFound).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        certificateNumber: "MEMBER-1",
        issuer: "Kiwa",
        category: null,
      }),
    })
  })

  it("is idempotent when an equivalent technician certificate exists", async () => {
    const prisma = createFakePrisma({
      existingRecordKeys: new Set(["company-1|user-1|service-org-1|USER-1"]),
      memberships: [
        createMembership({
          user: {
            ...createMembership().user,
            certificationNumber: "USER-1",
          },
        }),
      ],
    })

    const summary = await backfillTechnicianCertifications(prisma, {
      dryRun: false,
    })

    expect(summary.alreadyRepresented).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(0)
    expect(prisma.certificationRecord.create).not.toHaveBeenCalled()
  })

  it("does not duplicate the same certificate number from user and membership legacy sources", async () => {
    const prisma = createFakePrisma({
      memberships: [
        createMembership({
          certificationNumber: "SAME-1",
          user: {
            ...createMembership().user,
            certificationNumber: "SAME-1",
          },
        }),
      ],
    })

    const summary = await backfillTechnicianCertifications(prisma, {
      dryRun: false,
    })

    expect(summary.legacyUserCertificatesFound).toBe(1)
    expect(summary.legacyMembershipCertificatesFound).toBe(1)
    expect(summary.skipped).toBe(1)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).toHaveBeenCalledTimes(1)
  })

  it("resolves serviceOrganizationId from active service organization membership when bridge is missing", async () => {
    const prisma = createFakePrisma({
      memberships: [
        createMembership({
          servicePartnerCompany: null,
          user: {
            ...createMembership().user,
            certificationNumber: "USER-1",
            serviceOrganizationMemberships: [
              {
                serviceOrganizationId: "service-org-from-user",
                isActive: true,
              },
            ],
          },
        }),
      ],
    })

    await backfillTechnicianCertifications(prisma, { dryRun: false })

    expect(prisma.certificationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceOrganizationId: "service-org-from-user",
      }),
    })
  })

  it("does not write in dry-run mode", async () => {
    const prisma = createFakePrisma({
      memberships: [
        createMembership({
          user: {
            ...createMembership().user,
            certificationNumber: "USER-1",
          },
        }),
      ],
    })

    const summary = await backfillTechnicianCertifications(prisma)

    expect(summary.dryRun).toBe(true)
    expect(summary.certificationRecordsCreated).toBe(1)
    expect(prisma.certificationRecord.create).not.toHaveBeenCalled()
  })
})

function createFakePrisma({
  existingRecordKeys = new Set<string>(),
  memberships = [],
}: {
  existingRecordKeys?: Set<string>
  memberships?: ReturnType<typeof createMembership>[]
}) {
  return {
    certificationRecord: {
      create: vi.fn().mockResolvedValue({ id: "certification-record-1" }),
      findFirst: vi.fn((args) => {
        const where = args.where
        const key = `${where.companyId}|${where.userId}|${where.serviceOrganizationId}|${where.certificateNumber}`
        return Promise.resolve(
          existingRecordKeys.has(key) ? { id: "existing-record" } : null
        )
      }),
    },
    companyMembership: {
      findMany: vi.fn().mockResolvedValue(memberships),
    },
  }
}

function createMembership(overrides = {}) {
  return {
    id: "membership-1",
    userId: "user-1",
    companyId: "company-1",
    certificationNumber: null,
    certificationOrganization: null,
    certificationValidUntil: null,
    servicePartnerCompany: {
      serviceOrganizationId: "service-org-1",
    },
    user: {
      id: "user-1",
      certificationNumber: null,
      certificationIssuer: null,
      certificationValidUntil: null,
      certificationCategory: null,
      serviceOrganizationMemberships: [],
    },
    ...overrides,
  }
}
