-- AlterTable
ALTER TABLE "RFI" ADD COLUMN IF NOT EXISTS "emailSubject" TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS "emailTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "rfiInformationTemplateId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RFI_emailTemplateId_idx" ON "RFI"("emailTemplateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RFI_rfiInformationTemplateId_idx" ON "RFI"("rfiInformationTemplateId");

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_rfiInformationTemplateId_fkey" FOREIGN KEY ("rfiInformationTemplateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

