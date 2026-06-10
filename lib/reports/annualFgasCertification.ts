import type { CertificationRecordLike } from "@/lib/certifications"
import {
  buildServicePartnerCompanyCertification,
  type ServicePartnerCompanyCertification,
} from "@/lib/service-partner-company-certifications"
import {
  buildTechnicianCertification,
  type TechnicianCertification,
} from "@/lib/technician-certifications"

export type AnnualFgasCertificationRecordSource = CertificationRecordLike & {
  serviceOrganizationId?: string | null
  userId?: string | null
}

export type AnnualFgasServicePartnerCompanySource = {
  companyId: string
  certificateNumber?: string | null
  serviceOrganizationId?: string | null
  serviceOrganization?: {
    id?: string | null
    certificateNumber?: string | null
    certificationRecords?: AnnualFgasCertificationRecordSource[]
  } | null
}

export type AnnualFgasTechnicianSource = {
  id: string
  companyId?: string | null
  certificationNumber?: string | null
  certificationIssuer?: string | null
  certificationValidUntil?: Date | string | null
  certificationCategory?: string | null
  certificationRecords?: AnnualFgasCertificationRecordSource[]
}

export type AnnualFgasTechnicianMembershipSource = {
  certificationNumber?: string | null
  certificationOrganization?: string | null
  certificationValidUntil?: Date | string | null
  servicePartnerCompany?: AnnualFgasServicePartnerCompanySource | null
}

export type AnnualFgasInstallationCertificationSource = {
  assignedServicePartnerCompany?: AnnualFgasServicePartnerCompanySource | null
  assignedContractor?: (AnnualFgasTechnicianSource & {
    memberships: AnnualFgasTechnicianMembershipSource[]
  }) | null
}

export type AnnualFgasResolvedInstallationCertification = {
  servicePartnerCompany: ServicePartnerCompanyCertification | null
  technician: TechnicianCertification | null
}

export function resolveAnnualFgasServicePartnerCompanyCertification(
  company?: AnnualFgasServicePartnerCompanySource | null,
  today = new Date()
) {
  if (!company) return null

  return buildServicePartnerCompanyCertification({
    company,
    records: (company.serviceOrganization?.certificationRecords ?? []).filter(
      (record) => record.companyId === company.companyId
    ),
    today,
  })
}

export function resolveAnnualFgasTechnicianCertification({
  serviceOrganizationId,
  technician,
  today = new Date(),
}: {
  serviceOrganizationId?: string | null
  technician?: (AnnualFgasTechnicianSource & {
    memberships: AnnualFgasTechnicianMembershipSource[]
  }) | null
  today?: Date
}) {
  if (!technician) return null

  const membership = technician.memberships[0] ?? null
  const companyId =
    membership?.servicePartnerCompany?.companyId ?? technician.companyId ?? null
  const scopedRecords = (technician.certificationRecords ?? []).filter(
    (record) =>
      (!companyId || record.companyId === companyId) &&
      (!record.serviceOrganizationId ||
        !serviceOrganizationId ||
        record.serviceOrganizationId === serviceOrganizationId)
  )

  return buildTechnicianCertification({
    membership,
    records: scopedRecords,
    today,
    user: technician,
  })
}

export function resolveAnnualFgasInstallationCertification(
  installation: AnnualFgasInstallationCertificationSource,
  today = new Date()
): AnnualFgasResolvedInstallationCertification {
  const servicePartnerCompany = resolveAnnualFgasServicePartnerCompanyCertification(
    installation.assignedServicePartnerCompany,
    today
  )
  const serviceOrganizationId =
    installation.assignedServicePartnerCompany?.serviceOrganizationId ??
    installation.assignedServicePartnerCompany?.serviceOrganization?.id ??
    installation.assignedContractor?.memberships[0]?.servicePartnerCompany
      ?.serviceOrganizationId ??
    installation.assignedContractor?.memberships[0]?.servicePartnerCompany
      ?.serviceOrganization?.id ??
    null
  const technician = resolveAnnualFgasTechnicianCertification({
    serviceOrganizationId,
    technician: installation.assignedContractor,
    today,
  })

  return {
    servicePartnerCompany,
    technician,
  }
}

export function hasAnnualFgasResolvedCertificate(
  certification?: AnnualFgasResolvedInstallationCertification | null
) {
  return Boolean(
    certification?.servicePartnerCompany?.certificateNumber ||
      certification?.technician?.certificateNumber
  )
}
