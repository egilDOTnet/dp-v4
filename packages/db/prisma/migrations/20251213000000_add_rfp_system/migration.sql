-- CreateEnum
CREATE TYPE "RFPStatus" AS ENUM ('Draft', 'Published', 'Closed');

-- CreateEnum
CREATE TYPE "RFPScheduleItemType" AS ENUM ('StartDate', 'AcceptanceDate', 'QuestionsDate', 'DeliveryDate', 'CustomDate', 'CustomDateRange');

-- CreateEnum
CREATE TYPE "RFPDocumentType" AS ENUM ('Document', 'Link');

-- CreateTable
CREATE TABLE "RFP" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "RFPStatus" NOT NULL DEFAULT 'Draft',
    "contactPersonId" TEXT,
    "alternativeContactPersonId" TEXT,
    "publishDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPScheduleItem" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "type" "RFPScheduleItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPDocument" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "type" "RFPDocumentType" NOT NULL,
    "description" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "fileData" TEXT,
    "fileSize" INTEGER,
    "url" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPChangelogEntry" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPQuestion" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "cleanedQuestion" TEXT,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredById" TEXT,
    "vendorId" TEXT NOT NULL,
    "contactPersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFPAnnouncement" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFPAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFP_projectId_key" ON "RFP"("projectId");

-- CreateIndex
CREATE INDEX "RFP_projectId_idx" ON "RFP"("projectId");

-- CreateIndex
CREATE INDEX "RFP_contactPersonId_idx" ON "RFP"("contactPersonId");

-- CreateIndex
CREATE INDEX "RFP_alternativeContactPersonId_idx" ON "RFP"("alternativeContactPersonId");

-- CreateIndex
CREATE INDEX "RFPScheduleItem_rfpId_idx" ON "RFPScheduleItem"("rfpId");

-- CreateIndex
CREATE INDEX "RFPScheduleItem_rfpId_order_idx" ON "RFPScheduleItem"("rfpId", "order");

-- CreateIndex
CREATE INDEX "RFPDocument_rfpId_idx" ON "RFPDocument"("rfpId");

-- CreateIndex
CREATE INDEX "RFPDocument_rfpId_order_idx" ON "RFPDocument"("rfpId", "order");

-- CreateIndex
CREATE INDEX "RFPChangelogEntry_rfpId_idx" ON "RFPChangelogEntry"("rfpId");

-- CreateIndex
CREATE INDEX "RFPChangelogEntry_createdById_idx" ON "RFPChangelogEntry"("createdById");

-- CreateIndex
CREATE INDEX "RFPQuestion_rfpId_idx" ON "RFPQuestion"("rfpId");

-- CreateIndex
CREATE INDEX "RFPQuestion_vendorId_idx" ON "RFPQuestion"("vendorId");

-- CreateIndex
CREATE INDEX "RFPQuestion_contactPersonId_idx" ON "RFPQuestion"("contactPersonId");

-- CreateIndex
CREATE INDEX "RFPQuestion_answeredById_idx" ON "RFPQuestion"("answeredById");

-- CreateIndex
CREATE INDEX "RFPAnnouncement_rfpId_idx" ON "RFPAnnouncement"("rfpId");

-- CreateIndex
CREATE INDEX "RFPAnnouncement_createdById_idx" ON "RFPAnnouncement"("createdById");

-- AddForeignKey
ALTER TABLE "RFP" ADD CONSTRAINT "RFP_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFP" ADD CONSTRAINT "RFP_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFP" ADD CONSTRAINT "RFP_alternativeContactPersonId_fkey" FOREIGN KEY ("alternativeContactPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPScheduleItem" ADD CONSTRAINT "RFPScheduleItem_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPDocument" ADD CONSTRAINT "RFPDocument_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPChangelogEntry" ADD CONSTRAINT "RFPChangelogEntry_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPChangelogEntry" ADD CONSTRAINT "RFPChangelogEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPQuestion" ADD CONSTRAINT "RFPQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPQuestion" ADD CONSTRAINT "RFPQuestion_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPQuestion" ADD CONSTRAINT "RFPQuestion_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "VendorContactPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPQuestion" ADD CONSTRAINT "RFPQuestion_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPAnnouncement" ADD CONSTRAINT "RFPAnnouncement_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFPAnnouncement" ADD CONSTRAINT "RFPAnnouncement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

