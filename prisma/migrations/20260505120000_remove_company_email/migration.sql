-- Drop the legacy company email column. User.email and Company.billingEmail remain unchanged.
ALTER TABLE "companies" DROP COLUMN "email";
