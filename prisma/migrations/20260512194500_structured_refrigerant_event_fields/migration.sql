ALTER TABLE "installation_events"
ADD COLUMN "previousRefrigerantType" TEXT,
ADD COLUMN "newRefrigerantType" TEXT,
ADD COLUMN "previousAmountKg" DOUBLE PRECISION,
ADD COLUMN "newAmountKg" DOUBLE PRECISION,
ADD COLUMN "recoveredAmountKg" DOUBLE PRECISION;
