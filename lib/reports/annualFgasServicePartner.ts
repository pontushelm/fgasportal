import {
  resolveAnnualFgasServicePartnerCompanyCertification,
  type AnnualFgasCertificationRecordSource,
} from "@/lib/reports/annualFgasCertification"

export type AnnualFgasServicePartnerCompanySummary = {
  companyId: string
  name: string
  contactEmail?: string | null
  phone?: string | null
  certificateNumber: string | null
  serviceOrganizationId?: string | null
  serviceOrganization?: {
    id?: string | null
    name: string
    contactEmail?: string | null
    phone?: string | null
    certificateNumber: string | null
    certificationRecords?: AnnualFgasCertificationRecordSource[]
  } | null
}

export function selectPrimaryAnnualReportServicePartnerCompany(
  installations: Array<{
    assignedServicePartnerCompany: AnnualFgasServicePartnerCompanySummary | null
  }>
) {
  return (
    installations
      .map((installation) => installation.assignedServicePartnerCompany)
      .filter((company): company is AnnualFgasServicePartnerCompanySummary =>
        Boolean(company)
      )
      .map((company) => ({
        name: company.serviceOrganization?.name ?? company.name,
        contactEmail:
          company.serviceOrganization?.contactEmail ?? company.contactEmail,
        phone: company.serviceOrganization?.phone ?? company.phone,
        certificateNumber:
          resolveAnnualFgasServicePartnerCompanyCertification(company)
            ?.certificateNumber ?? null,
      }))[0] ?? null
  )
}
