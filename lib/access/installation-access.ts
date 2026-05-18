import type { Prisma } from "@prisma/client"
import type { AuthenticatedUser } from "@/lib/auth"

export type InstallationAccessRecord = {
  companyId: string
  assignedContractorId?: string | null
  assignedServicePartnerCompanyId?: string | null
}

export function getInstallationAccessWhereClause(
  user: AuthenticatedUser
): Prisma.InstallationWhereInput {
  const tenantScope: Prisma.InstallationWhereInput = {
    companyId: user.companyId,
  }

  if (user.role !== "CONTRACTOR") {
    return tenantScope
  }

  const contractorScopes: Prisma.InstallationWhereInput[] = [
    {
      assignedContractorId: user.userId,
    },
  ]

  if (user.isServicePartnerAdmin && user.servicePartnerCompanyId) {
    contractorScopes.push({
      assignedServicePartnerCompanyId: user.servicePartnerCompanyId,
    })
  }

  return {
    AND: [
      tenantScope,
      {
        OR: contractorScopes,
      },
    ],
  }
}

export function canAccessInstallation(
  user: AuthenticatedUser,
  installation: InstallationAccessRecord
) {
  if (installation.companyId !== user.companyId) return false

  if (user.role !== "CONTRACTOR") {
    return true
  }

  if (installation.assignedContractorId === user.userId) {
    return true
  }

  return Boolean(
    user.isServicePartnerAdmin &&
      user.servicePartnerCompanyId &&
      installation.assignedServicePartnerCompanyId ===
        user.servicePartnerCompanyId
  )
}

export function canManageServicepartnerTechnicianAssignments(
  user: AuthenticatedUser,
  servicePartnerCompanyId: string | null | undefined
) {
  return Boolean(
    user.role === "CONTRACTOR" &&
      user.isServicePartnerAdmin &&
      user.servicePartnerCompanyId &&
      servicePartnerCompanyId &&
      user.servicePartnerCompanyId === servicePartnerCompanyId
  )
}
