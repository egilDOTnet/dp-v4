-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "vendorResponseId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "score" INTEGER,
    "note" TEXT,
    "question" TEXT,
    "evaluatedById" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationHierarchyWeight" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "hierarchyId" TEXT NOT NULL,
    "level1HierarchyId" TEXT,
    "weight" DECIMAL(5,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationHierarchyWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPosition" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCheckTemplate" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCheckTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationScore_vendorResponseId_idx" ON "EvaluationScore"("vendorResponseId");

-- CreateIndex
CREATE INDEX "EvaluationScore_requirementId_idx" ON "EvaluationScore"("requirementId");

-- CreateIndex
CREATE INDEX "EvaluationScore_evaluatedById_idx" ON "EvaluationScore"("evaluatedById");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_vendorResponseId_requirementId_evaluatedById_key" ON "EvaluationScore"("vendorResponseId", "requirementId", "evaluatedById");

-- CreateIndex
CREATE INDEX "EvaluationHierarchyWeight_rfpId_idx" ON "EvaluationHierarchyWeight"("rfpId");

-- CreateIndex
CREATE INDEX "EvaluationHierarchyWeight_hierarchyId_idx" ON "EvaluationHierarchyWeight"("hierarchyId");

-- CreateIndex
CREATE INDEX "EvaluationHierarchyWeight_createdById_idx" ON "EvaluationHierarchyWeight"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationHierarchyWeight_rfpId_hierarchyId_level1HierarchyId_key" ON "EvaluationHierarchyWeight"("rfpId", "hierarchyId", "level1HierarchyId");

-- CreateIndex
CREATE INDEX "ReferenceCheck_projectId_idx" ON "ReferenceCheck"("projectId");

-- CreateIndex
CREATE INDEX "ReferenceCheck_vendorId_idx" ON "ReferenceCheck"("vendorId");

-- CreateIndex
CREATE INDEX "ReferenceCheck_createdById_idx" ON "ReferenceCheck"("createdById");

-- CreateIndex
CREATE INDEX "ReferenceCheckTemplate_updatedById_idx" ON "ReferenceCheckTemplate"("updatedById");

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_vendorResponseId_fkey" FOREIGN KEY ("vendorResponseId") REFERENCES "RFPVendorResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHierarchyWeight" ADD CONSTRAINT "EvaluationHierarchyWeight_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "RFP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHierarchyWeight" ADD CONSTRAINT "EvaluationHierarchyWeight_hierarchyId_fkey" FOREIGN KEY ("hierarchyId") REFERENCES "RequirementHierarchy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationHierarchyWeight" ADD CONSTRAINT "EvaluationHierarchyWeight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheck" ADD CONSTRAINT "ReferenceCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheck" ADD CONSTRAINT "ReferenceCheck_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheck" ADD CONSTRAINT "ReferenceCheck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceCheckTemplate" ADD CONSTRAINT "ReferenceCheckTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

