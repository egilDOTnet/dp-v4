-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REQUIREMENT_MENTION';
ALTER TYPE "NotificationType" ADD VALUE 'REQUIREMENT_COMMENT';

-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN "commentsSolved" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RequirementComment" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementComment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "requirementId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "requirementCommentId" TEXT;

-- CreateIndex
CREATE INDEX "RequirementComment_requirementId_idx" ON "RequirementComment"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementComment_createdById_idx" ON "RequirementComment"("createdById");

-- CreateIndex
CREATE INDEX "Notification_requirementId_idx" ON "Notification"("requirementId");

-- CreateIndex
CREATE INDEX "Notification_requirementCommentId_idx" ON "Notification"("requirementCommentId");

-- AddForeignKey
ALTER TABLE "RequirementComment" ADD CONSTRAINT "RequirementComment_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementComment" ADD CONSTRAINT "RequirementComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requirementCommentId_fkey" FOREIGN KEY ("requirementCommentId") REFERENCES "RequirementComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

