import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { db } from "@dp/db";
import { cleanupDatabase } from "./utils/db-helpers";

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";

// Enforce test database usage with safety checks
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

process.env.DATABASE_URL = testDbUrl;

beforeAll(async () => {
  // Verify database connection
  try {
    await db.$connect();
    console.log("✅ Test database connected");
  } catch (error) {
    console.error("❌ Failed to connect to test database:", error);
    throw error;
  }
});

afterAll(async () => {
  await db.$disconnect();
  console.log("✅ Test database disconnected");
});

beforeEach(async () => {
  // Clean up database before each test
  await cleanupDatabase();
});

afterEach(async () => {
  // Clean up database after each test
  await cleanupDatabase();
});
