-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('PROPERTIES', 'INSTALLATIONS', 'INSTALLATION_EVENTS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN "importSessionId" TEXT;

-- AlterTable
ALTER TABLE "installations" ADD COLUMN "importSessionId" TEXT;

-- AlterTable
ALTER TABLE "installation_events" ADD COLUMN "importSessionId" TEXT;

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "sourceFileName" TEXT,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackByUserId" TEXT,
    "errorSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_importSessionId_idx" ON "properties"("importSessionId");

-- CreateIndex
CREATE INDEX "installations_importSessionId_idx" ON "installations"("importSessionId");

-- CreateIndex
CREATE INDEX "installation_events_importSessionId_idx" ON "installation_events"("importSessionId");

-- CreateIndex
CREATE INDEX "import_sessions_companyId_idx" ON "import_sessions"("companyId");

-- CreateIndex
CREATE INDEX "import_sessions_createdAt_idx" ON "import_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "import_sessions_createdByUserId_idx" ON "import_sessions"("createdByUserId");

-- CreateIndex
CREATE INDEX "import_sessions_rolledBackByUserId_idx" ON "import_sessions"("rolledBackByUserId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "import_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "import_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installation_events" ADD CONSTRAINT "installation_events_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "import_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_rolledBackByUserId_fkey" FOREIGN KEY ("rolledBackByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
