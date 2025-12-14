import { db } from "@dp/db";
import bcrypt from "bcrypt";

/**
 * Clean up all test data from the database
 * This should be run before and after each test to ensure isolation
 * 
 * SAFETY: This function will throw an error if not running against a test database
 * to prevent accidental deletion of production/development data.
 */
export async function cleanupDatabase() {
  // Safety check: ensure we're running against a test database
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL is not set. Cannot determine if this is a test database.'
    );
  }

  let dbName: string;
  try {
    const url = new URL(dbUrl);
    dbName = url.pathname.replace('/', '');
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL format: ${dbUrl}. Cannot verify test database safety.`
    );
  }

  // Safety check: prevent cleanup of non-test databases
  if (!dbName.includes('test') && !dbName.includes('_test')) {
    const errorMessage = 
      `⚠️  SAFETY CHECK FAILED: cleanupDatabase() cannot run against non-test database. ` +
      `Database name: ${dbName}. ` +
      `This function deletes ALL data and should only run against test databases. ` +
      `If you need to clean a test database, ensure DATABASE_URL points to a database ` +
      `with 'test' in its name (e.g., app_test).`;
    
    console.error(errorMessage);
    throw new Error(`Cannot cleanup non-test database: ${dbName}`);
  }

  // Delete in reverse order of dependencies to avoid foreign key constraints
  // Use proper Prisma model names (camelCase)
  try {
    await db.rFPQuestion.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPSchedule.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPAnnouncement.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPDocument.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFP.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFIQuestion.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFIVendorResponse.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFI.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.requirement.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.requirementHierarchy.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.task.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.phase.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.projectVendor.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.projectMember.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.project.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.user.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.tenant.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }
}

/**
 * Seed test data - creates a basic tenant and user for testing
 */
export async function seedTestData() {
  const tenant = await db.tenant.create({
    data: {
      id: "test-tenant-id",
      name: "Test Company",
    },
  });

  const user = await db.user.create({
    data: {
      id: "test-user-id",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      name: "Test User",
      role: "User",
      tenantId: tenant.id,
      passwordHash: await hashPassword("password123"),
    },
  });

  return { tenant, user };
}

/**
 * Create a test user with specified properties
 */
export async function createTestUser(overrides?: {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId?: string;
  passwordHash?: string | null;
}) {
  const tenantId = overrides?.tenantId || "test-tenant-id";
  
  // Ensure tenant exists
  await db.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: "Test Company",
      updatedAt: new Date(),
    },
    update: {},
  });

  const user = await db.user.create({
    data: {
      id: overrides?.id || `test-user-${Date.now()}`,
      email: overrides?.email || `test-${Date.now()}@example.com`,
      firstName: overrides?.firstName || "Test",
      lastName: overrides?.lastName || "User",
      name: `${overrides?.firstName || "Test"} ${overrides?.lastName || "User"}`,
      role: overrides?.role || "User",
      tenantId,
      passwordHash: overrides?.passwordHash !== undefined 
        ? overrides.passwordHash 
        : await hashPassword("password123"),
    },
  });

  return user;
}

/**
 * Create a test tenant
 */
export async function createTestTenant(overrides?: {
  id?: string;
  name?: string;
}) {
  const tenant = await db.tenant.create({
    data: {
      id: overrides?.id || `test-tenant-${Date.now()}`,
      name: overrides?.name || "Test Company",
      updatedAt: new Date(),
    },
  });

  return tenant;
}

/**
 * Create a test project
 */
export async function createTestProject(overrides?: {
  id?: string;
  name?: string;
  tenantId?: string;
}) {
  const tenantId = overrides?.tenantId || "test-tenant-id";
  
  // Ensure tenant exists
  await db.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: "Test Company",
      updatedAt: new Date(),
    },
    update: {},
  });

  const project = await db.project.create({
    data: {
      id: overrides?.id || `test-project-${Date.now()}`,
      name: overrides?.name || "Test Project",
      tenantId,
    },
  });

  return project;
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
