-- AlterTable
ALTER TABLE "RFIVendorResponse" ADD COLUMN "magicLinkToken" TEXT;
ALTER TABLE "RFIVendorResponse" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "RFIVendorResponse_magicLinkToken_key" ON "RFIVendorResponse"("magicLinkToken");

-- CreateIndex
CREATE INDEX "RFIVendorResponse_magicLinkToken_idx" ON "RFIVendorResponse"("magicLinkToken");




