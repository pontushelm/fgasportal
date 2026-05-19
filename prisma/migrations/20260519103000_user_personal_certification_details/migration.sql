ALTER TABLE "users" ADD COLUMN "certificationIssuer" TEXT;
ALTER TABLE "users" ADD COLUMN "certificationValidUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "certificationCategory" TEXT;
