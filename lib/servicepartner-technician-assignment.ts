import type { AuthenticatedUser, UserRole } from "@/lib/auth"
import {
  canManageServicepartnerTechnicianAssignments,
  type InstallationAccessRecord,
} from "@/lib/access/installation-access"

export type TechnicianAssignmentMembership = {
  companyId: string
  role: UserRole | string
  isActive: boolean
  servicePartnerCompanyId: string | null
  user?: {
    isActive: boolean
  } | null
}

export function canAssignServicepartnerTechnician({
  user,
  installation,
  technicianMembership,
}: {
  user: AuthenticatedUser
  installation: InstallationAccessRecord
  technicianMembership?: TechnicianAssignmentMembership | null
}) {
  // Future: servicepartner organisations may need shared technician pools across multiple customer tenants.
  if (
    installation.companyId !== user.companyId ||
    !canManageServicepartnerTechnicianAssignments(
      user,
      installation.assignedServicePartnerCompanyId
    )
  ) {
    return false
  }

  if (!technicianMembership) return true

  return (
    technicianMembership.companyId === user.companyId &&
    technicianMembership.role === "CONTRACTOR" &&
    technicianMembership.isActive &&
    technicianMembership.user?.isActive !== false &&
    technicianMembership.servicePartnerCompanyId === user.servicePartnerCompanyId
  )
}
