ALTER TABLE "installations"
ADD COLUMN "assignedServicePartnerCompanyId" TEXT;

UPDATE "installations" AS installation
SET "assignedServicePartnerCompanyId" = membership."servicePartnerCompanyId"
FROM "company_memberships" AS membership
WHERE installation."assignedContractorId" = membership."userId"
  AND installation."companyId" = membership."companyId"
  AND membership."role" = 'CONTRACTOR'
  AND membership."isActive" = true
  AND membership."servicePartnerCompanyId" IS NOT NULL
  AND installation."assignedServicePartnerCompanyId" IS NULL;

CREATE INDEX "installations_assignedServicePartnerCompanyId_idx"
ON "installations"("assignedServicePartnerCompanyId");

ALTER TABLE "installations"
ADD CONSTRAINT "installations_assignedServicePartnerCompanyId_fkey"
FOREIGN KEY ("assignedServicePartnerCompanyId")
REFERENCES "service_partner_companies"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
