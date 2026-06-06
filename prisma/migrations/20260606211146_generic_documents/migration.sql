-- CreateEnum
CREATE TYPE "DocumentStorageProvider" AS ENUM ('VERCEL_BLOB');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('INSPECTION_REPORT', 'SERVICE_REPORT', 'LEAK_REPORT', 'PHOTO', 'AUTHORITY_DOCUMENT', 'SCRAP_CERTIFICATE', 'PROPERTY_DOCUMENT', 'SERVICE_ORGANIZATION_CERTIFICATE', 'REPORT_OUTPUT', 'CUSTOMER_EXPORT', 'AUDIT_EVIDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('USER_UPLOAD', 'SYSTEM_GENERATED', 'SIGNED_REPORT_ARTIFACT', 'IMPORT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'REPLACED', 'DELETED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('COMPANY_INTERNAL', 'SERVICE_PARTNER_VISIBLE', 'OWNER_ADMIN_ONLY', 'SYSTEM_ONLY');

-- CreateEnum
CREATE TYPE "DocumentRetentionPolicy" AS ENUM ('STANDARD', 'RETAINED', 'IMMUTABLE', 'TEMPORARY', 'LEGAL_HOLD');

-- CreateEnum
CREATE TYPE "DocumentLinkEntityType" AS ENUM ('INSTALLATION', 'INSTALLATION_EVENT', 'PROPERTY', 'SERVICE_ORGANIZATION', 'SIGNED_REPORT_ARTIFACT', 'COMPANY', 'REPORT_SCOPE', 'CUSTOMER_EXPORT');

-- CreateEnum
CREATE TYPE "DocumentLinkRole" AS ENUM ('ATTACHMENT', 'EVIDENCE', 'SCRAP_CERTIFICATE', 'CERTIFICATE', 'REPORT_OUTPUT', 'SUPPORTING_FILE');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'VERCEL_BLOB',
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "source" "DocumentSource" NOT NULL DEFAULT 'USER_UPLOAD',
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'COMPANY_INTERNAL',
    "retentionPolicy" "DocumentRetentionPolicy" NOT NULL DEFAULT 'STANDARD',
    "description" TEXT,
    "metadata" JSONB,
    "replacedByDocumentId" TEXT,
    "replacedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedByUserId" TEXT,
    "deletionReason" TEXT,
    "legacyInstallationDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_links" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "entityType" "DocumentLinkEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" "DocumentLinkRole" NOT NULL DEFAULT 'ATTACHMENT',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedByUserId" TEXT,

    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_legacyInstallationDocumentId_key" ON "documents"("legacyInstallationDocumentId");

-- CreateIndex
CREATE INDEX "documents_companyId_idx" ON "documents"("companyId");

-- CreateIndex
CREATE INDEX "documents_uploadedByUserId_idx" ON "documents"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "documents_category_idx" ON "documents"("category");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "documents_replacedByDocumentId_idx" ON "documents"("replacedByDocumentId");

-- CreateIndex
CREATE INDEX "documents_deletedByUserId_idx" ON "documents"("deletedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "document_links_documentId_entityType_entityId_role_key" ON "document_links"("documentId", "entityType", "entityId", "role");

-- CreateIndex
CREATE INDEX "document_links_companyId_idx" ON "document_links"("companyId");

-- CreateIndex
CREATE INDEX "document_links_documentId_idx" ON "document_links"("documentId");

-- CreateIndex
CREATE INDEX "document_links_entityType_entityId_idx" ON "document_links"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "document_links_linkedByUserId_idx" ON "document_links"("linkedByUserId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_replacedByDocumentId_fkey" FOREIGN KEY ("replacedByDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_linkedByUserId_fkey" FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
