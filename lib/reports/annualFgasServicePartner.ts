export type AnnualFgasServicePartnerCompanySummary = {
  name: string
  contactEmail?: string | null
  phone?: string | null
  certificateNumber: string | null
  serviceOrganization?: {
    name: string
    contactEmail?: string | null
    phone?: string | null
    certificateNumber: string | null
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
          company.serviceOrganization?.certificateNumber ??
          company.certificateNumber,
      }))[0] ?? null
  )
}
