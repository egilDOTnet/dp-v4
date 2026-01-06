-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RFP_QUESTION';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "rfpQuestionId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_rfpQuestionId_idx" ON "Notification"("rfpQuestionId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_rfpQuestionId_fkey" FOREIGN KEY ("rfpQuestionId") REFERENCES "RFPQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;



