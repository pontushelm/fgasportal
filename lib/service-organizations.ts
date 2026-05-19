export type ServiceOrganizationRoleValue = "ADMIN" | "TECHNICIAN"

export type LegacyServicePartnerCompanyForBackfill = {
  id: string
  companyId: string
  serviceOrganizationId?: string | null
  name: string
  organizationNumber?: string | null
  contactEmail?: string | null
  phone?: string | null
  certificateNumber?: string | null
}

export type LegacyContractorMembershipForBackfill = {
  id: string
  userId: string
  servicePartnerCompanyId?: string | null
  isServicePartnerAdmin?: boolean
  isActive?: boolean
}

export type ServiceOrganizationBackfillPlan = {
  serviceOrganizations: Array<{
    legacyServicePartnerCompanyId: string
    data: {
      name: string
      organizationNumber: string | null
      contactEmail: string | null
      phone: string | null
      certificateNumber: string | null
    }
  }>
  companyLinks: Array<{
    legacyServicePartnerCompanyId: string
    companyId: string
    displayName: string
  }>
  membershipLinks: Array<{
    legacyMembershipId: string
    legacyServicePartnerCompanyId: string
    userId: string
    role: ServiceOrganizationRoleValue
    isActive: boolean
  }>
}

export function buildServiceOrganizationBackfillPlan({
  memberships,
  servicePartnerCompanies,
}: {
  memberships: LegacyContractorMembershipForBackfill[]
  servicePartnerCompanies: LegacyServicePartnerCompanyForBackfill[]
}): ServiceOrganizationBackfillPlan {
  const legacyCompaniesById = new Map(
    servicePartnerCompanies.map((company) => [company.id, company])
  )
  const companiesWithoutBridge = servicePartnerCompanies.filter(
    (company) => !company.serviceOrganizationId
  )

  return {
    serviceOrganizations: companiesWithoutBridge.map((company) => ({
      legacyServicePartnerCompanyId: company.id,
      data: buildServiceOrganizationCreateData(company),
    })),
    companyLinks: servicePartnerCompanies.map((company) => ({
      legacyServicePartnerCompanyId: company.id,
      companyId: company.companyId,
      displayName: company.name,
    })),
    membershipLinks: memberships.flatMap((membership) => {
      if (!membership.servicePartnerCompanyId) return []
      if (!legacyCompaniesById.has(membership.servicePartnerCompanyId)) return []

      return [
        {
          legacyMembershipId: membership.id,
          legacyServicePartnerCompanyId: membership.servicePartnerCompanyId,
          userId: membership.userId,
          role: mapServiceOrganizationRole(membership.isServicePartnerAdmin),
          isActive: membership.isActive ?? true,
        },
      ]
    }),
  }
}

export function buildServiceOrganizationCreateData(
  company: LegacyServicePartnerCompanyForBackfill
) {
  return {
    name: company.name,
    organizationNumber: company.organizationNumber ?? null,
    contactEmail: company.contactEmail ?? null,
    phone: company.phone ?? null,
    certificateNumber: company.certificateNumber ?? null,
  }
}

export function buildCompanyServiceOrganizationCreateData({
  companyId,
  displayName,
  serviceOrganizationId,
}: {
  companyId: string
  displayName?: string | null
  serviceOrganizationId: string
}) {
  return {
    companyId,
    serviceOrganizationId,
    displayName: displayName || null,
  }
}

export function mapServiceOrganizationRole(
  isServicePartnerAdmin?: boolean | null
): ServiceOrganizationRoleValue {
  return isServicePartnerAdmin ? "ADMIN" : "TECHNICIAN"
}

export function resolveServiceOrganizationIdFromLegacyCompany(
  company: Pick<LegacyServicePartnerCompanyForBackfill, "serviceOrganizationId">
) {
  return company.serviceOrganizationId ?? null
}
