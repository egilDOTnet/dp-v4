-- AlterEnum
-- This migration renames RFP_Answered to RFP_Delivered in the VendorStatus enum
-- PostgreSQL requires creating a new type and migrating

-- Step 1: Create new enum type without RFP_Answered and with RFP_Delivered
DO $$ BEGIN
    CREATE TYPE "VendorStatus_new" AS ENUM (
        'Pending',
        'RFI_Received',
        'RFI_Started',
        'RFI_Answered',
        'RFP_Received',
        'RFP_Delivered',
        'RFP_Rejected',
        'Shortlisted',
        'Lost',
        'Won'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Alter the column to use the new enum type, mapping RFP_Answered to RFP_Delivered
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" TYPE "VendorStatus_new" USING (
    CASE 
        WHEN "status"::text = 'RFP_Answered' THEN 'RFP_Delivered'::"VendorStatus_new"
        ELSE "status"::text::"VendorStatus_new"
    END
);
ALTER TABLE "ProjectVendor" ALTER COLUMN "status" SET DEFAULT 'Pending';

-- Step 3: Drop the old enum type and rename the new one
DROP TYPE "VendorStatus";
ALTER TYPE "VendorStatus_new" RENAME TO "VendorStatus";

