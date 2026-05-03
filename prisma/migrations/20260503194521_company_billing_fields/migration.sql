-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "eInvoiceId" TEXT,
ADD COLUMN     "invoiceReference" TEXT,
ADD COLUMN     "vatNumber" TEXT;
