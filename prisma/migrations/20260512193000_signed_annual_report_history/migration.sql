-- CreateTable
CREATE TABLE "signed_annual_fgas_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "reportYear" INTEGER NOT NULL,
    "municipality" TEXT,
    "propertyId" TEXT,
    "propertyName" TEXT,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "signingDate" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "readinessStatus" TEXT NOT NULL,
    "blockingIssueCount" INTEGER NOT NULL,
    "reviewWarningCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signed_annual_fgas_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signed_annual_fgas_reports_companyId_idx" ON "signed_annual_fgas_reports"("companyId");

-- CreateIndex
CREATE INDEX "signed_annual_fgas_reports_userId_idx" ON "signed_annual_fgas_reports"("userId");

-- CreateIndex
CREATE INDEX "signed_annual_fgas_reports_reportYear_idx" ON "signed_annual_fgas_reports"("reportYear");

-- CreateIndex
CREATE INDEX "signed_annual_fgas_reports_createdAt_idx" ON "signed_annual_fgas_reports"("createdAt");

-- AddForeignKey
ALTER TABLE "signed_annual_fgas_reports" ADD CONSTRAINT "signed_annual_fgas_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_annual_fgas_reports" ADD CONSTRAINT "signed_annual_fgas_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
