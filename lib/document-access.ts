import type { AuthenticatedUser } from "@/lib/auth"

export type DocumentAccessInstallation = {
  companyId: string
  assignedContractorId?: string | null
}

export type DocumentAccessRecord = {
  uploadedById: string
  installation: DocumentAccessInstallation
}

export function canAccessInstallationDocuments(
  user: AuthenticatedUser,
  installation: DocumentAccessInstallation
) {
  if (installation.companyId !== user.companyId) return false
  if (user.role === "CONTRACTOR") {
    return installation.assignedContractorId === user.userId
  }

  return true
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
  if (user.role === "ADMIN") return true

  return document.uploadedById === user.userId
}
