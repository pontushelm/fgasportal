-- Delivery tracking for future notification digests.
CREATE TYPE "NotificationDigestType" AS ENUM ('DAILY', 'WEEKLY');

CREATE TABLE "notification_digest_logs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "recipientKey" TEXT NOT NULL,
  "digestDate" TIMESTAMP(3) NOT NULL,
  "digestType" "NotificationDigestType" NOT NULL,
  "totalItems" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_digest_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_digest_logs_companyId_recipientKey_digestDate_digestType_key"
ON "notification_digest_logs"("companyId", "recipientKey", "digestDate", "digestType");

CREATE INDEX "notification_digest_logs_companyId_idx"
ON "notification_digest_logs"("companyId");

CREATE INDEX "notification_digest_logs_userId_idx"
ON "notification_digest_logs"("userId");

CREATE INDEX "notification_digest_logs_digestDate_idx"
ON "notification_digest_logs"("digestDate");

ALTER TABLE "notification_digest_logs"
ADD CONSTRAINT "notification_digest_logs_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_digest_logs"
ADD CONSTRAINT "notification_digest_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
