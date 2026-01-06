-- CreateEnum
CREATE TYPE "RFPVendorResponseStatus" AS ENUM ('Sent', 'Viewed', 'Participating', 'ProposalSubmitted', 'Declined');

-- CreateTable
CREATE TABLE "RFPVendorResponse" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "projectVendorId" TEXT NOT NULL,
    "contactPersonId" TEXT NOT NULL,
    "status" "RFPVendorResponseStatus" NOT NULL DEFAULT 'Sent',
    "participatedAt" TIMESTAMP(3),
    "proposalSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPVendorResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPProposalFile" (
    "id" TEXT NOT NULL,
    "vendorResponseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileData" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPProposalFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFPVendorResponse_rfpId_projectVendorId_key" ON "RFPVendorResponse"("rfpId", "projectVendorId");

-- CreateIndex
CREATE INDEX "RFPVendorResponse_rfpId_idx" ON "RFPVendorResponse"("rfpId");

-- CreateIndex
CREATE INDEX "RFPVendorResponse_projectVendorId_idx" ON "RFPVendorResponse"("projectVendorId");

-- CreateIndex
CREATE INDEX "RFPVendorResponse_contactPersonId_idx" ON "RFPVendorResponse"("contactPersonId");

-- CreateIndex
CREATE INDEX "RFPProposalFile_vendorResponseId_idx" ON "RFPProposalFile"("vendorResponseId");

-- CreateIndex
CREATE INDEX "RFPProposalFile_vendorResponseId_order_idx" ON "RFPProposalFile"("vendorResponseId", "order");

-- AddForeignKey
ALTER TABLE "RFPVendorResponse" ADD CONSTRAINT "RFPVendorResponse_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPVendorResponse" ADD CONSTRAINT "RFPVendorResponse_projectVendorId_fkey" FOREIGN KEY ("projectVendorId") REFERENCES "ProjectVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPVendorResponse" ADD CONSTRAINT "RFPVendorResponse_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "VendorContactPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPProposalFile" ADD CONSTRAINT "RFPProposalFile_vendorResponseId_fkey" FOREIGN KEY ("vendorResponseId") REFERENCES "RFPVendorResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;



