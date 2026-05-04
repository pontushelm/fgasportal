-- CreateTable
CREATE TABLE "company_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_memberships_companyId_idx" ON "company_memberships"("companyId");

-- CreateIndex
CREATE INDEX "company_memberships_userId_idx" ON "company_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_userId_companyId_key" ON "company_memberships"("userId", "companyId");

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one membership per existing user to mirror the current single-company model.
INSERT INTO "company_memberships" (
    "id",
    "userId",
    "companyId",
    "role",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'cm_' || replace(gen_random_uuid()::text, '-', ''),
    "id",
    "companyId",
    "role",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "users"
ON CONFLICT ("userId", "companyId") DO NOTHING;
