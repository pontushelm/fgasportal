CREATE TYPE "InstallationRegisterType" AS ENUM ('STATIONARY', 'MOBILE');

ALTER TABLE "installations"
  ADD COLUMN "installationRegisterType" "InstallationRegisterType" NOT NULL DEFAULT 'STATIONARY',
  ADD COLUMN "mobileUnitId" TEXT,
  ADD COLUMN "mobileUnitName" TEXT,
  ADD COLUMN "mobileRegistrationOrVehicleNumber" TEXT,
  ADD COLUMN "mobileBaseLocation" TEXT;
