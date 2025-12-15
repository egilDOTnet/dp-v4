import { PrismaClient } from "@prisma/client";

// Re-export commonly used Prisma types and enums
export { RequirementStatus, RequirementType, Role, VendorStatus, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Verify that new models are available (helps catch when Prisma client needs regeneration)
if (process.env.NODE_ENV === "development") {
  if (!("projectVendor" in db)) {
    console.warn(
      "⚠️  Warning: Prisma client may be missing new models. Please restart the API server after running 'pnpm prisma generate'"
    );
  }
  // Check for RFI models
  if (!("rFI" in db)) {
    console.warn(
      "⚠️  Warning: RFI models not found in Prisma client. Please run 'pnpm prisma generate' in packages/db and restart the API server."
    );
  }
}

