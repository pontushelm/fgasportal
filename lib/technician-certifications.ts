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
