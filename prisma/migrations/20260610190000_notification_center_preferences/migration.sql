-- Add company-level notification reminder preferences.
ALTER TABLE "companies"
ADD COLUMN "sendCertificateReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sendAnnualReportReminders" BOOLEAN NOT NULL DEFAULT true;
