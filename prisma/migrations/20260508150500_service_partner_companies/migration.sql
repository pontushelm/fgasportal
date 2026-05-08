-- Add service partner companies without changing the existing user-based assignment model.
CREATE TABLE "service_partner_companies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationNumber" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_partner_companies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "company_memberships"
ADD COLUMN "servicePartnerCompanyId" TEXT;

CREATE UNIQUE INDEX "service_partner_companies_companyId_name_key"
ON "service_partner_companies"("companyId", "name");

CREATE INDEX "service_partner_companies_companyId_idx"
ON "service_partner_companies"("companyId");

CREATE INDEX "company_memberships_servicePartnerCompanyId_idx"
ON "company_memberships"("servicePartnerCompanyId");

ALTER TABLE "service_partner_companies"
ADD CONSTRAINT "service_partner_companies_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_memberships"
ADD CONSTRAINT "company_memberships_servicePartnerCompanyId_fkey"
FOREIGN KEY ("servicePartnerCompanyId") REFERENCES "service_partner_companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
