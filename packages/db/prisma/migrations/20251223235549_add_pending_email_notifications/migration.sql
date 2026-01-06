-- CreateTable
CREATE TABLE "PendingEmailNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rfpQuestionId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingEmailNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEmailNotification_userId_idx" ON "PendingEmailNotification"("userId");

-- CreateIndex
CREATE INDEX "PendingEmailNotification_rfpQuestionId_idx" ON "PendingEmailNotification"("rfpQuestionId");

-- CreateIndex
CREATE INDEX "PendingEmailNotification_scheduledFor_idx" ON "PendingEmailNotification"("scheduledFor");

-- CreateIndex
CREATE INDEX "PendingEmailNotification_sentAt_idx" ON "PendingEmailNotification"("sentAt");

-- AddForeignKey
ALTER TABLE "PendingEmailNotification" ADD CONSTRAINT "PendingEmailNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingEmailNotification" ADD CONSTRAINT "PendingEmailNotification_rfpQuestionId_fkey" FOREIGN KEY ("rfpQuestionId") REFERENCES "RFPQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;



