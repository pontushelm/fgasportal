import { prisma } from "@/lib/db"
import {
  buildCompanyServiceOrganizationCreateData,
  buildServiceOrganizationCreateData,
  mapServiceOrganizationRole,
} from "@/lib/service-organizations"

// Transitional helper for Phase 1A only. This is intentionally not wired into
// normal app startup: run it manually in a controlled migration/backfill window.
export async function backfillServiceOrganizations({ dryRun = true } = {}) {
  const servicePartnerCompanies = await prisma.servicePartnerCompany.findMany({
    include: {
      memberships: {
        where: {
          role: "CONTRACTOR",
        },
        select: {
          userId: true,
          isActive: true,
          isServicePartnerAdmin: true,
        },
      },
    },
  })

  const summary = {
    serviceOrganizationsCreated: 0,
    companyLinksCreated: 0,
    membershipsCreated: 0,
  }

  for (const legacyCompany of servicePartnerCompanies) {
    if (legacyCompany.serviceOrganizationId) continue

    if (dryRun) {
      summary.serviceOrganizationsCreated += 1
      summary.companyLinksCreated += 1
      summary.membershipsCreated += legacyCompany.memberships.length
      continue
    }

    const serviceOrganization = await prisma.serviceOrganization.create({
      data: buildServiceOrganizationCreateData(legacyCompany),
    })
    summary.serviceOrganizationsCreated += 1

    await prisma.servicePartnerCompany.update({
      where: {
        id: legacyCompany.id,
      },
      data: {
        serviceOrganizationId: serviceOrganization.id,
      },
    })

    await prisma.companyServiceOrganization.upsert({
      where: {
        companyId_serviceOrganizationId: {
          companyId: legacyCompany.companyId,
          serviceOrganizationId: serviceOrganization.id,
        },
      },
      create: buildCompanyServiceOrganizationCreateData({
        companyId: legacyCompany.companyId,
        serviceOrganizationId: serviceOrganization.id,
        displayName: legacyCompany.name,
      }),
      update: {
        isActive: true,
      },
    })
    summary.companyLinksCreated += 1

    for (const membership of legacyCompany.memberships) {
      await prisma.serviceOrganizationMembership.upsert({
        where: {
          serviceOrganizationId_userId: {
            serviceOrganizationId: serviceOrganization.id,
            userId: membership.userId,
          },
        },
        create: {
          serviceOrganizationId: serviceOrganization.id,
          userId: membership.userId,
          role: mapServiceOrganizationRole(membership.isServicePartnerAdmin),
          isActive: membership.isActive,
        },
        update: {
          role: mapServiceOrganizationRole(membership.isServicePartnerAdmin),
          isActive: membership.isActive,
        },
      })
      summary.membershipsCreated += 1
    }
  }

  return summary
}
