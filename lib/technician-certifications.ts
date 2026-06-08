import type {
  CertificationRecordStatus,
  CertificationVerificationStatus,
} from "@prisma/client"
import {
  calculateCertificationRecordStatus,
  normalizeCertificateNumber,
  type CertificationRecordLike,
} from "@/lib/certifications"

export type TechnicianCertificationStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "MISSING"
  | "VALIDITY_MISSING"
  | "INACTIVE"

export type TechnicianCertificationStatusResult = {
  status: TechnicianCertificationStatus
  label: string
  variant: "success" | "warning" | "danger" | "neutral"
}

export type TechnicianCertification = {
  certificateNumber: string | null
  issuer: string | null
  category: string | null
  validFrom: Date | string | null
  validUntil: Date | string | null
  status: TechnicianCertificationStatusResult
  source: "CERTIFICATION_RECORD" | "USER_LEGACY" | "MEMBERSHIP_LEGACY" | "NONE"
}

export type TechnicianUserLegacyCertificationSource = {
  id?: string
  certificationNumber?: string | null
  certificationIssuer?: string | null
  certificationValidUntil?: Date | string | null
  certificationCategory?: string | null
}

export type TechnicianMembershipLegacyCertificationSource = {
  id?: string
  certificationNumber?: string | null
  certificationOrganization?: string | null
  certificationValidUntil?: Date | string | null
}

export type TechnicianCertificationInput = {
  certificateNumber?: string | null
  issuer?: string | null
  category?: string | null
  validUntil?: Date | string | null
}

export type TechnicianCertificationRecordLike = CertificationRecordLike & {
  userId?: string | null
  validFrom?: Date | string | null
  validUntil?: Date | string | null
}

export type TechnicianCertificationPersistenceClient = {
  certificationRecord: {
    create(args: unknown): Promise<TechnicianCertificationRecordLike>
    findMany(args: unknown): Promise<TechnicianCertificationRecordLike[]>
    findFirst(args: unknown): Promise<{ id: string } | null>
    update(args: unknown): Promise<TechnicianCertificationRecordLike>
    updateMany(args: unknown): Promise<unknown>
  }
  companyMembership: {
    findFirst(args: unknown): Promise<TechnicianMembershipLegacyCertificationSource | null>
    update(args: unknown): Promise<TechnicianMembershipLegacyCertificationSource>
  }
  user: {
    findUnique(args: unknown): Promise<TechnicianUserLegacyCertificationSource | null>
    update(args: unknown): Promise<TechnicianUserLegacyCertificationSource>
  }
}

export function buildTechnicianCertification({
  membership,
  records = [],
  today = new Date(),
  user,
}: {
  membership?: TechnicianMembershipLegacyCertificationSource | null
  records?: CertificationRecordLike[]
  today?: Date
  user?: TechnicianUserLegacyCertificationSource | null
}): TechnicianCertification {
  const record = selectActiveTechnicianCertificate(records, today)
  if (record) {
    return {
      certificateNumber: record.certificateNumber,
      issuer: record.issuer ?? null,
      category: record.category ?? null,
      validFrom: record.validFrom ?? null,
      validUntil: record.validUntil ?? null,
      status: normalizeTechnicianCertificationStatus(
        calculateCertificationRecordStatus({
          certificateNumber: record.certificateNumber,
          status: record.status,
          today,
          validUntil: record.validUntil,
        }),
        {
          certificateNumber: record.certificateNumber,
          validUntil: record.validUntil,
        }
      ),
      source: "CERTIFICATION_RECORD",
    }
  }

  const userCertificateNumber = normalizeCertificateNumber(
    user?.certificationNumber
  )
  if (userCertificateNumber) {
    return {
      certificateNumber: userCertificateNumber,
      issuer: user?.certificationIssuer ?? null,
      category: user?.certificationCategory ?? null,
      validFrom: null,
      validUntil: user?.certificationValidUntil ?? null,
      status: normalizeTechnicianCertificationStatus(
        calculateCertificationRecordStatus({
          certificateNumber: userCertificateNumber,
          today,
          validUntil: user?.certificationValidUntil ?? null,
        }),
        {
          certificateNumber: userCertificateNumber,
          validUntil: user?.certificationValidUntil ?? null,
        }
      ),
      source: "USER_LEGACY",
    }
  }

  const membershipCertificateNumber = normalizeCertificateNumber(
    membership?.certificationNumber
  )
  if (membershipCertificateNumber) {
    return {
      certificateNumber: membershipCertificateNumber,
      issuer: membership?.certificationOrganization ?? null,
      category: null,
      validFrom: null,
      validUntil: membership?.certificationValidUntil ?? null,
      status: normalizeTechnicianCertificationStatus(
        calculateCertificationRecordStatus({
          certificateNumber: membershipCertificateNumber,
          today,
          validUntil: membership?.certificationValidUntil ?? null,
        }),
        {
          certificateNumber: membershipCertificateNumber,
          validUntil: membership?.certificationValidUntil ?? null,
        }
      ),
      source: "MEMBERSHIP_LEGACY",
    }
  }

  return {
    certificateNumber: null,
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: null,
    status: {
      status: "MISSING",
      label: "Saknas",
      variant: "neutral",
    },
    source: "NONE",
  }
}

export async function readTechnicianPersonalFgasCertification({
  companyId,
  membershipId,
  prisma,
  serviceOrganizationId,
  userId,
}: {
  companyId: string
  membershipId: string
  prisma: Pick<
    TechnicianCertificationPersistenceClient,
    "certificationRecord" | "companyMembership" | "user"
  >
  serviceOrganizationId: string
  userId: string
}) {
  const [records, user, membership] = await Promise.all([
    prisma.certificationRecord.findMany({
      where: {
        companyId,
        serviceOrganizationId,
        userId,
        subjectType: "TECHNICIAN",
        certificateType: "PERSONAL_FGAS",
        status: {
          not: "DELETED",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: userTechnicianCertificationSelect,
    }),
    prisma.companyMembership.findFirst({
      where: {
        id: membershipId,
        companyId,
        userId,
        role: "CONTRACTOR",
        isActive: true,
      },
      select: membershipTechnicianCertificationSelect,
    }),
  ])

  return buildTechnicianCertification({
    membership,
    records,
    user,
  })
}

export async function upsertTechnicianPersonalFgasCertification({
  companyId,
  input,
  membershipId,
  prisma,
  serviceOrganizationId,
  updatedByUserId,
  userId,
}: {
  companyId: string
  input: TechnicianCertificationInput
  membershipId: string
  prisma: TechnicianCertificationPersistenceClient
  serviceOrganizationId: string
  updatedByUserId: string
  userId: string
}) {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      id: membershipId,
      companyId,
      userId,
      role: "CONTRACTOR",
      isActive: true,
    },
    select: membershipTechnicianCertificationSelect,
  })

  if (!membership?.id) {
    throw new Error("Teknikern saknar aktiv medlemskoppling till servicepartnern.")
  }

  if (!normalizeCertificateNumber(input.certificateNumber)) {
    await prisma.certificationRecord.updateMany({
      where: {
        companyId,
        serviceOrganizationId,
        userId,
        subjectType: "TECHNICIAN",
        certificateType: "PERSONAL_FGAS",
        status: {
          notIn: ["DELETED", "REVOKED", "REPLACED"],
        },
      },
      data: {
        status: "DELETED",
        updatedByUserId,
      },
    })

    const [updatedUser, updatedMembership] = await Promise.all([
      prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          certificationNumber: null,
          certificationIssuer: null,
          certificationValidUntil: null,
          certificationCategory: null,
        },
        select: userTechnicianCertificationSelect,
      }),
      prisma.companyMembership.update({
        where: {
          id: membership.id,
        },
        data: {
          isCertifiedCompany: false,
          certificationNumber: null,
          certificationOrganization: null,
          certificationValidUntil: null,
        },
        select: membershipTechnicianCertificationSelect,
      }),
    ])

    return buildTechnicianCertification({
      membership: updatedMembership,
      records: [],
      user: updatedUser,
    })
  }

  const existingRecord = await prisma.certificationRecord.findFirst({
    where: {
      companyId,
      serviceOrganizationId,
      userId,
      subjectType: "TECHNICIAN",
      certificateType: "PERSONAL_FGAS",
      status: {
        notIn: ["DELETED", "REVOKED", "REPLACED"],
      },
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const recordData = buildTechnicianPersonalFgasCertificationRecordData({
    category: input.category,
    certificateNumber: input.certificateNumber,
    companyId,
    createdByUserId: updatedByUserId,
    issuer: input.issuer,
    serviceOrganizationId,
    userId,
    validUntil: input.validUntil,
  })

  if (!recordData) {
    throw new Error("Certifikatnummer saknas.")
  }

  const certificationRecord = existingRecord
    ? await prisma.certificationRecord.update({
        where: {
          id: existingRecord.id,
        },
        data: {
          certificateNumber: recordData.certificateNumber,
          issuer: recordData.issuer,
          category: recordData.category,
          validUntil: recordData.validUntil,
          status: "ACTIVE",
          verificationStatus: "SELF_DECLARED",
          updatedByUserId,
        },
      })
    : await prisma.certificationRecord.create({
        data: recordData,
      })

  const [updatedUser, updatedMembership] = await Promise.all([
    prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        certificationNumber: recordData.certificateNumber,
        certificationIssuer: recordData.issuer,
        certificationValidUntil: recordData.validUntil,
        certificationCategory: recordData.category,
      },
      select: userTechnicianCertificationSelect,
    }),
    prisma.companyMembership.update({
      where: {
        id: membership.id,
      },
      data: {
        isCertifiedCompany: true,
        certificationNumber: recordData.certificateNumber,
        certificationOrganization: recordData.issuer,
        certificationValidUntil: recordData.validUntil,
      },
      select: membershipTechnicianCertificationSelect,
    }),
  ])

  return buildTechnicianCertification({
    membership: updatedMembership,
    records: [certificationRecord],
    user: updatedUser,
  })
}

export function toTechnicianCertificationResponse(
  certification: TechnicianCertification
) {
  return {
    certificateNumber: certification.certificateNumber,
    issuer: certification.issuer,
    category: certification.category,
    validUntil: certification.validUntil,
    status: certification.status,
    source: getTechnicianCertificationSourceLabel(certification.source),
  }
}

export function getTechnicianCertificationSourceLabel(
  source: TechnicianCertification["source"]
) {
  switch (source) {
    case "CERTIFICATION_RECORD":
      return "CertificationRecord"
    case "USER_LEGACY":
      return "User legacy"
    case "MEMBERSHIP_LEGACY":
      return "CompanyMembership legacy"
    case "NONE":
      return "none"
  }
}

export function selectActiveTechnicianCertificate(
  records: CertificationRecordLike[],
  today = new Date()
) {
  const activeRecords = records
    .filter(
      (record) =>
        record.subjectType === "TECHNICIAN" &&
        record.certificateType === "PERSONAL_FGAS" &&
        record.status !== "DELETED" &&
        record.status !== "REVOKED" &&
        record.status !== "REPLACED"
    )
    .filter((record) => normalizeCertificateNumber(record.certificateNumber))

  return activeRecords.sort((first, second) =>
    compareTechnicianCertificates(first, second, today)
  )[0] ?? null
}

export function buildTechnicianPersonalFgasCertificationRecordData({
  category = null,
  companyId,
  createdByUserId = null,
  issuer = null,
  serviceOrganizationId = null,
  userId,
  validFrom = null,
  validUntil = null,
  certificateNumber,
}: {
  category?: string | null
  companyId: string
  createdByUserId?: string | null
  issuer?: string | null
  serviceOrganizationId?: string | null
  userId: string
  validFrom?: Date | string | null
  validUntil?: Date | string | null
  certificateNumber?: string | null
}) {
  const normalizedCertificateNumber = normalizeCertificateNumber(certificateNumber)
  if (!normalizedCertificateNumber) return null

  return {
    companyId,
    serviceOrganizationId,
    userId,
    subjectType: "TECHNICIAN" as const,
    certificateType: "PERSONAL_FGAS" as const,
    certificateNumber: normalizedCertificateNumber,
    issuer: normalizeOptionalText(issuer),
    category: normalizeOptionalText(category),
    validFrom: normalizeOptionalDate(validFrom),
    validUntil: normalizeOptionalDate(validUntil),
    status: "ACTIVE" as CertificationRecordStatus,
    verificationStatus: "SELF_DECLARED" as CertificationVerificationStatus,
    verifiedAt: null,
    verifiedByUserId: null,
    documentId: null,
    notes: null,
    createdByUserId,
    updatedByUserId: createdByUserId,
  }
}

function normalizeTechnicianCertificationStatus(
  status: ReturnType<typeof calculateCertificationRecordStatus>,
  source: {
    certificateNumber?: string | null
    validUntil?: Date | string | null
  }
): TechnicianCertificationStatusResult {
  if (source.certificateNumber && !source.validUntil) {
    return {
      status: "VALIDITY_MISSING",
      label: "Giltighet saknas",
      variant: "warning",
    }
  }

  switch (status.status) {
    case "VALID":
      return {
        ...status,
        label: "Giltigt",
      }
    case "EXPIRING_SOON":
      return {
        ...status,
        label: "Går snart ut",
      }
    case "EXPIRED":
      return {
        ...status,
        label: "Utgått",
      }
    case "MISSING":
      return {
        ...status,
        label: "Saknas",
      }
    case "INACTIVE":
      return {
        ...status,
        label: "Saknas",
      }
  }
}

function compareTechnicianCertificates(
  first: CertificationRecordLike,
  second: CertificationRecordLike,
  today: Date
) {
  const firstStatus = normalizeTechnicianCertificationStatus(
    calculateCertificationRecordStatus({
      certificateNumber: first.certificateNumber,
      status: first.status,
      today,
      validUntil: first.validUntil,
    }),
    first
  ).status
  const secondStatus = normalizeTechnicianCertificationStatus(
    calculateCertificationRecordStatus({
      certificateNumber: second.certificateNumber,
      status: second.status,
      today,
      validUntil: second.validUntil,
    }),
    second
  ).status
  const firstRank = technicianStatusRank(firstStatus)
  const secondRank = technicianStatusRank(secondStatus)
  if (firstRank !== secondRank) return firstRank - secondRank

  const firstValidUntil = timestampOrMax(first.validUntil)
  const secondValidUntil = timestampOrMax(second.validUntil)
  if (firstValidUntil !== secondValidUntil) {
    return secondValidUntil - firstValidUntil
  }

  return timestampOrZero(second.createdAt) - timestampOrZero(first.createdAt)
}

function technicianStatusRank(status: TechnicianCertificationStatus) {
  switch (status) {
    case "VALID":
      return 0
    case "EXPIRING_SOON":
      return 1
    case "VALIDITY_MISSING":
      return 2
    case "EXPIRED":
      return 3
    case "MISSING":
      return 4
    case "INACTIVE":
      return 5
  }
}

function normalizeOptionalText(value?: string | null) {
  const trimmedValue = value?.trim()
  return trimmedValue || null
}

function normalizeOptionalDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

const userTechnicianCertificationSelect = {
  id: true,
  certificationNumber: true,
  certificationIssuer: true,
  certificationValidUntil: true,
  certificationCategory: true,
}

const membershipTechnicianCertificationSelect = {
  id: true,
  certificationNumber: true,
  certificationOrganization: true,
  certificationValidUntil: true,
}

function timestampOrMax(value?: Date | string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER
}

function timestampOrZero(value?: Date | string | null) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.getTime() : 0
}
