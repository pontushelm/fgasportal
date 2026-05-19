ALTER TABLE "invitations" ADD COLUMN "serviceOrganizationId" TEXT;

-- Phase 1B is still transitional: keep ServicePartnerCompany as the
-- customer-scoped relationship, but make sure every existing relationship has
-- a global ServiceOrganization identity for settings, certificate and pool data.
INSERT INTO "service_organizations" (
  "id",
  "name",
  "organizationNumber",
  "contactEmail",
  "phone",
  "certificateNumber",
  "createdAt",
  "updatedAt"
)
SELECT
  'sorg_' || md5(spc."id"),
  spc."name",
  spc."organizationNumber",
  spc."contactEmail",
  spc."phone",
  spc."certificateNumber",
  spc."createdAt",
  spc."updatedAt"
FROM "service_partner_companies" spc
WHERE spc."serviceOrganizationId" IS NULL;

UPDATE "service_partner_companies" spc
SET "serviceOrganizationId" = 'sorg_' || md5(spc."id")
WHERE spc."serviceOrganizationId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "service_organizations" sorg
    WHERE sorg."id" = 'sorg_' || md5(spc."id")
  );

INSERT INTO "company_service_organizations" (
  "id",
  "companyId",
  "serviceOrganizationId",
  "displayName",
  "isActive",
  "createdAt"
)
SELECT
  'csorg_' || md5(spc."companyId" || ':' || spc."serviceOrganizationId"),
  spc."companyId",
  spc."serviceOrganizationId",
  spc."name",
  true,
  NOW()
FROM "service_partner_companies" spc
WHERE spc."serviceOrganizationId" IS NOT NULL
ON CONFLICT ("companyId", "serviceOrganizationId") DO NOTHING;

INSERT INTO "service_organization_memberships" (
  "id",
  "serviceOrganizationId",
  "userId",
  "role",
  "isActive",
  "createdAt"
)
SELECT
  'som_' || md5(spc."serviceOrganizationId" || ':' || cm."userId"),
  spc."serviceOrganizationId",
  cm."userId",
  CASE WHEN cm."isServicePartnerAdmin" THEN 'ADMIN'::"ServiceOrganizationRole" ELSE 'TECHNICIAN'::"ServiceOrganizationRole" END,
  cm."isActive",
  cm."createdAt"
FROM "company_memberships" cm
JOIN "service_partner_companies" spc ON spc."id" = cm."servicePartnerCompanyId"
WHERE cm."role" = 'CONTRACTOR'
  AND spc."serviceOrganizationId" IS NOT NULL
ON CONFLICT ("serviceOrganizationId", "userId") DO UPDATE
SET
  "role" = CASE
    WHEN EXCLUDED."role" = 'ADMIN'::"ServiceOrganizationRole"
    THEN 'ADMIN'::"ServiceOrganizationRole"
    ELSE "service_organization_memberships"."role"
  END,
  "isActive" = "service_organization_memberships"."isActive" OR EXCLUDED."isActive";

UPDATE "invitations" invitation
SET "serviceOrganizationId" = spc."serviceOrganizationId"
FROM "service_partner_companies" spc
WHERE invitation."servicePartnerCompanyId" = spc."id"
  AND invitation."serviceOrganizationId" IS NULL;

CREATE INDEX "invitations_serviceOrganizationId_idx" ON "invitations"("serviceOrganizationId");

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_serviceOrganizationId_fkey"
FOREIGN KEY ("serviceOrganizationId") REFERENCES "service_organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
