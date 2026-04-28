-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_logs_installationId_idx" ON "reminder_logs"("installationId");

-- CreateIndex
CREATE INDEX "reminder_logs_email_idx" ON "reminder_logs"("email");

-- CreateIndex
CREATE INDEX "reminder_logs_sentAt_idx" ON "reminder_logs"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_logs_installationId_email_type_reminderKey_key" ON "reminder_logs"("installationId", "email", "type", "reminderKey");

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
