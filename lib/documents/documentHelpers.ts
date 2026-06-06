import type {
  DocumentCategory,
  DocumentLinkEntityType,
  DocumentLinkRole,
  DocumentRetentionPolicy,
  DocumentSource,
  DocumentType,
  DocumentVisibility,
} from "@prisma/client"

export type FutureDocumentMetadata = {
  companyId: string
  uploadedByUserId: string | null
  originalFileName: string
  fileName: string
  contentType: string
  sizeBytes: number
  storageKey: string
  category: DocumentCategory
  source: DocumentSource
  visibility: DocumentVisibility
  retentionPolicy: DocumentRetentionPolicy
  description: string | null
  legacyInstallationDocumentId: string | null
}

export type FutureDocumentLinkMetadata = {
  companyId: string
  entityType: DocumentLinkEntityType
  entityId: string
  role: DocumentLinkRole
  linkedByUserId: string | null
}

export type LegacyInstallationDocumentForMetadata = {
  id: string
  installationId: string
  eventId?: string | null
  companyId: string
  uploadedById: string
  originalFileName: string
  fileName: string
  blobPath: string
  mimeType: string
  sizeBytes: number
  documentType: DocumentType
  description?: string | null
}

export type DocumentDownloadMetadata = {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
  downloadHref: string
}

const INSTALLATION_DOCUMENT_CATEGORY_BY_TYPE: Record<
  DocumentType,
  DocumentCategory
> = {
  INSPECTION_REPORT: "INSPECTION_REPORT",
  SERVICE_REPORT: "SERVICE_REPORT",
  LEAK_REPORT: "LEAK_REPORT",
  PHOTO: "PHOTO",
  AUTHORITY_DOCUMENT: "AUTHORITY_DOCUMENT",
  OTHER: "OTHER",
}

export const DOCUMENT_LINK_ROLES = {
  attachment: "ATTACHMENT",
  scrapCertificate: "SCRAP_CERTIFICATE",
  reportOutput: "REPORT_OUTPUT",
} as const satisfies Record<string, DocumentLinkRole>

export const DOCUMENT_LINK_ENTITY_TYPES = {
  company: "COMPANY",
  installation: "INSTALLATION",
  installationEvent: "INSTALLATION_EVENT",
  property: "PROPERTY",
  serviceOrganization: "SERVICE_ORGANIZATION",
  signedReportArtifact: "SIGNED_REPORT_ARTIFACT",
} as const satisfies Record<string, DocumentLinkEntityType>

export function mapInstallationDocumentTypeToDocumentCategory(
  documentType: DocumentType
): DocumentCategory {
  return INSTALLATION_DOCUMENT_CATEGORY_BY_TYPE[documentType]
}

export function buildFutureDocumentMetadataFromInstallationDocument(
  document: LegacyInstallationDocumentForMetadata
): FutureDocumentMetadata {
  return {
    companyId: document.companyId,
    uploadedByUserId: document.uploadedById,
    originalFileName: document.originalFileName,
    fileName: document.fileName,
    contentType: document.mimeType,
    sizeBytes: document.sizeBytes,
    storageKey: document.blobPath,
    category: mapInstallationDocumentTypeToDocumentCategory(
      document.documentType
    ),
    source: "USER_UPLOAD",
    visibility: "COMPANY_INTERNAL",
    retentionPolicy: "STANDARD",
    description: document.description ?? null,
    legacyInstallationDocumentId: document.id,
  }
}

export function buildFutureDocumentLinksFromInstallationDocument(
  document: LegacyInstallationDocumentForMetadata
): FutureDocumentLinkMetadata[] {
  const links: FutureDocumentLinkMetadata[] = [
    {
      companyId: document.companyId,
      entityType: "INSTALLATION",
      entityId: document.installationId,
      role: "ATTACHMENT",
      linkedByUserId: document.uploadedById,
    },
  ]

  if (document.eventId) {
    links.push({
      companyId: document.companyId,
      entityType: "INSTALLATION_EVENT",
      entityId: document.eventId,
      role: "ATTACHMENT",
      linkedByUserId: document.uploadedById,
    })
  }

  return links
}

export function buildDocumentDownloadMetadata({
  contentType,
  fileName,
  id,
  sizeBytes,
}: {
  id: string
  fileName: string
  contentType: string
  sizeBytes: number
}): DocumentDownloadMetadata {
  return {
    id,
    fileName,
    contentType,
    sizeBytes,
    downloadHref: buildGenericDocumentDownloadHref(id),
  }
}

export function buildGenericDocumentDownloadHref(documentId: string) {
  return `/api/documents/${encodeURIComponent(documentId)}/download`
}
