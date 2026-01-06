-- CreateEnum
CREATE TYPE "RFIStatus" AS ENUM ('Draft', 'Published', 'Unpublished');

-- AlterEnum (add Unpublished to RFPStatus)
ALTER TYPE "RFPStatus" ADD VALUE 'Unpublished';

-- AlterTable: Add status column to RFI
ALTER TABLE "RFI" ADD COLUMN "status" "RFIStatus" NOT NULL DEFAULT 'Draft';

-- Migrate existing data: Convert isPublished boolean to status enum
UPDATE "RFI" SET "status" = 'Published' WHERE "isPublished" = true;
UPDATE "RFI" SET "status" = 'Draft' WHERE "isPublished" = false OR "isPublished" IS NULL;

-- DropColumn: Remove isPublished column
ALTER TABLE "RFI" DROP COLUMN "isPublished";



