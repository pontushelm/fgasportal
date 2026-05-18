export type AnnualFgasServicePartnerCompanySummary = {
  name: string
  contactEmail?: string | null
  phone?: string | null
  certificateNumber: string | null
}

export function selectPrimaryAnnualReportServicePartnerCompany(
  installations: Array<{
    assignedServicePartnerCompany: AnnualFgasServicePartnerCompanySummary | null
  }>
) {
  return (
    installations.find((installation) => installation.assignedServicePartnerCompany)
      ?.assignedServicePartnerCompany ?? null
  )
}
