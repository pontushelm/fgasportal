-- AlterTable
ALTER TABLE "installations" ADD COLUMN     "assignedContractorId" TEXT;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_assignedContractorId_fkey" FOREIGN KEY ("assignedContractorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
