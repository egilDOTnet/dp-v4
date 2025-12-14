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
  // This is a CRITICAL safety check to prevent accidental deletion of development/production data
  if (!dbName.includes('test') && !dbName.includes('_test')) {
    const errorMessage = 
      `⚠️  SAFETY CHECK FAILED: cleanupDatabase() cannot run against non-test database. ` +
      `Database name: ${dbName}. ` +
      `This function deletes ALL data and should only run against test databases. ` +
      `If you need to clean a test database, ensure DATABASE_URL points to a database ` +
      `with 'test' in its name (e.g., app_test). ` +
      `Your development database (${dbName}) is SAFE and will NOT be modified.`;
    
    console.error(errorMessage);
    throw new Error(`Cannot cleanup non-test database: ${dbName}`);
  }

  // Log which test database is being cleaned (only in verbose mode to avoid spam)
  if (process.env.VITEST_VERBOSE) {
    console.log(`🧹 Cleaning test database: ${dbName}`);
  }

  // Delete in reverse order of dependencies to avoid foreign key constraints
  // Use proper Prisma model names (camelCase)
  try {
    await db.rFPQuestion.deleteMany({});
  } catch (error) {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPChangelogEntry.deleteMany({});
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
    await db.rFPScheduleItem.deleteMany({});
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
    await db.vendorContactPerson.deleteMany({});
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
    await db.vendor.deleteMany({});
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
  
  // Ensure tenant exists - always verify/ensure tenant exists
  // This handles both cases: when tenantId is provided (from test) or when using default
  const existingTenant = await db.tenant.findUnique({
    where: { id: tenantId },
  });
  
  if (!existingTenant) {
    // Tenant doesn't exist, create it
    await db.tenant.create({
      data: {
        id: tenantId,
        name: "Test Company",
        updatedAt: new Date(),
      },
    });
  }

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
      updatedAt: new Date(),
    },
  });

  return project;
}

/**
 * Create a project member relationship
 */
export async function createTestProjectMember(overrides?: {
  projectId: string;
  userId: string;
  id?: string;
}) {
  if (!overrides?.projectId || !overrides?.userId) {
    throw new Error("projectId and userId are required");
  }

  const member = await db.projectMember.create({
    data: {
      id: overrides.id || `test-member-${Date.now()}`,
      projectId: overrides.projectId,
      userId: overrides.userId,
    },
  });

  return member;
}

/**
 * Create a test phase
 */
export async function createTestPhase(overrides?: {
  id?: string;
  projectId: string;
  name?: string;
  order?: number;
}) {
  if (!overrides?.projectId) {
    throw new Error("projectId is required");
  }

  const phase = await db.phase.create({
    data: {
      id: overrides.id || `test-phase-${Date.now()}`,
      projectId: overrides.projectId,
      name: overrides.name || "Test Phase",
      order: overrides.order ?? 0,
      updatedAt: new Date(),
    },
  });

  return phase;
}

/**
 * Create a test task
 */
export async function createTestTask(overrides?: {
  id?: string;
  phaseId: string;
  name?: string;
  description?: string | null;
  ownerId?: string | null;
  order?: number;
  plannedCompletionDate?: Date | null;
  actualCompletionDate?: Date | null;
}) {
  if (!overrides?.phaseId) {
    throw new Error("phaseId is required");
  }

  const task = await db.task.create({
    data: {
      id: overrides.id || `test-task-${Date.now()}`,
      phaseId: overrides.phaseId,
      name: overrides.name || "Test Task",
      description: overrides.description ?? null,
      ownerId: overrides.ownerId ?? null,
      order: overrides.order ?? 1,
      plannedCompletionDate: overrides.plannedCompletionDate ?? null,
      actualCompletionDate: overrides.actualCompletionDate ?? null,
    },
  });

  return task;
}

/**
 * Create a test vendor
 */
export async function createTestVendor(overrides?: {
  id?: string;
  name?: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
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

  const vendor = await db.vendor.create({
    data: {
      id: overrides.id || `test-vendor-${Date.now()}`,
      name: overrides.name || "Test Vendor",
      organizationNumber: overrides.organizationNumber ?? null,
      emailDomain: overrides.emailDomain ?? null,
      tenantId,
    },
  });

  return vendor;
}

/**
 * Create a project-vendor relationship
 */
export async function createTestProjectVendor(overrides?: {
  id?: string;
  projectId: string;
  vendorId: string;
  status?: string;
}) {
  if (!overrides?.projectId || !overrides?.vendorId) {
    throw new Error("projectId and vendorId are required");
  }

  const projectVendor = await db.projectVendor.create({
    data: {
      id: overrides.id || `test-project-vendor-${Date.now()}`,
      projectId: overrides.projectId,
      vendorId: overrides.vendorId,
      status: overrides.status || "Pending",
    },
  });

  return projectVendor;
}

/**
 * Create a test requirement hierarchy
 */
export async function createTestRequirementHierarchy(overrides?: {
  id?: string;
  projectId: string;
  parentId?: string | null;
  title?: string;
  description?: string | null;
  number?: string;
  order?: number;
}) {
  if (!overrides?.projectId) {
    throw new Error("projectId is required");
  }

  const hierarchy = await db.requirementHierarchy.create({
    data: {
      id: overrides.id || `test-hierarchy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      projectId: overrides.projectId,
      parentId: overrides.parentId ?? null,
      title: overrides.title || "Test Hierarchy",
      description: overrides.description ?? null,
      number: overrides.number || "1.",
      order: overrides.order ?? 1,
    },
  });

  return hierarchy;
}

/**
 * Create a test requirement
 */
export async function createTestRequirement(overrides?: {
  id?: string;
  hierarchyId: string;
  description?: string;
  type?: string;
  status?: string | null;
  number?: string;
  order?: number;
  createdById: string;
  lastModifiedById: string;
}) {
  if (!overrides?.hierarchyId || !overrides?.createdById || !overrides?.lastModifiedById) {
    throw new Error("hierarchyId, createdById, and lastModifiedById are required");
  }

  const requirement = await db.requirement.create({
    data: {
      id: overrides.id || `test-requirement-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      hierarchyId: overrides.hierarchyId,
      description: overrides.description || "Test Requirement",
      type: (overrides.type || "Information") as any,
      status: (overrides.status ?? null) as any,
      number: overrides.number || "1.1.",
      order: overrides.order ?? 1,
      createdById: overrides.createdById,
      lastModifiedById: overrides.lastModifiedById,
    },
  });

  return requirement;
}

/**
 * Create a test RFI
 */
export async function createTestRFI(overrides?: {
  id?: string;
  projectId: string;
  emailSubject?: string;
  emailText?: string;
  rfiInformation?: string;
  deadline?: Date | null;
  autoPublishDate?: Date | null;
  isPublished?: boolean;
  publishedAt?: Date | null;
  unpublishedAt?: Date | null;
}) {
  if (!overrides?.projectId) {
    throw new Error("projectId is required");
  }

  const rfi = await db.rFI.create({
    data: {
      id: overrides.id || `test-rfi-${Date.now()}`,
      projectId: overrides.projectId,
      emailSubject: overrides.emailSubject || "Test RFI Subject",
      emailText: overrides.emailText || "Test RFI Email Text",
      rfiInformation: overrides.rfiInformation || "Test RFI Information",
      deadline: overrides.deadline ?? null,
      autoPublishDate: overrides.autoPublishDate ?? null,
      isPublished: overrides.isPublished ?? false,
      publishedAt: overrides.publishedAt ?? null,
      unpublishedAt: overrides.unpublishedAt ?? null,
    },
  });

  return rfi;
}

/**
 * Create a test RFI question
 */
export async function createTestRFIQuestion(overrides?: {
  id?: string;
  rfiId: string;
  title?: string;
  description?: string | null;
  type?: string;
  order?: number;
  required?: boolean;
  scaleLabels?: string | null;
}) {
  if (!overrides?.rfiId) {
    throw new Error("rfiId is required");
  }

  const question = await db.rFIQuestion.create({
    data: {
      id: overrides.id || `test-rfi-question-${Date.now()}`,
      rfiId: overrides.rfiId,
      title: overrides.title || "Test Question",
      description: overrides.description ?? null,
      type: (overrides.type || "SingleText") as any,
      order: overrides.order ?? 1,
      required: overrides.required ?? false,
      scaleLabels: overrides.scaleLabels ?? null,
    },
  });

  return question;
}

/**
 * Create a test RFI question option
 */
export async function createTestRFIQuestionOption(overrides?: {
  id?: string;
  questionId: string;
  label?: string;
  value?: string | null;
  xAxis?: boolean;
  yAxis?: boolean;
  order?: number;
}) {
  if (!overrides?.questionId) {
    throw new Error("questionId is required");
  }

  const option = await db.rFIQuestionOption.create({
    data: {
      id: overrides.id || `test-rfi-option-${Date.now()}`,
      questionId: overrides.questionId,
      label: overrides.label || "Test Option",
      value: overrides.value ?? null,
      xAxis: overrides.xAxis ?? false,
      yAxis: overrides.yAxis ?? false,
      order: overrides.order ?? 1,
    },
  });

  return option;
}

/**
 * Create a test RFI vendor response
 */
export async function createTestRFIVendorResponse(overrides?: {
  id?: string;
  rfiId: string;
  projectVendorId: string;
  contactPersonId: string;
  status?: string;
  sentAt?: Date | null;
  answeredAt?: Date | null;
}) {
  if (!overrides?.rfiId || !overrides?.projectVendorId || !overrides?.contactPersonId) {
    throw new Error("rfiId, projectVendorId, and contactPersonId are required");
  }

  const response = await db.rFIVendorResponse.create({
    data: {
      id: overrides.id || `test-rfi-vendor-response-${Date.now()}`,
      rfiId: overrides.rfiId,
      projectVendorId: overrides.projectVendorId,
      contactPersonId: overrides.contactPersonId,
      status: (overrides.status || "Sent") as any,
      sentAt: overrides.sentAt ?? null,
      answeredAt: overrides.answeredAt ?? null,
    },
  });

  return response;
}

/**
 * Create a test vendor contact person
 */
export async function createTestVendorContactPerson(overrides?: {
  id?: string;
  vendorId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  isMainContact?: boolean;
}) {
  if (!overrides?.vendorId) {
    throw new Error("vendorId is required");
  }

  const contactPerson = await db.vendorContactPerson.create({
    data: {
      id: overrides.id || `test-vendor-contact-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      vendorId: overrides.vendorId,
      firstName: overrides.firstName || "John",
      lastName: overrides.lastName || "Doe",
      email: overrides.email || `contact-${Date.now()}@example.com`,
      phone: overrides.phone ?? null,
      isMainContact: overrides.isMainContact ?? false,
    },
  });

  return contactPerson;
}

/**
 * Create a test RFP
 */
export async function createTestRFP(overrides?: {
  id?: string;
  projectId: string;
  status?: "Draft" | "Published" | "Closed";
  contactPersonId?: string | null;
  alternativeContactPersonId?: string | null;
  publishDate?: Date | null;
  deliveryDate?: Date | null;
}) {
  if (!overrides?.projectId) {
    throw new Error("projectId is required");
  }

  const rfp = await db.rFP.create({
    data: {
      id: overrides.id || `test-rfp-${Date.now()}`,
      projectId: overrides.projectId,
      status: (overrides.status || "Draft") as any,
      contactPersonId: overrides.contactPersonId ?? null,
      alternativeContactPersonId: overrides.alternativeContactPersonId ?? null,
      publishDate: overrides.publishDate ?? null,
      deliveryDate: overrides.deliveryDate ?? null,
    },
  });

  return rfp;
}

/**
 * Create a test RFP schedule item
 */
export async function createTestRFPScheduleItem(overrides?: {
  id?: string;
  rfpId: string;
  type?: "StartDate" | "AcceptanceDate" | "QuestionsDate" | "DeliveryDate" | "CustomDate" | "CustomDateRange";
  description?: string;
  date?: Date | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  order?: number;
  isRequired?: boolean;
}) {
  if (!overrides?.rfpId) {
    throw new Error("rfpId is required");
  }

  const item = await db.rFPScheduleItem.create({
    data: {
      id: overrides.id || `test-rfp-schedule-${Date.now()}`,
      rfpId: overrides.rfpId,
      type: (overrides.type || "CustomDate") as any,
      description: overrides.description || "Test Schedule Item",
      date: overrides.date ?? null,
      fromDate: overrides.fromDate ?? null,
      toDate: overrides.toDate ?? null,
      order: overrides.order ?? 0,
      isRequired: overrides.isRequired ?? false,
    },
  });

  return item;
}

/**
 * Create a test RFP document
 */
export async function createTestRFPDocument(overrides?: {
  id?: string;
  rfpId: string;
  type?: "Document" | "Link";
  description?: string;
  fileName?: string | null;
  fileType?: string | null;
  fileData?: string | null;
  fileSize?: number | null;
  url?: string | null;
  order?: number;
}) {
  if (!overrides?.rfpId) {
    throw new Error("rfpId is required");
  }

  const document = await db.rFPDocument.create({
    data: {
      id: overrides.id || `test-rfp-document-${Date.now()}`,
      rfpId: overrides.rfpId,
      type: (overrides.type || "Link") as any,
      description: overrides.description || "Test Document",
      fileName: overrides.fileName ?? null,
      fileType: overrides.fileType ?? null,
      fileData: overrides.fileData ?? null,
      fileSize: overrides.fileSize ?? null,
      url: overrides.url ?? null,
      order: overrides.order ?? 0,
    },
  });

  return document;
}

/**
 * Create a test RFP changelog entry
 */
export async function createTestRFPChangelogEntry(overrides?: {
  id?: string;
  rfpId: string;
  description?: string;
  createdById: string;
}) {
  if (!overrides?.rfpId || !overrides?.createdById) {
    throw new Error("rfpId and createdById are required");
  }

  const entry = await db.rFPChangelogEntry.create({
    data: {
      id: overrides.id || `test-rfp-changelog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      rfpId: overrides.rfpId,
      description: overrides.description || "Test changelog entry",
      createdById: overrides.createdById,
    },
  });

  return entry;
}

/**
 * Create a test RFP question
 */
export async function createTestRFPQuestion(overrides?: {
  id?: string;
  rfpId: string;
  question?: string;
  cleanedQuestion?: string | null;
  answer?: string | null;
  answeredAt?: Date | null;
  answeredById?: string | null;
  vendorId: string;
  contactPersonId: string;
  createdAt?: Date;
}) {
  if (!overrides?.rfpId || !overrides?.vendorId || !overrides?.contactPersonId) {
    throw new Error("rfpId, vendorId, and contactPersonId are required");
  }

  const question = await db.rFPQuestion.create({
    data: {
      id: overrides.id || `test-rfp-question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      rfpId: overrides.rfpId,
      question: overrides.question || "Test question?",
      cleanedQuestion: overrides.cleanedQuestion ?? null,
      answer: overrides.answer ?? null,
      answeredAt: overrides.answeredAt ?? null,
      answeredById: overrides.answeredById ?? null,
      vendorId: overrides.vendorId,
      contactPersonId: overrides.contactPersonId,
      createdAt: overrides.createdAt,
    },
  });

  return question;
}

/**
 * Create a test RFP announcement
 */
export async function createTestRFPAnnouncement(overrides?: {
  id?: string;
  rfpId: string;
  title?: string;
  description?: string;
  sentAt?: Date | null;
  scheduledSendAt?: Date | null;
  createdById: string;
}) {
  if (!overrides?.rfpId || !overrides?.createdById) {
    throw new Error("rfpId and createdById are required");
  }

  const announcement = await db.rFPAnnouncement.create({
    data: {
      id: overrides.id || `test-rfp-announcement-${Date.now()}`,
      rfpId: overrides.rfpId,
      title: overrides.title || "Test Announcement",
      description: overrides.description || "Test announcement description",
      sentAt: overrides.sentAt ?? null,
      scheduledSendAt: overrides.scheduledSendAt ?? null,
      createdById: overrides.createdById,
    },
  });

  return announcement;
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
