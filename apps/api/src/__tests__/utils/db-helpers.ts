import { db, Role, VendorStatus, Prisma } from "@dp/db";
import { RFPVendorResponseStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

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
  } catch {
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
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPChangelogEntry.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPAnnouncement.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPDocument.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFPScheduleItem.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFP.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFIQuestion.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFIVendorResponse.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.rFI.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.requirement.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.requirementHierarchy.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.task.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.phase.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.vendorContactPerson.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.projectVendor.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.projectMember.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.project.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.user.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.vendor.deleteMany({});
  } catch {
    // Ignore if model doesn't exist
  }

  try {
    await db.tenant.deleteMany({});
  } catch {
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
      updatedAt: new Date(),
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
  tenantId?: string | null;
  passwordHash?: string | null;
}) {
  // Handle tenantId: use provided value (including null), or default to "test-tenant-id"
  const tenantId = overrides?.tenantId !== undefined ? overrides.tenantId : "test-tenant-id";
  
  // Hash password before transaction to avoid async operations inside transaction
  const passwordHash = overrides?.passwordHash !== undefined 
    ? overrides.passwordHash 
    : await hashPassword("password123");
  
  // Use transaction to ensure tenant exists before creating user
  const user = await db.$transaction(async (tx) => {
    // Always ensure tenant exists if tenantId is not null
    if (tenantId !== null) {
      await tx.tenant.upsert({
        where: { id: tenantId },
        create: {
          id: tenantId,
          name: "Test Company",
          updatedAt: new Date(),
        },
        update: {
          updatedAt: new Date(),
        },
      });
    }

    // Create user in the same transaction - tenant is guaranteed to exist
    // Use crypto.randomUUID() to ensure unique emails even in parallel tests
    const uniqueId = randomUUID();
    const firstName = overrides?.firstName !== undefined ? overrides.firstName : "Test";
    const lastName = overrides?.lastName !== undefined ? overrides.lastName : "User";
    const name = firstName && lastName ? `${firstName} ${lastName}` : null;
    return await tx.user.create({
      data: {
        id: overrides?.id || `test-user-${uniqueId}`,
        email: overrides?.email || `test-${uniqueId}@example.com`,
        firstName,
        lastName,
        name,
        role: (overrides?.role || "User") as Role,
        tenantId,
        passwordHash,
      },
    });
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
  const tenantId = overrides?.id || `test-tenant-${randomUUID()}`;
  
  const tenant = await db.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: overrides?.name || "Test Company",
      updatedAt: new Date(),
    },
    update: {
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
  
  // Use transaction to ensure tenant exists before creating project
  const project = await db.$transaction(async (tx) => {
    // Ensure tenant exists
    await tx.tenant.upsert({
      where: { id: tenantId },
      create: {
        id: tenantId,
        name: "Test Company",
        updatedAt: new Date(),
      },
      update: {
        updatedAt: new Date(),
      },
    });

    // Create project in the same transaction - tenant is guaranteed to exist
    return await tx.project.create({
      data: {
        id: overrides?.id || `test-project-${randomUUID()}`,
        name: overrides?.name || "Test Project",
        tenantId,
        updatedAt: new Date(),
      },
    });
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

  // Use transaction to verify project and user exist before creating member
  const member = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // Verify user exists
    const user = await tx.user.findUnique({
      where: { id: overrides.userId },
    });
    if (!user) {
      throw new Error(`User with id ${overrides.userId} does not exist`);
    }

    // Create member in the same transaction - parent entities are guaranteed to exist
    return await tx.projectMember.create({
      data: {
        id: overrides.id || `test-member-${randomUUID()}`,
        projectId: overrides.projectId,
        userId: overrides.userId,
      },
    });
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

  // Use transaction to verify project exists before creating phase
  const phase = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // Create phase in the same transaction
    return await tx.phase.create({
      data: {
        id: overrides.id || `test-phase-${randomUUID()}`,
        projectId: overrides.projectId,
        name: overrides.name || "Test Phase",
        order: overrides.order ?? 0,
        updatedAt: new Date(),
      },
    });
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

  // Use transaction to verify phase exists before creating task
  const task = await db.$transaction(async (tx) => {
    // Verify phase exists
    const phase = await tx.phase.findUnique({
      where: { id: overrides.phaseId },
    });
    if (!phase) {
      throw new Error(`Phase with id ${overrides.phaseId} does not exist`);
    }

    // Create task in the same transaction
    return await tx.task.create({
      data: {
        id: overrides.id || `test-task-${randomUUID()}`,
        phaseId: overrides.phaseId,
        name: overrides.name || "Test Task",
        description: overrides.description ?? null,
        ownerId: overrides.ownerId ?? null,
        order: overrides.order ?? 1,
        plannedCompletionDate: overrides.plannedCompletionDate ?? null,
        actualCompletionDate: overrides.actualCompletionDate ?? null,
      },
    });
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
  
  // Use transaction to ensure tenant exists before creating vendor
  const vendor = await db.$transaction(async (tx) => {
    // Ensure tenant exists
    await tx.tenant.upsert({
      where: { id: tenantId },
      create: {
        id: tenantId,
        name: "Test Company",
        updatedAt: new Date(),
      },
      update: {
        updatedAt: new Date(),
      },
    });

    // Create vendor in the same transaction - tenant is guaranteed to exist
    return await tx.vendor.create({
      data: {
        id: overrides?.id || `test-vendor-${randomUUID()}`,
        name: overrides?.name || "Test Vendor",
        organizationNumber: overrides?.organizationNumber ?? null,
        emailDomain: overrides?.emailDomain ?? null,
        tenantId,
      },
    });
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

  // Use transaction to verify project and vendor exist before creating project vendor
  const projectVendor = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // Verify vendor exists
    const vendor = await tx.vendor.findUnique({
      where: { id: overrides.vendorId },
    });
    if (!vendor) {
      throw new Error(`Vendor with id ${overrides.vendorId} does not exist`);
    }

    // Create project vendor in the same transaction - parent entities are guaranteed to exist
    return await tx.projectVendor.create({
      data: {
        id: overrides?.id || `test-project-vendor-${randomUUID()}`,
        projectId: overrides.projectId,
        vendorId: overrides.vendorId,
        status: (overrides?.status || "Pending") as VendorStatus,
      },
    });
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

  // Use transaction to verify project and parent exist before creating hierarchy
  const hierarchy = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // If parentId is provided, verify parent hierarchy exists
    if (overrides.parentId) {
      const parent = await tx.requirementHierarchy.findUnique({
        where: { id: overrides.parentId },
      });
      if (!parent) {
        throw new Error(`RequirementHierarchy with id ${overrides.parentId} does not exist`);
      }
    }

    // Create hierarchy in the same transaction - project and parent (if provided) are guaranteed to exist
    return await tx.requirementHierarchy.create({
      data: {
        id: overrides.id || `test-hierarchy-${randomUUID()}`,
        projectId: overrides.projectId,
        parentId: overrides.parentId ?? null,
        title: overrides.title || "Test Hierarchy",
        description: overrides.description ?? null,
        number: overrides.number || "1.",
        order: overrides.order ?? 1,
      },
    });
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

  // Use transaction to verify hierarchy and users exist before creating requirement
  const requirement = await db.$transaction(async (tx) => {
    // Verify hierarchy exists
    const hierarchy = await tx.requirementHierarchy.findUnique({
      where: { id: overrides.hierarchyId },
    });
    if (!hierarchy) {
      throw new Error(`RequirementHierarchy with id ${overrides.hierarchyId} does not exist`);
    }

    // Verify createdBy user exists
    const createdBy = await tx.user.findUnique({
      where: { id: overrides.createdById },
    });
    if (!createdBy) {
      throw new Error(`User with id ${overrides.createdById} does not exist`);
    }

    // Verify lastModifiedBy user exists
    const lastModifiedBy = await tx.user.findUnique({
      where: { id: overrides.lastModifiedById },
    });
    if (!lastModifiedBy) {
      throw new Error(`User with id ${overrides.lastModifiedById} does not exist`);
    }

    // Create requirement in the same transaction - parent entities are guaranteed to exist
    return await tx.requirement.create({
      data: {
        id: overrides.id || `test-requirement-${randomUUID()}`,
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

  // Use transaction to verify project exists before creating RFI
  const rfi = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // Create RFI in the same transaction - project is guaranteed to exist
    return await tx.rFI.create({
      data: {
        id: overrides.id || `test-rfi-${randomUUID()}`,
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

  // Use transaction to verify RFI exists before creating question
  const question = await db.$transaction(async (tx) => {
    // Verify RFI exists
    const rfi = await tx.rFI.findUnique({
      where: { id: overrides.rfiId },
    });
    if (!rfi) {
      throw new Error(`RFI with id ${overrides.rfiId} does not exist`);
    }

    // Create question in the same transaction
    return await tx.rFIQuestion.create({
      data: {
        id: overrides.id || `test-rfi-question-${randomUUID()}`,
        rfiId: overrides.rfiId,
        title: overrides.title || "Test Question",
        description: overrides.description ?? null,
        type: (overrides.type || "SingleText") as any,
        order: overrides.order ?? 1,
        required: overrides.required ?? false,
        scaleLabels: overrides.scaleLabels ?? Prisma.JsonNull,
      },
    });
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

  // Use transaction to verify question exists before creating option
  const option = await db.$transaction(async (tx) => {
    // Verify question exists
    const question = await tx.rFIQuestion.findUnique({
      where: { id: overrides.questionId },
    });
    if (!question) {
      throw new Error(`RFIQuestion with id ${overrides.questionId} does not exist`);
    }

    // Create option in the same transaction
    return await tx.rFIQuestionOption.create({
      data: {
        id: overrides.id || `test-rfi-option-${randomUUID()}`,
        questionId: overrides.questionId,
        label: overrides.label || "Test Option",
        value: overrides.value ?? null,
        xAxis: overrides.xAxis ?? false,
        yAxis: overrides.yAxis ?? false,
        order: overrides.order ?? 1,
      },
    });
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

  // Use transaction to verify RFI, project vendor, and contact person exist before creating response
  const response = await db.$transaction(async (tx) => {
    // Verify RFI exists
    const rfi = await tx.rFI.findUnique({
      where: { id: overrides.rfiId },
    });
    if (!rfi) {
      throw new Error(`RFI with id ${overrides.rfiId} does not exist`);
    }

    // Verify project vendor exists
    const projectVendor = await tx.projectVendor.findUnique({
      where: { id: overrides.projectVendorId },
    });
    if (!projectVendor) {
      throw new Error(`ProjectVendor with id ${overrides.projectVendorId} does not exist`);
    }

    // Verify contact person exists
    const contactPerson = await tx.vendorContactPerson.findUnique({
      where: { id: overrides.contactPersonId },
    });
    if (!contactPerson) {
      throw new Error(`VendorContactPerson with id ${overrides.contactPersonId} does not exist`);
    }

    // Create response in the same transaction - parent entities are guaranteed to exist
    return await tx.rFIVendorResponse.create({
      data: {
        id: overrides.id || `test-rfi-vendor-response-${randomUUID()}`,
        rfiId: overrides.rfiId,
        projectVendorId: overrides.projectVendorId,
        contactPersonId: overrides.contactPersonId,
        status: (overrides.status || "Sent") as any,
        sentAt: overrides.sentAt ?? null,
        answeredAt: overrides.answeredAt ?? null,
      },
    });
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

  // Use transaction to verify vendor exists before creating contact person
  const contactPerson = await db.$transaction(async (tx) => {
    // Verify vendor exists
    const vendor = await tx.vendor.findUnique({
      where: { id: overrides.vendorId },
    });
    if (!vendor) {
      throw new Error(`Vendor with id ${overrides.vendorId} does not exist`);
    }

    // Create contact person in the same transaction
    const contactId = randomUUID();
    return await tx.vendorContactPerson.create({
      data: {
        id: overrides.id || `test-vendor-contact-${contactId}`,
        vendorId: overrides.vendorId,
        firstName: overrides.firstName || "John",
        lastName: overrides.lastName || "Doe",
        email: overrides.email || `contact-${contactId}@example.com`,
        phone: overrides.phone ?? null,
        isMainContact: overrides.isMainContact ?? false,
      },
    });
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
  about?: string | null;
}) {
  if (!overrides?.projectId) {
    throw new Error("projectId is required");
  }

  // Use transaction to verify project exists before creating RFP
  const rfp = await db.$transaction(async (tx) => {
    // Verify project exists
    const project = await tx.project.findUnique({
      where: { id: overrides.projectId },
    });
    if (!project) {
      throw new Error(`Project with id ${overrides.projectId} does not exist`);
    }

    // Use upsert to handle unique constraint on projectId
    // If RFP already exists for this project, update it; otherwise create new one
    return await tx.rFP.upsert({
      where: {
        projectId: overrides.projectId,
      },
      update: {
        status: (overrides.status || "Draft") as any,
        contactPersonId: overrides.contactPersonId ?? null,
        alternativeContactPersonId: overrides.alternativeContactPersonId ?? null,
        publishDate: overrides.publishDate ?? null,
        deliveryDate: overrides.deliveryDate ?? null,
        about: overrides.about ?? null,
      },
      create: {
        id: overrides.id || `test-rfp-${randomUUID()}`,
        projectId: overrides.projectId,
        status: (overrides.status || "Draft") as any,
        contactPersonId: overrides.contactPersonId ?? null,
        alternativeContactPersonId: overrides.alternativeContactPersonId ?? null,
        publishDate: overrides.publishDate ?? null,
        deliveryDate: overrides.deliveryDate ?? null,
        about: overrides.about ?? null,
      },
    });
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

  // Use transaction to verify RFP exists before creating schedule item
  const item = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Create schedule item in the same transaction
    return await tx.rFPScheduleItem.create({
      data: {
        id: overrides.id || `test-rfp-schedule-${randomUUID()}`,
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

  // Use transaction to verify RFP exists before creating document
  const document = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Create document in the same transaction
    return await tx.rFPDocument.create({
      data: {
        id: overrides.id || `test-rfp-document-${randomUUID()}`,
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

  // Use transaction to verify RFP and user exist before creating changelog entry
  const entry = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Verify user exists
    const user = await tx.user.findUnique({
      where: { id: overrides.createdById },
    });
    if (!user) {
      throw new Error(`User with id ${overrides.createdById} does not exist`);
    }

    // Create changelog entry in the same transaction
    return await tx.rFPChangelogEntry.create({
      data: {
        id: overrides.id || `test-rfp-changelog-${randomUUID()}`,
        rfpId: overrides.rfpId,
        description: overrides.description || "Test changelog entry",
        createdById: overrides.createdById,
      },
    });
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

  // Use transaction to verify RFP, vendor, and contact person exist before creating question
  const question = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Verify vendor exists
    const vendor = await tx.vendor.findUnique({
      where: { id: overrides.vendorId },
    });
    if (!vendor) {
      throw new Error(`Vendor with id ${overrides.vendorId} does not exist`);
    }

    // Verify contact person exists
    const contactPerson = await tx.vendorContactPerson.findUnique({
      where: { id: overrides.contactPersonId },
    });
    if (!contactPerson) {
      throw new Error(`VendorContactPerson with id ${overrides.contactPersonId} does not exist`);
    }

    // Create question in the same transaction - parent entities are guaranteed to exist
    return await tx.rFPQuestion.create({
      data: {
        id: overrides.id || `test-rfp-question-${randomUUID()}`,
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

  // Use transaction to verify RFP and user exist before creating announcement
  const announcement = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Verify user exists
    const user = await tx.user.findUnique({
      where: { id: overrides.createdById },
    });
    if (!user) {
      throw new Error(`User with id ${overrides.createdById} does not exist`);
    }

    // Create announcement in the same transaction - parent entities are guaranteed to exist
    return await tx.rFPAnnouncement.create({
      data: {
        id: overrides.id || `test-rfp-announcement-${randomUUID()}`,
        rfpId: overrides.rfpId,
        title: overrides.title || "Test Announcement",
        description: overrides.description || "Test announcement description",
        sentAt: overrides.sentAt ?? null,
        scheduledSendAt: overrides.scheduledSendAt ?? null,
        createdById: overrides.createdById,
      },
    });
  });

  return announcement;
}

/**
 * Create a test RFP vendor response
 */
export async function createTestRFPVendorResponse(overrides?: {
  id?: string;
  rfpId: string;
  projectVendorId: string;
  contactPersonId: string;
  status?: "Sent" | "Viewed" | "Participating" | "ProposalSubmitted" | "Declined";
  participatedAt?: Date | null;
  proposalSubmittedAt?: Date | null;
}) {
  if (!overrides?.rfpId || !overrides?.projectVendorId || !overrides?.contactPersonId) {
    throw new Error("rfpId, projectVendorId, and contactPersonId are required");
  }

  // Use transaction to verify RFP, project vendor, and contact person exist before creating response
  const response = await db.$transaction(async (tx) => {
    // Verify RFP exists
    const rfp = await tx.rFP.findUnique({
      where: { id: overrides.rfpId },
    });
    if (!rfp) {
      throw new Error(`RFP with id ${overrides.rfpId} does not exist`);
    }

    // Verify project vendor exists
    const projectVendor = await tx.projectVendor.findUnique({
      where: { id: overrides.projectVendorId },
    });
    if (!projectVendor) {
      throw new Error(`ProjectVendor with id ${overrides.projectVendorId} does not exist`);
    }

    // Verify contact person exists
    const contactPerson = await tx.vendorContactPerson.findUnique({
      where: { id: overrides.contactPersonId },
    });
    if (!contactPerson) {
      throw new Error(`VendorContactPerson with id ${overrides.contactPersonId} does not exist`);
    }

    // Create response in the same transaction - parent entities are guaranteed to exist
    return await tx.rFPVendorResponse.create({
      data: {
        id: overrides.id || `test-rfp-vendor-response-${randomUUID()}`,
        rfpId: overrides.rfpId,
        projectVendorId: overrides.projectVendorId,
        contactPersonId: overrides.contactPersonId,
        status: overrides.status === "Participating" 
          ? RFPVendorResponseStatus.Participating
          : overrides.status === "Viewed"
          ? RFPVendorResponseStatus.Viewed
          : overrides.status === "ProposalSubmitted"
          ? RFPVendorResponseStatus.ProposalSubmitted
          : overrides.status === "Declined"
          ? RFPVendorResponseStatus.Declined
          : RFPVendorResponseStatus.Sent,
        participatedAt: overrides.participatedAt ?? null,
        proposalSubmittedAt: overrides.proposalSubmittedAt ?? null,
      },
    });
  });

  return response;
}

/**
 * Create a test RFP proposal file
 */
export async function createTestRFPProposalFile(overrides?: {
  id?: string;
  vendorResponseId: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  fileSize?: number;
  order?: number;
}) {
  if (!overrides?.vendorResponseId) {
    throw new Error("vendorResponseId is required");
  }

  // Use transaction to verify vendor response exists before creating file
  const file = await db.$transaction(async (tx) => {
    // Verify vendor response exists
    const vendorResponse = await tx.rFPVendorResponse.findUnique({
      where: { id: overrides.vendorResponseId },
    });
    if (!vendorResponse) {
      throw new Error(`RFPVendorResponse with id ${overrides.vendorResponseId} does not exist`);
    }

    // Create file in the same transaction - parent entity is guaranteed to exist
    return await tx.rFPProposalFile.create({
      data: {
        id: overrides.id || `test-rfp-proposal-file-${randomUUID()}`,
        vendorResponseId: overrides.vendorResponseId,
        fileName: overrides.fileName || "test-proposal.pdf",
        fileType: overrides.fileType || "application/pdf",
        fileData: overrides.fileData || Buffer.from("test file content").toString("base64"),
        fileSize: overrides.fileSize ?? 1000,
        order: overrides.order ?? 0,
      },
    });
  });

  return file;
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
