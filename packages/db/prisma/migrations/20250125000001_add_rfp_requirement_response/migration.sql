-- CreateEnum
CREATE TYPE "RequirementAnswer" AS ENUM ('Yes', 'No', 'Partial', 'Development');

-- CreateTable
CREATE TABLE "RFPRequirementResponse" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "vendorResponseId" TEXT NOT NULL,
    "answer" "RequirementAnswer",
    "description" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPRequirementResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFPRequirementResponse_requirementId_vendorResponseId_key" ON "RFPRequirementResponse"("requirementId", "vendorResponseId");

-- CreateIndex
CREATE INDEX "RFPRequirementResponse_vendorResponseId_idx" ON "RFPRequirementResponse"("vendorResponseId");

-- CreateIndex
CREATE INDEX "RFPRequirementResponse_requirementId_idx" ON "RFPRequirementResponse"("requirementId");

-- AddForeignKey
ALTER TABLE "RFPRequirementResponse" ADD CONSTRAINT "RFPRequirementResponse_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPRequirementResponse" ADD CONSTRAINT "RFPRequirementResponse_vendorResponseId_fkey" FOREIGN KEY ("vendorResponseId") REFERENCES "RFPVendorResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;



