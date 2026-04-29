-- CreateEnum
CREATE TYPE "InstallationEventType" AS ENUM ('INSPECTION', 'LEAK', 'REFILL', 'SERVICE');

-- CreateTable
CREATE TABLE "installation_events" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "InstallationEventType" NOT NULL,
    "refrigerantAddedKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installation_events_installationId_idx" ON "installation_events"("installationId");

-- AddForeignKey
ALTER TABLE "installation_events" ADD CONSTRAINT "installation_events_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_events" ADD CONSTRAINT "installation_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
