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
} catch {
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
import { ensureTestDatabase } from "./utils/ensure-test-db";

beforeAll(async () => {
  // Ensure test database exists before connecting
  // This prevents connection errors and automatically creates the database if needed
  await ensureTestDatabase(testDbUrl);
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
  // Prisma 7 requires an adapter to be provided
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");

  const testPool = new Pool({
    connectionString: testDbUrl,
  });
  const testAdapter = new PrismaPg(testPool);

  const testDb = new PrismaClient({
    adapter: testAdapter,
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
    
    // Apply migrations to test database
    // This ensures the test database schema is up-to-date
    try {
      console.log(`🔄 Applying migrations to test database...`);
      const { execSync } = await import("child_process");
      const { resolve } = await import("path");
      
      // Get the packages/db directory path
      const dbPackagePath = resolve(__dirname, "../../../../packages/db");
      
      // Run prisma migrate deploy
      execSync(
        `pnpm prisma migrate deploy`,
        {
          cwd: dbPackagePath,
          env: {
            ...process.env,
            DATABASE_URL: testDbUrl,
          },
          stdio: "pipe", // Suppress output unless there's an error
        }
      );
      console.log(`✅ Migrations applied successfully`);
    } catch (migrationError: any) {
      // If migrations fail, log but don't fail the test setup
      // This allows tests to run even if migrations have issues
      // (e.g., if database already has schema but migration history is incomplete)
      console.warn(`⚠️  Migration deployment warning:`, migrationError.message);
      console.warn(`   Tests may still run if database schema is already up-to-date`);
    }
  } catch (error: any) {
    // Extract detailed error information
    const errorCode = error.code || error.cause?.code;
    const errorMessage = error.message || error.cause?.message || String(error);
    
    // If connection fails, the database might not exist
    // ensureTestDatabase should have created it, but if it didn't, provide helpful error
    if (errorMessage?.includes("does not exist") || errorCode === "3D000") {
      throw new Error(
        `❌ Test database '${dbName}' does not exist.\n` +
          `   Run: pnpm --filter @dp/db db:setup-test\n` +
          `   Or ensure PostgreSQL is running: docker-compose up -d postgres`
      );
    }

    // Check for specific PostgreSQL error codes and provide targeted messages
    let troubleshooting = "";
    if (errorCode === "ECONNREFUSED") {
      troubleshooting = `PostgreSQL server is not running or not accessible.\n` +
        `   - Start PostgreSQL: docker-compose up -d postgres\n` +
        `   - Or start your local PostgreSQL service\n` +
        `   - Check if PostgreSQL is running on a different port`;
    } else if (errorCode === "ETIMEDOUT") {
      troubleshooting = `Connection to PostgreSQL timed out.\n` +
        `   - Check if PostgreSQL is running: docker-compose ps\n` +
        `   - Verify network connectivity\n` +
        `   - Check firewall settings`;
    } else if (errorCode === "28P01") {
      troubleshooting = `Authentication failed for PostgreSQL.\n` +
        `   - Check username and password in TEST_DATABASE_URL\n` +
        `   - Verify PostgreSQL user credentials\n` +
        `   - Check pg_hba.conf configuration`;
    } else {
      troubleshooting = `Connection failed with error code: ${errorCode || "unknown"}\n` +
        `   - Ensure PostgreSQL is running: docker-compose up -d postgres\n` +
        `   - Check connection string: ${testDbUrl.replace(/:[^:@]+@/, ":****@")}\n` +
        `   - Run: pnpm --filter @dp/db db:setup-test`;
    }

    console.error("❌ Failed to connect to test database:");
    console.error(`   Error code: ${errorCode || "unknown"}`);
    console.error(`   Error message: ${errorMessage}`);
    
    throw new Error(
      `❌ Failed to connect to test database '${dbName}'\n` +
      `   ${troubleshooting}`
    );
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
