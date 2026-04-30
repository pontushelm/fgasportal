-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INSPECTION_REPORT', 'SERVICE_REPORT', 'LEAK_REPORT', 'PHOTO', 'AUTHORITY_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "installation_documents" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "eventId" TEXT,
    "companyId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installation_documents_installationId_idx" ON "installation_documents"("installationId");

-- CreateIndex
CREATE INDEX "installation_documents_eventId_idx" ON "installation_documents"("eventId");

-- CreateIndex
CREATE INDEX "installation_documents_companyId_idx" ON "installation_documents"("companyId");

-- CreateIndex
CREATE INDEX "installation_documents_uploadedById_idx" ON "installation_documents"("uploadedById");

-- AddForeignKey
ALTER TABLE "installation_documents" ADD CONSTRAINT "installation_documents_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_documents" ADD CONSTRAINT "installation_documents_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "installation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_documents" ADD CONSTRAINT "installation_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_documents" ADD CONSTRAINT "installation_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
