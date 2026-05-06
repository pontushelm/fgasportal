-- Add lightweight company-level certification metadata for contractor memberships.
ALTER TABLE "company_memberships"
ADD COLUMN "isCertifiedCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "certificationNumber" TEXT,
ADD COLUMN "certificationValidUntil" TIMESTAMP(3),
ADD COLUMN "certificationOrganization" TEXT;
