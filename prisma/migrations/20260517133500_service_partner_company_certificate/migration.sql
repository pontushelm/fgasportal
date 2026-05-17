-- Add optional company-level certificate number for service partner companies.
ALTER TABLE "service_partner_companies" ADD COLUMN "certificateNumber" TEXT;
