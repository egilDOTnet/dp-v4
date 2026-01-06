-- AlterTable: Make projectId nullable in RequirementHierarchy
ALTER TABLE "RequirementHierarchy" ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable: Add new columns to RequirementHierarchy
ALTER TABLE "RequirementHierarchy" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RequirementHierarchy" ADD COLUMN "templateId" TEXT;

-- CreateTable: RequirementTemplate
CREATE TABLE "RequirementTemplate" (
    "id" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "languageCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "RequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmailTemplateLanguage
CREATE TABLE "EmailTemplateLanguage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequirementTemplate_shortName_key" ON "RequirementTemplate"("shortName");

-- CreateIndex
CREATE INDEX "RequirementTemplate_createdById_idx" ON "RequirementTemplate"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateLanguage_templateId_languageCode_key" ON "EmailTemplateLanguage"("templateId", "languageCode");

-- CreateIndex
CREATE INDEX "EmailTemplateLanguage_templateId_idx" ON "EmailTemplateLanguage"("templateId");

-- CreateIndex
CREATE INDEX "RequirementHierarchy_templateId_idx" ON "RequirementHierarchy"("templateId");

-- AddForeignKey
ALTER TABLE "RequirementTemplate" ADD CONSTRAINT "RequirementTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementHierarchy" ADD CONSTRAINT "RequirementHierarchy_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RequirementTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateLanguage" ADD CONSTRAINT "EmailTemplateLanguage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;


