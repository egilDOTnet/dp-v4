-- Set default language code for existing templates with null languageCode
UPDATE "RequirementTemplate" SET "languageCode" = 'en' WHERE "languageCode" IS NULL;

-- Drop the existing unique index on shortName
DROP INDEX IF EXISTS "RequirementTemplate_shortName_key";

-- Make languageCode NOT NULL
ALTER TABLE "RequirementTemplate" ALTER COLUMN "languageCode" SET NOT NULL;

-- Create composite unique constraint on shortName and languageCode
CREATE UNIQUE INDEX "RequirementTemplate_shortName_languageCode_key" ON "RequirementTemplate"("shortName", "languageCode");

