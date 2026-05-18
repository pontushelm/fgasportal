ALTER TABLE "invitations"
ADD COLUMN "isServicePartnerAdminInvite" BOOLEAN NOT NULL DEFAULT false;

UPDATE "invitations"
SET "isServicePartnerAdminInvite" = true
WHERE "role" = 'CONTRACTOR'
  AND "servicePartnerCompanyId" IS NOT NULL;
