-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('Trial', 'Active', 'Expired');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('Projects1', 'Projects2', 'Projects5', 'Unlimited');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "organizationNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "emailDomain" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'Trial';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionTier" "SubscriptionTier";
ALTER TABLE "Tenant" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "trialStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tenant_organizationNumber_idx" ON "Tenant"("organizationNumber");

-- CreateIndex
CREATE INDEX "Tenant_subscriptionStatus_idx" ON "Tenant"("subscriptionStatus");

