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

export type LegacyServicePartnerCompanyWithOrganization = {
  id: string
  companyId: string
  serviceOrganizationId: string | null
  name: string
  organizationNumber: string | null
  contactEmail: string | null
  phone: string | null
  certificateNumber: string | null
  notes?: string | null
  serviceOrganization?: {
    id: string
    name: string
    organizationNumber: string | null
    contactEmail: string | null
    phone: string | null
    certificateNumber: string | null
  } | null
}

export function toServiceOrganizationBackedCompany(
  company: LegacyServicePartnerCompanyWithOrganization
) {
  const organization = company.serviceOrganization

  return {
    id: company.id,
    serviceOrganizationId: organization?.id ?? company.serviceOrganizationId,
    name: organization?.name ?? company.name,
    organizationNumber:
      organization?.organizationNumber ?? company.organizationNumber,
    contactEmail: organization?.contactEmail ?? company.contactEmail,
    phone: organization?.phone ?? company.phone,
    certificateNumber:
      organization?.certificateNumber ?? company.certificateNumber,
    notes: company.notes ?? null,
  }
}

export async function ensureServiceOrganizationForLegacyCompany({
  companyId,
  servicePartnerCompanyId,
}: {
  companyId: string
  servicePartnerCompanyId: string
}) {
  const { prisma } = await import("@/lib/db")

  return prisma.$transaction(async (tx) => {
    const legacyCompany = await tx.servicePartnerCompany.findFirst({
      where: {
        id: servicePartnerCompanyId,
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        serviceOrganizationId: true,
        name: true,
        organizationNumber: true,
        contactEmail: true,
        phone: true,
        certificateNumber: true,
      },
    })

    if (!legacyCompany) return null

    const serviceOrganizationId =
      legacyCompany.serviceOrganizationId ??
      (
        await tx.serviceOrganization.create({
          data: buildServiceOrganizationCreateData(legacyCompany),
          select: {
            id: true,
          },
        })
      ).id

    if (!legacyCompany.serviceOrganizationId) {
      await tx.servicePartnerCompany.update({
        where: {
          id: legacyCompany.id,
        },
        data: {
          serviceOrganizationId,
        },
      })
    }

    await tx.companyServiceOrganization.upsert({
      where: {
        companyId_serviceOrganizationId: {
          companyId,
          serviceOrganizationId,
        },
      },
      create: buildCompanyServiceOrganizationCreateData({
        companyId,
        displayName: legacyCompany.name,
        serviceOrganizationId,
      }),
      update: {
        isActive: true,
      },
    })

    return {
      legacyServicePartnerCompanyId: legacyCompany.id,
      serviceOrganizationId,
    }
  })
}
