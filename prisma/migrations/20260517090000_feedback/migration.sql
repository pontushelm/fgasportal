CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'IMPROVEMENT', 'QUESTION', 'OTHER');

CREATE TABLE "feedback" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "userId" TEXT,
  "type" "FeedbackType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "pageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_companyId_idx" ON "feedback"("companyId");
CREATE INDEX "feedback_userId_idx" ON "feedback"("userId");
CREATE INDEX "feedback_type_idx" ON "feedback"("type");
CREATE INDEX "feedback_createdAt_idx" ON "feedback"("createdAt");

ALTER TABLE "feedback"
ADD CONSTRAINT "feedback_companyId_fkey"
FOREIGN KEY ("companyId")
REFERENCES "companies"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "feedback"
ADD CONSTRAINT "feedback_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
