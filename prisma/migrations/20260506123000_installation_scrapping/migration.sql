-- Add a dedicated disposal/decommissioning lifecycle for installations.
-- This is intentionally separate from archiving; scrapped installations remain
-- historically traceable and are not deleted.
ALTER TABLE "installations"
ADD COLUMN "scrappedAt" TIMESTAMP(3),
ADD COLUMN "scrappedByCompanyMembershipId" TEXT,
ADD COLUMN "scrapComment" TEXT,
ADD COLUMN "scrapCertificateUrl" TEXT,
ADD COLUMN "scrapCertificateFileName" TEXT,
ADD COLUMN "scrapCertificateBlobPath" TEXT,
ADD COLUMN "scrapServicePartnerId" TEXT,
ADD COLUMN "recoveredRefrigerantKg" DOUBLE PRECISION;

