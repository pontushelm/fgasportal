ALTER TABLE "installation_events"
ADD COLUMN "supersededAt" TIMESTAMP(3),
ADD COLUMN "supersededByEventId" TEXT,
ADD COLUMN "supersededReason" TEXT,
ADD COLUMN "supersededByUserId" TEXT;

CREATE INDEX "installation_events_supersededAt_idx" ON "installation_events"("supersededAt");
