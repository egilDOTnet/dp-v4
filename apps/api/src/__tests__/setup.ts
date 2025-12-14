import { beforeAll, afterAll, beforeEach } from "vitest";

/**
 * TEST DATABASE SAFETY
 * 
 * This setup file ensures tests ONLY run against a test database (app_test),
 * NEVER against your development or production database.
 * 
 * CRITICAL: DATABASE_URL must be set BEFORE importing the db module,
 * because Prisma Client reads DATABASE_URL when it's instantiated.
 * 
 * Safety measures:
 * 1. DATABASE_URL is set to test database BEFORE importing db module
 * 2. Tests require a database name containing 'test' or '_test'
 * 3. cleanupDatabase() has additional safety checks before deleting data
 * 4. Database is cleaned before each test for isolation (not after, to avoid redundancy)
 * 
 * Your development database is SAFE - tests will fail with an error if you try to
 * run them against a non-test database.
 */

// Set test environment variables FIRST, before any database imports
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";

// Enforce test database usage with safety checks
// IMPORTANT: This must happen BEFORE importing @dp/db
const defaultTestDbUrl = "postgresql://postgres:postgres@localhost:5432/app_test";
const testDbUrl = process.env.TEST_DATABASE_URL || defaultTestDbUrl;

// Extract database name from URL for safety check
let dbName: string;
try {
  const url = new URL(testDbUrl);
  dbName = url.pathname.replace('/', '');
} catch (error) {
  throw new Error(
    `Invalid TEST_DATABASE_URL format: ${testDbUrl}. ` +
    `Expected format: postgresql://user:password@host:port/database`
  );
}

// Safety check: ensure we're using a test database
// This prevents accidentally running tests against production/development databases
if (!dbName.includes('test') && !dbName.includes('_test')) {
  throw new Error(
    `⚠️  SAFETY CHECK FAILED: Test database name must contain 'test'. ` +
    `Current database: ${dbName}. ` +
    `This prevents accidentally deleting production/development data. ` +
    `Set TEST_DATABASE_URL to a test database (e.g., app_test) to continue.`
  );
}

// CRITICAL: Set DATABASE_URL BEFORE importing db module
// Prisma Client reads DATABASE_URL when it's instantiated, so we must set it first
process.env.DATABASE_URL = testDbUrl;

// Clear any cached Prisma client instance to ensure we get a fresh one with the test DATABASE_URL
// This is critical because Prisma Client is cached globally and might have been created
// with the development DATABASE_URL from .env files
const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

// Disconnect and clear any existing Prisma client that might have been created
// with the wrong DATABASE_URL
if (globalForPrisma.prisma) {
  try {
    // Use a promise to handle the async disconnect
    const disconnectPromise = globalForPrisma.prisma.$disconnect().catch(() => {});
    // We can't await at top level, but we'll handle this in beforeAll
    globalForPrisma.disconnectPromise = disconnectPromise;
  } catch {
    // Ignore errors
  }
  delete globalForPrisma.prisma;
}

// Now import db - it will use the test database URL we just set
import { db } from "@dp/db";
import { cleanupDatabase } from "./utils/db-helpers";

beforeAll(async () => {
  // Wait for any pending disconnect from top-level cleanup
  const globalForPrisma = globalThis as unknown as {
    prisma: any;
    disconnectPromise?: Promise<void>;
  };
  if (globalForPrisma.disconnectPromise) {
    await globalForPrisma.disconnectPromise;
    delete globalForPrisma.disconnectPromise;
  }

  // Disconnect any existing connection
  if (globalForPrisma.prisma) {
    try {
      await globalForPrisma.prisma.$disconnect();
    } catch {
      // Ignore if not connected
    }
  }

  // Disconnect the current db instance if it exists
  try {
    await db.$disconnect();
  } catch {
    // Ignore if not connected
  }

  // CRITICAL: Create a new PrismaClient instance with the test DATABASE_URL
  // and replace the global cache so all imports of db will use this instance
  const { PrismaClient } = await import("@prisma/client");
  const testDb = new PrismaClient({
    log: ["error"],
  });
  
  // Replace the global instance - this ensures the db export uses our test client
  globalForPrisma.prisma = testDb;
  
  // Also replace the db object's methods by patching it
  // This is necessary because the db export is already created
  Object.setPrototypeOf(db, testDb);
  Object.assign(db, testDb);

  // Verify database connection to the test database
  try {
    await testDb.$connect();
    
    // CRITICAL SAFETY CHECK: Verify we're actually connected to the test database
    const result = await testDb.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database();
    `;
    const connectedDbName = result[0]?.current_database;
    
    if (connectedDbName !== dbName) {
      const errorMessage = 
        `⚠️  CRITICAL SAFETY CHECK FAILED: Connected to wrong database!\n` +
        `   Expected test database: ${dbName}\n` +
        `   Actually connected to: ${connectedDbName}\n` +
        `   This could mean your development database is at risk!\n` +
        `   Aborting tests to prevent data loss.`;
      console.error(errorMessage);
      await testDb.$disconnect();
      throw new Error(errorMessage);
    }
    
    console.log(`✅ Test database connected: ${dbName}`);
    console.log(`   Using database URL: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`   Verified connection to: ${connectedDbName}`);
  } catch (error) {
    console.error("❌ Failed to connect to test database:", error);
    throw error;
  }
});

afterAll(async () => {
  const globalForPrisma = globalThis as unknown as {
    prisma: any;
  };
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
  }
  console.log(`✅ Test database disconnected: ${dbName}`);
});

beforeEach(async () => {
  // Clean up database before each test to ensure test isolation
  // NOTE: This only cleans the TEST database (app_test), never your development database
  await cleanupDatabase();
});

// Removed afterEach cleanup - it's redundant since we clean before each test
// This ensures tests are isolated without unnecessary cleanup operations
