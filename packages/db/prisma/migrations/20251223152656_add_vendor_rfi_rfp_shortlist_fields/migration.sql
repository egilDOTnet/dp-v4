-- Add three boolean fields to Vendor table for RFI/RFP/Shortlist flags
ALTER TABLE "Vendor" ADD COLUMN "shallReceiveRFI" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN "shallReceiveRFP" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vendor" ADD COLUMN "shallReceiveShortlist" BOOLEAN NOT NULL DEFAULT false;

