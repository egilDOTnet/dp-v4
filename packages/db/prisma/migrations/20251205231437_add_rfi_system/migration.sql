-- CreateEnum
CREATE TYPE "RFIQuestionType" AS ENUM ('YesNo', 'Dropdown', 'MultipleChoice', 'Scale', 'ContactDetails', 'SingleText', 'MultilineText');

-- CreateEnum
CREATE TYPE "RFIVendorResponseStatus" AS ENUM ('Sent', 'Received', 'Answered', 'Rejected');

-- AlterTable
ALTER TABLE "VendorContactPerson" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- CreateTable
CREATE TABLE "RFI" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "emailText" TEXT DEFAULT '',
    "rfiInformation" TEXT DEFAULT '',
    "deadline" TIMESTAMP(3),
    "autoPublishDate" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFIQuestion" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "RFIQuestionType" NOT NULL,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "scaleLabels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFIQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFIQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "xAxis" BOOLEAN NOT NULL DEFAULT false,
    "yAxis" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFIQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFIVendorResponse" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "projectVendorId" TEXT NOT NULL,
    "contactPersonId" TEXT NOT NULL,
    "status" "RFIVendorResponseStatus" NOT NULL DEFAULT 'Sent',
    "sentAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFIVendorResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFIResponse" (
    "id" TEXT NOT NULL,
    "vendorResponseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFIResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFI_projectId_key" ON "RFI"("projectId");

-- CreateIndex
CREATE INDEX "RFI_projectId_idx" ON "RFI"("projectId");

-- CreateIndex
CREATE INDEX "RFIQuestion_rfiId_idx" ON "RFIQuestion"("rfiId");

-- CreateIndex
CREATE INDEX "RFIQuestion_rfiId_order_idx" ON "RFIQuestion"("rfiId", "order");

-- CreateIndex
CREATE INDEX "RFIQuestionOption_questionId_idx" ON "RFIQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "RFIQuestionOption_questionId_order_idx" ON "RFIQuestionOption"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "RFIVendorResponse_rfiId_projectVendorId_key" ON "RFIVendorResponse"("rfiId", "projectVendorId");

-- CreateIndex
CREATE INDEX "RFIVendorResponse_rfiId_idx" ON "RFIVendorResponse"("rfiId");

-- CreateIndex
CREATE INDEX "RFIVendorResponse_projectVendorId_idx" ON "RFIVendorResponse"("projectVendorId");

-- CreateIndex
CREATE INDEX "RFIVendorResponse_contactPersonId_idx" ON "RFIVendorResponse"("contactPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "RFIResponse_vendorResponseId_questionId_key" ON "RFIResponse"("vendorResponseId", "questionId");

-- CreateIndex
CREATE INDEX "RFIResponse_vendorResponseId_idx" ON "RFIResponse"("vendorResponseId");

-- CreateIndex
CREATE INDEX "RFIResponse_questionId_idx" ON "RFIResponse"("questionId");

-- AddForeignKey
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIQuestion" ADD CONSTRAINT "RFIQuestion_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "RFI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIQuestionOption" ADD CONSTRAINT "RFIQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RFIQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIVendorResponse" ADD CONSTRAINT "RFIVendorResponse_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "RFI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIVendorResponse" ADD CONSTRAINT "RFIVendorResponse_projectVendorId_fkey" FOREIGN KEY ("projectVendorId") REFERENCES "ProjectVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIVendorResponse" ADD CONSTRAINT "RFIVendorResponse_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "VendorContactPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIResponse" ADD CONSTRAINT "RFIResponse_vendorResponseId_fkey" FOREIGN KEY ("vendorResponseId") REFERENCES "RFIVendorResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFIResponse" ADD CONSTRAINT "RFIResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RFIQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
