type CertificationStatusLike = {
  status: string
}

export type ServicePartnerCompanyMetricInput = {
  id: string
  name: string
  organizationNumber: string | null
  contactEmail?: string | null
  phone?: string | null
  notes?: string | null
}

export type ServicePartnerContractorMetricInput = {
  id: string
  servicePartnerCompany: ServicePartnerCompanyMetricInput | null
  certificationStatus: CertificationStatusLike
  assignedInstallationsCount: number
  overdueInspections: number
  dueSoonInspections: number
  highRiskInstallations: number
  leakageEventsCount: number
  latestActivityDate: Date | string | null
}

export type ServicePartnerCompanyMetrics = {
  id: string | null
  name: string
  organizationNumber: string | null
  contactEmail: string | null
  phone: string | null
  notes: string | null
  isUnlinked: boolean
  linkedContactsCount: number
  assignedInstallationsCount: number
  overdueInspections: number
  dueSoonInspections: number
  highRiskInstallations: number
  leakageEventsCount: number
  certificationWarnings: number
  latestActivityDate: Date | string | null
  contractorIds: string[]
}

const UNLINKED_GROUP_NAME = "Saknar företagskoppling"

export function buildServicePartnerCompanyMetrics({
  companies,
  contractors,
}: {
  companies: ServicePartnerCompanyMetricInput[]
  contractors: ServicePartnerContractorMetricInput[]
}): ServicePartnerCompanyMetrics[] {
  const companyGroups = new Map<string, ServicePartnerCompanyMetrics>()

  companies.forEach((company) => {
    companyGroups.set(company.id, createCompanyMetrics(company, false))
  })

  const unlinkedGroup = createCompanyMetrics(
    {
      id: "unlinked",
      name: UNLINKED_GROUP_NAME,
      organizationNumber: null,
      contactEmail: null,
      phone: null,
      notes: null,
    },
    true
  )

  contractors.forEach((contractor) => {
    const company = contractor.servicePartnerCompany
    const group = company
      ? companyGroups.get(company.id) ?? createCompanyMetrics(company, false)
      : unlinkedGroup

    if (company && !companyGroups.has(company.id)) {
      companyGroups.set(company.id, group)
    }

    group.linkedContactsCount += 1
    group.assignedInstallationsCount += contractor.assignedInstallationsCount
    group.overdueInspections += contractor.overdueInspections
    group.dueSoonInspections += contractor.dueSoonInspections
    group.highRiskInstallations += contractor.highRiskInstallations
    group.leakageEventsCount += contractor.leakageEventsCount
    group.certificationWarnings += isCertificationWarning(contractor.certificationStatus)
      ? 1
      : 0
    group.contractorIds.push(contractor.id)
    group.latestActivityDate = latestDate(
      group.latestActivityDate,
      contractor.latestActivityDate
    )
  })

  const groups = Array.from(companyGroups.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "sv")
  )

  if (unlinkedGroup.linkedContactsCount > 0) {
    groups.push(unlinkedGroup)
  }

  return groups
}

function createCompanyMetrics(
  company: ServicePartnerCompanyMetricInput,
  isUnlinked: boolean
): ServicePartnerCompanyMetrics {
  return {
    id: isUnlinked ? null : company.id,
    name: company.name,
    organizationNumber: company.organizationNumber,
    contactEmail: company.contactEmail ?? null,
    phone: company.phone ?? null,
    notes: company.notes ?? null,
    isUnlinked,
    linkedContactsCount: 0,
    assignedInstallationsCount: 0,
    overdueInspections: 0,
    dueSoonInspections: 0,
    highRiskInstallations: 0,
    leakageEventsCount: 0,
    certificationWarnings: 0,
    latestActivityDate: null,
    contractorIds: [],
  }
}

function isCertificationWarning(status: CertificationStatusLike) {
  return status.status !== "VALID"
}

function latestDate(
  current: Date | string | null,
  candidate: Date | string | null
) {
  if (!candidate) return current
  if (!current) return candidate

  return new Date(candidate) > new Date(current) ? candidate : current
}
