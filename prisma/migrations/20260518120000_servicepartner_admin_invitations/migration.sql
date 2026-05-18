ALTER TABLE "company_memberships"
ADD COLUMN "isServicePartnerAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "invitations"
ADD COLUMN "servicePartnerCompanyId" TEXT;

CREATE INDEX "invitations_servicePartnerCompanyId_idx"
ON "invitations"("servicePartnerCompanyId");

ALTER TABLE "invitations"
ADD CONSTRAINT "invitations_servicePartnerCompanyId_fkey"
FOREIGN KEY ("servicePartnerCompanyId")
REFERENCES "service_partner_companies"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
