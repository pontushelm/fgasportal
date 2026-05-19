import { mapServiceOrganizationRole } from "@/lib/service-organizations"

export function buildServiceOrganizationMembershipCreateData({
  isActive = true,
  isServicePartnerAdmin,
  serviceOrganizationId,
  userId,
}: {
  isActive?: boolean
  isServicePartnerAdmin?: boolean | null
  serviceOrganizationId: string
  userId: string
}) {
  return {
    serviceOrganizationId,
    userId,
    role: mapServiceOrganizationRole(isServicePartnerAdmin),
    isActive,
  }
}

export function isSameServiceOrganizationMembership({
  serviceOrganizationId,
  userId,
}: {
  serviceOrganizationId?: string | null
  userId?: string | null
}) {
  return Boolean(serviceOrganizationId && userId)
}

export function getServiceOrganizationRoleFromServicePartnerAdmin(
  isServicePartnerAdmin?: boolean | null
) {
  return mapServiceOrganizationRole(isServicePartnerAdmin)
}
