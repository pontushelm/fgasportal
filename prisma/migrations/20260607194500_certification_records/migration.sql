-- CreateEnum
CREATE TYPE "CertificationSubjectType" AS ENUM ('SERVICE_ORGANIZATION', 'TECHNICIAN', 'COMPANY');

-- CreateEnum
CREATE TYPE "CertificationType" AS ENUM ('COMPANY_FGAS', 'PERSONAL_FGAS', 'OTHER');

-- CreateEnum
CREATE TYPE "CertificationRecordStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REPLACED', 'REVOKED', 'DELETED');

-- CreateEnum
CREATE TYPE "CertificationVerificationStatus" AS ENUM ('UNVERIFIED', 'SELF_DECLARED', 'VERIFIED');

-- CreateTable
CREATE TABLE "certification_records" (
    "id" TEXT NOT NULL,
    "serviceOrganizationId" TEXT,
    "userId" TEXT,
    "companyId" TEXT NOT NULL,
    "subjectType" "CertificationSubjectType" NOT NULL,
    "certificateType" "CertificationType" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issuer" TEXT,
    "category" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "CertificationRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "CertificationVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certification_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certification_records_companyId_idx" ON "certification_records"("companyId");

-- CreateIndex
CREATE INDEX "certification_records_serviceOrganizationId_idx" ON "certification_records"("serviceOrganizationId");

-- CreateIndex
CREATE INDEX "certification_records_userId_idx" ON "certification_records"("userId");

-- CreateIndex
CREATE INDEX "certification_records_subjectType_idx" ON "certification_records"("subjectType");

-- CreateIndex
CREATE INDEX "certification_records_certificateType_idx" ON "certification_records"("certificateType");

-- CreateIndex
CREATE INDEX "certification_records_status_idx" ON "certification_records"("status");

-- CreateIndex
CREATE INDEX "certification_records_validUntil_idx" ON "certification_records"("validUntil");

-- CreateIndex
CREATE INDEX "certification_records_documentId_idx" ON "certification_records"("documentId");

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_serviceOrganizationId_fkey" FOREIGN KEY ("serviceOrganizationId") REFERENCES "service_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
