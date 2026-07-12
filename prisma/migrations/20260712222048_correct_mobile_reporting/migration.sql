-- Add the minimum durable distinction needed to route mobile vessel equipment
-- through vessel-specific reporting semantics.
ALTER TABLE "installations"
ADD COLUMN "isInstalledOnVessel" BOOLEAN NOT NULL DEFAULT false;
