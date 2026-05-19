CREATE TYPE "ServiceOrganizationRole" AS ENUM ('ADMIN', 'TECHNICIAN');

CREATE TABLE "service_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationNumber" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "certificateNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_organization_memberships" (
    "id" TEXT NOT NULL,
    "serviceOrganizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ServiceOrganizationRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_organization_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_service_organizations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceOrganizationId" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_service_organizations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "service_partner_companies" ADD COLUMN "serviceOrganizationId" TEXT;

CREATE INDEX "service_organizations_organizationNumber_idx" ON "service_organizations"("organizationNumber");
CREATE UNIQUE INDEX "service_organization_memberships_serviceOrganizationId_userId_key" ON "service_organization_memberships"("serviceOrganizationId", "userId");
CREATE INDEX "service_organization_memberships_userId_idx" ON "service_organization_memberships"("userId");
CREATE UNIQUE INDEX "company_service_organizations_companyId_serviceOrganizationId_key" ON "company_service_organizations"("companyId", "serviceOrganizationId");
CREATE INDEX "company_service_organizations_serviceOrganizationId_idx" ON "company_service_organizations"("serviceOrganizationId");
CREATE INDEX "service_partner_companies_serviceOrganizationId_idx" ON "service_partner_companies"("serviceOrganizationId");

ALTER TABLE "service_organization_memberships" ADD CONSTRAINT "service_organization_memberships_serviceOrganizationId_fkey" FOREIGN KEY ("serviceOrganizationId") REFERENCES "service_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_organization_memberships" ADD CONSTRAINT "service_organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_service_organizations" ADD CONSTRAINT "company_service_organizations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_service_organizations" ADD CONSTRAINT "company_service_organizations_serviceOrganizationId_fkey" FOREIGN KEY ("serviceOrganizationId") REFERENCES "service_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_partner_companies" ADD CONSTRAINT "service_partner_companies_serviceOrganizationId_fkey" FOREIGN KEY ("serviceOrganizationId") REFERENCES "service_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
