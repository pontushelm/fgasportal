CREATE TYPE "SignedReportType" AS ENUM ('ANNUAL_FGAS', 'CLIMATE', 'COMPLIANCE', 'AUDIT', 'CUSTOMER_EXPORT');

CREATE TYPE "SignedReportScopeType" AS ENUM ('PROPERTY', 'MUNICIPALITY', 'COMPANY', 'CUSTOM');

CREATE TYPE "SignedReportArtifactStatus" AS ENUM ('STORED', 'METADATA_ONLY', 'SUPERSEDED', 'FAILED', 'DELETED');

CREATE TYPE "SignedReportSigningMethod" AS ENUM ('FGASPORTAL_ELECTRONIC');

CREATE TABLE "signed_report_artifacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "signedByUserId" TEXT,
    "reportType" "SignedReportType" NOT NULL,
    "scopeType" "SignedReportScopeType" NOT NULL,
    "scopeId" TEXT,
    "scopeLabel" TEXT,
    "reportYear" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "SignedReportArtifactStatus" NOT NULL DEFAULT 'STORED',
    "signingMethod" "SignedReportSigningMethod" NOT NULL DEFAULT 'FGASPORTAL_ELECTRONIC',
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signerRole" TEXT,
    "signingText" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "pdfStorageKey" TEXT,
    "pdfFileName" TEXT,
    "pdfContentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "pdfSizeBytes" INTEGER,
    "pdfSha256" TEXT,
    "snapshot" JSONB,
    "snapshotSha256" TEXT,
    "snapshotVersion" INTEGER,
    "snapshotSchema" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "rendererVersion" TEXT,
    "supersedesArtifactId" TEXT,
    "supersededByArtifactId" TEXT,
    "correctionReason" TEXT,
    "supersededAt" TIMESTAMP(3),
    "signedActivityLogId" TEXT,
    "exportActivityLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signed_report_artifacts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "signed_annual_fgas_reports"
ADD COLUMN "artifactId" TEXT,
ADD COLUMN "legacyMetadataOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "signed_annual_fgas_reports"
SET "legacyMetadataOnly" = true
WHERE "artifactId" IS NULL;

CREATE INDEX "signed_report_artifacts_companyId_idx" ON "signed_report_artifacts"("companyId");
CREATE INDEX "signed_report_artifacts_signedByUserId_idx" ON "signed_report_artifacts"("signedByUserId");
CREATE INDEX "signed_report_artifacts_reportType_idx" ON "signed_report_artifacts"("reportType");
CREATE INDEX "signed_report_artifacts_reportYear_idx" ON "signed_report_artifacts"("reportYear");
CREATE INDEX "signed_report_artifacts_scopeId_idx" ON "signed_report_artifacts"("scopeId");
CREATE INDEX "signed_report_artifacts_createdAt_idx" ON "signed_report_artifacts"("createdAt");
CREATE INDEX "signed_report_artifacts_status_idx" ON "signed_report_artifacts"("status");
CREATE INDEX "signed_report_artifacts_signedActivityLogId_idx" ON "signed_report_artifacts"("signedActivityLogId");
CREATE INDEX "signed_report_artifacts_exportActivityLogId_idx" ON "signed_report_artifacts"("exportActivityLogId");
CREATE UNIQUE INDEX "signed_annual_fgas_reports_artifactId_key" ON "signed_annual_fgas_reports"("artifactId");
CREATE INDEX "signed_annual_fgas_reports_artifactId_idx" ON "signed_annual_fgas_reports"("artifactId");

ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_supersedesArtifactId_fkey" FOREIGN KEY ("supersedesArtifactId") REFERENCES "signed_report_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_supersededByArtifactId_fkey" FOREIGN KEY ("supersededByArtifactId") REFERENCES "signed_report_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_signedActivityLogId_fkey" FOREIGN KEY ("signedActivityLogId") REFERENCES "activity_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signed_report_artifacts" ADD CONSTRAINT "signed_report_artifacts_exportActivityLogId_fkey" FOREIGN KEY ("exportActivityLogId") REFERENCES "activity_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signed_annual_fgas_reports" ADD CONSTRAINT "signed_annual_fgas_reports_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "signed_report_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
