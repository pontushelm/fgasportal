-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifyAnnualReportDeadlineEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyAssignmentEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyDocumentEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyInspectionReminderEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLeakEmails" BOOLEAN NOT NULL DEFAULT true;
