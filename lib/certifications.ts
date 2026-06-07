import type {
  CertificationRecordStatus,
  CertificationSubjectType,
  CertificationType,
  CertificationVerificationStatus,
} from "@prisma/client"
import { getCertificationStatus } from "@/lib/certification-status"

export type CertificationStatusFromRecord =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "MISSING"
  | "INACTIVE"

export type CertificationRecordStatusResult = {
  status: CertificationStatusFromRecord
  label: string
  variant: "success" | "warning" | "danger" | "neutral"
}

export type CertificationRecordLike = {
  id?: string
  serviceOrganizationId?: string | null
  companyId: string
  subjectType: CertificationSubjectType
  certificateType: CertificationType
  certificateNumber: string
  issuer?: string | null
  category?: string | null
  validFrom?: Date | string | null
  validUntil?: Date | string | null
  status?: CertificationRecordStatus
  verificationStatus?: CertificationVerificationStatus
  createdAt?: Date | string
}

export type ServiceOrganizationCertificateSource = {
  id: string
  certificateNumber?: string | null
}

export type LegacyServicePartnerCompanyCertificateSource = {
  companyId: string
  serviceOrganizationId?: string | null
  certificateNumber?: string | null
}

export function normalizeCertificateNumber(value?: string | null) {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? ""
  return normalized || null
}

export function calculateCertificationRecordStatus({
  certificateNumber,
  status = "ACTIVE",
  today = new Date(),
  validUntil,
}: {
  certificateNumber?: string | null
  status?: CertificationRecordStatus
  today?: Date
  validUntil?: Date | string | null
}): CertificationRecordStatusResult {
  if (status !== "ACTIVE") {
    return {
      status: "INACTIVE",
      label: "Inaktiv",
      variant: "neutral",
    }
  }

  const normalizedCertificateNumber =
    normalizeCertificateNumber(certificateNumber)
  if (!normalizedCertificateNumber) {
    return {
      status: "MISSING",
      label: "Saknas",
      variant: "neutral",
    }
  }

  return getCertificationStatus({
    isCertifiedCompany: true,
    today,
    validUntil,
  })
}

export function buildServiceOrganizationCompanyFgasCertificationRecordData({
  companyId,
  createdByUserId = null,
  serviceOrganization,
}: {
  companyId: string
  createdByUserId?: string | null
  serviceOrganization: ServiceOrganizationCertificateSource
}) {
  const certificateNumber = normalizeCertificateNumber(
    serviceOrganization.certificateNumber
  )
  if (!certificateNumber) return null

  return {
    companyId,
    serviceOrganizationId: serviceOrganization.id,
    userId: null,
    subjectType: "SERVICE_ORGANIZATION" as const,
    certificateType: "COMPANY_FGAS" as const,
    certificateNumber,
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: null,
    status: "ACTIVE" as const,
    verificationStatus: "SELF_DECLARED" as const,
    verifiedAt: null,
    verifiedByUserId: null,
    documentId: null,
    notes: null,
    createdByUserId,
    updatedByUserId: createdByUserId,
  }
}

export function buildLegacyServicePartnerCompanyCertificationRecordData({
  createdByUserId = null,
  legacyCompany,
}: {
  createdByUserId?: string | null
  legacyCompany: LegacyServicePartnerCompanyCertificateSource
}) {
  const certificateNumber = normalizeCertificateNumber(
    legacyCompany.certificateNumber
  )
  if (!certificateNumber || !legacyCompany.serviceOrganizationId) return null

  return {
    companyId: legacyCompany.companyId,
    serviceOrganizationId: legacyCompany.serviceOrganizationId,
    userId: null,
    subjectType: "SERVICE_ORGANIZATION" as const,
    certificateType: "COMPANY_FGAS" as const,
    certificateNumber,
    issuer: null,
    category: null,
    validFrom: null,
    validUntil: null,
    status: "ACTIVE" as const,
    verificationStatus: "SELF_DECLARED" as const,
    verifiedAt: null,
    verifiedByUserId: null,
    documentId: null,
    notes: null,
    createdByUserId,
    updatedByUserId: createdByUserId,
  }
}

export function selectActiveCompanyFgasCertificate(
  records: CertificationRecordLike[],
  today = new Date()
) {
  const activeRecords = records
    .filter(
      (record) =>
        record.subjectType === "SERVICE_ORGANIZATION" &&
        record.certificateType === "COMPANY_FGAS" &&
        record.status !== "DELETED" &&
        record.status !== "REVOKED" &&
        record.status !== "REPLACED"
    )
    .filter((record) => normalizeCertificateNumber(record.certificateNumber))

  return activeRecords.sort((first, second) =>
    compareCompanyFgasCertificates(first, second, today)
  )[0] ?? null
}

function compareCompanyFgasCertificates(
  first: CertificationRecordLike,
  second: CertificationRecordLike,
  today: Date
) {
  const firstStatus = calculateCertificationRecordStatus({
    certificateNumber: first.certificateNumber,
    status: first.status,
    today,
    validUntil: first.validUntil,
  }).status
  const secondStatus = calculateCertificationRecordStatus({
    certificateNumber: second.certificateNumber,
    status: second.status,
    today,
    validUntil: second.validUntil,
  }).status
  const firstRank = certificationStatusRank(firstStatus)
  const secondRank = certificationStatusRank(secondStatus)
  if (firstRank !== secondRank) return firstRank - secondRank

  const firstValidUntil = timestampOrMax(first.validUntil)
  const secondValidUntil = timestampOrMax(second.validUntil)
  if (firstValidUntil !== secondValidUntil) {
    return secondValidUntil - firstValidUntil
  }

  return timestampOrZero(second.createdAt) - timestampOrZero(first.createdAt)
}

function certificationStatusRank(status: CertificationStatusFromRecord) {
  switch (status) {
    case "VALID":
      return 0
    case "EXPIRING_SOON":
      return 1
    case "EXPIRED":
      return 2
    case "MISSING":
      return 3
    case "INACTIVE":
      return 4
  }
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
