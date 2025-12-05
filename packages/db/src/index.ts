import { PrismaClient } from "@prisma/client";

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
if (process.env.NODE_ENV === "development" && !("projectVendor" in db)) {
  console.warn(
    "⚠️  Warning: Prisma client may be missing new models. Please restart the API server after running 'pnpm prisma generate'"
  );
}

