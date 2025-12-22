-- AlterEnum
-- This migration replaces RFI_Rejected with RFI_Started in the VendorStatus enum
-- First, we need to update any existing RFI_Rejected values to a temporary value
-- Then alter the enum, then update back

-- Step 1: Update any existing RFI_Rejected statuses to Pending (temporary)
UPDATE "ProjectVendor" SET "status" = 'Pending' WHERE "status" = 'RFI_Rejected';

-- Step 2: Alter the enum type - PostgreSQL requires creating a new type and migrating
-- Create new enum type without RFI_Rejected and with RFI_Started
DO $$ BEGIN
    CREATE TYPE "VendorStatus_new" AS ENUM (
        'Pending',
        'RFI_Received',
        'RFI_Started',
        'RFI_Answered',
        'RFP_Received',
        'RFP_Answered',
        'RFP_Rejected',
        'Shortlisted',
        'Lost',
        'Won'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Alter the column to use the new enum type
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" TYPE "VendorStatus_new" USING ("status"::text::"VendorStatus_new");
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" SET DEFAULT 'Pending';

-- Step 4: Drop the old enum type and rename the new one
DROP TYPE "VendorStatus";
ALTER TYPE "VendorStatus_new" RENAME TO "VendorStatus";



