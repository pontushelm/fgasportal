-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_installations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "equipmentId" TEXT,
    "serialNumber" TEXT,
    "propertyName" TEXT,
    "equipmentType" TEXT,
    "operatorName" TEXT,
    "refrigerantType" TEXT NOT NULL,
    "refrigerantAmount" REAL NOT NULL,
    "hasLeakDetectionSystem" BOOLEAN NOT NULL DEFAULT false,
    "installationDate" DATETIME NOT NULL,
    "lastInspection" DATETIME,
    "nextInspection" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "installations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "installations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "installations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_installations" ("archivedAt", "companyId", "createdAt", "createdById", "id", "installationDate", "isActive", "lastInspection", "location", "name", "nextInspection", "notes", "refrigerantAmount", "refrigerantType", "updatedAt", "updatedById") SELECT "archivedAt", "companyId", "createdAt", "createdById", "id", "installationDate", "isActive", "lastInspection", "location", "name", "nextInspection", "notes", "refrigerantAmount", "refrigerantType", "updatedAt", "updatedById" FROM "installations";
DROP TABLE "installations";
ALTER TABLE "new_installations" RENAME TO "installations";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
