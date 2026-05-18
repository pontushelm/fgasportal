import type { UserRole } from "@/lib/auth"

export type ServicePartnerInvitationMetadata = {
  servicePartnerCompanyId: string | null
  isServicePartnerAdmin: boolean
}

export function getServicePartnerInvitationMetadata({
  role,
  servicePartnerCompanyId,
}: {
  role: UserRole | string
  servicePartnerCompanyId?: string | null
}): ServicePartnerInvitationMetadata {
  if (role !== "CONTRACTOR") {
    return {
      servicePartnerCompanyId: null,
      isServicePartnerAdmin: false,
    }
  }

  const normalizedServicePartnerCompanyId =
    servicePartnerCompanyId?.trim() || null

  return {
    servicePartnerCompanyId: normalizedServicePartnerCompanyId,
    isServicePartnerAdmin: Boolean(normalizedServicePartnerCompanyId),
  }
}
