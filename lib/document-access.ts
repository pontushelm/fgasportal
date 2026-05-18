import type { AuthenticatedUser } from "@/lib/auth"
import { canAccessInstallation } from "@/lib/access/installation-access"
import { isAdminRole } from "@/lib/roles"

export type DocumentAccessInstallation = {
  companyId: string
  assignedContractorId?: string | null
  assignedServicePartnerCompanyId?: string | null
}

export type DocumentAccessRecord = {
  uploadedById: string
  installation: DocumentAccessInstallation
}

export function canAccessInstallationDocuments(
  user: AuthenticatedUser,
  installation: DocumentAccessInstallation
) {
  return canAccessInstallation(user, installation)
}

export function canUploadInstallationDocument(
  user: AuthenticatedUser,
  installation: DocumentAccessInstallation
) {
  return canAccessInstallationDocuments(user, installation)
}

export function canDeleteInstallationDocument(
  user: AuthenticatedUser,
  document: DocumentAccessRecord
) {
  if (!canAccessInstallationDocuments(user, document.installation)) return false
  if (isAdminRole(user.role)) return true

  return document.uploadedById === user.userId
}
