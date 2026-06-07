import type { CertificationRecordLike } from "@/lib/certifications"
import {
  calculateCertificationRecordStatus,
  selectActiveCompanyFgasCertificate,
} from "@/lib/certifications"

export type ServicePartnerCompanyCertification = {
  certificateNumber: string | null
  issuer: string | null
  validUntil: Date | string | null
  status: {
    status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "MISSING" | "INACTIVE"
    label: string
    variant: "success" | "warning" | "danger" | "neutral"
  }
  source: "CERTIFICATION_RECORD" | "LEGACY"
}

export type ServicePartnerCompanyCertificationSource = {
  companyId: string
  certificateNumber?: string | null
  serviceOrganization?: {
    certificateNumber?: string | null
  } | null
}

export function buildServicePartnerCompanyCertification({
  company,
  records = [],
  today = new Date(),
}: {
  company: ServicePartnerCompanyCertificationSource
  records?: CertificationRecordLike[]
  today?: Date
}): ServicePartnerCompanyCertification {
  const record = selectActiveCompanyFgasCertificate(records, today)

  if (record) {
    return {
      certificateNumber: record.certificateNumber,
      issuer: record.issuer ?? null,
      validUntil: record.validUntil ?? null,
      status: normalizeCompanyCertificationStatus(
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

  const certificateNumber =
    company.serviceOrganization?.certificateNumber ??
    company.certificateNumber ??
    null

  return {
    certificateNumber,
    issuer: null,
    validUntil: null,
    status: normalizeCompanyCertificationStatus(
      calculateCertificationRecordStatus({
        certificateNumber,
        today,
        validUntil: null,
      }),
      {
        certificateNumber,
        validUntil: null,
      }
    ),
    source: "LEGACY",
  }
}

export function isServicePartnerCompanyCertificationWarning(
  certification?: ServicePartnerCompanyCertification | null
) {
  return (
    !certification ||
    certification.status.status === "MISSING" ||
    certification.status.status === "EXPIRED" ||
    certification.status.status === "INACTIVE"
  )
}

function normalizeCompanyCertificationStatus(
  status: ReturnType<typeof calculateCertificationRecordStatus>,
  source: {
    certificateNumber?: string | null
    validUntil?: Date | string | null
  }
): ServicePartnerCompanyCertification["status"] {
  if (source.certificateNumber && !source.validUntil) {
    return {
      status: "MISSING",
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
