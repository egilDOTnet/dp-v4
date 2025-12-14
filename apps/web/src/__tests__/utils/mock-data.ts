/**
 * Test data factories for creating mock objects
 * These factories create realistic test data with sensible defaults
 */

import type {
  User,
  Project,
  Phase,
  Task,
  Requirement,
  RequirementHierarchy,
  Vendor,
  VendorContactPerson,
  ProjectVendor,
  RFI,
  RFIQuestion,
  RFIQuestionOption,
  RFIVendorResponse,
  RFP,
  RFPScheduleItem,
  RFPDocument,
  RFPChangelogEntry,
  RFPQuestion,
  RFPAnnouncement,
  Comment,
  Notification,
} from '@/lib/api';

let idCounter = 1;

function generateId(): string {
  return `test-id-${idCounter++}`;
}

function generateDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

// User factories
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: generateId(),
    email: `user${idCounter}@example.com`,
    name: `User ${idCounter}`,
    firstName: `First${idCounter}`,
    lastName: `Last${idCounter}`,
    role: 'User',
    tenantId: generateId(),
    companyName: `Company ${idCounter}`,
    ...overrides,
  };
}

export function createMockAdmin(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'CompanyAdministrator',
    ...overrides,
  });
}

export function createMockGlobalAdmin(overrides?: Partial<User>): User {
  return createMockUser({
    role: 'GlobalAdministrator',
    ...overrides,
  });
}

// Project factories
export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: generateId(),
    name: `Test Project ${idCounter}`,
    type: 'Construction',
    startDate: generateDate(-30),
    endDate: generateDate(90),
    logoData: null,
    logoFileName: null,
    logoFileType: null,
    bannerData: null,
    bannerFileName: null,
    bannerFileType: null,
    tenantId: generateId(),
    createdAt: generateDate(-60),
    updatedAt: generateDate(-1),
    members: [],
    ...overrides,
  };
}

// Phase factories
export function createMockPhase(overrides?: Partial<Phase>): Phase {
  return {
    id: generateId(),
    projectId: generateId(),
    name: `Phase ${idCounter}`,
    order: idCounter,
    status: 'not_started',
    taskCount: 0,
    completedTaskCount: 0,
    createdAt: generateDate(-30),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

// Task factories
export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: generateId(),
    phaseId: generateId(),
    name: `Task ${idCounter}`,
    description: `Task description ${idCounter}`,
    ownerId: null,
    owner: null,
    startDate: null,
    plannedCompletionDate: null,
    actualCompletionDate: null,
    order: idCounter,
    createdAt: generateDate(-20),
    updatedAt: generateDate(-1),
    comments: [],
    commentCount: 0,
    ...overrides,
  };
}

// Requirement factories
export function createMockRequirementHierarchy(
  overrides?: Partial<RequirementHierarchy>
): RequirementHierarchy {
  return {
    id: generateId(),
    projectId: generateId(),
    parentId: null,
    number: `${idCounter}`,
    title: `Hierarchy ${idCounter}`,
    description: `Description ${idCounter}`,
    order: idCounter,
    createdAt: generateDate(-30),
    updatedAt: generateDate(-1),
    parent: null,
    children: [],
    _count: { requirements: 0 },
    ...overrides,
  };
}

export function createMockRequirement(overrides?: Partial<Requirement>): Requirement {
  return {
    id: generateId(),
    hierarchyId: generateId(),
    number: `${idCounter}`,
    description: `Requirement description ${idCounter}`,
    type: 'Mandatory',
    status: 'New',
    order: idCounter,
    createdAt: generateDate(-20),
    updatedAt: generateDate(-1),
    createdById: generateId(),
    lastModifiedById: generateId(),
    ...overrides,
  };
}

// Vendor factories
export function createMockVendorContact(overrides?: Partial<VendorContactPerson>): VendorContactPerson {
  return {
    id: generateId(),
    vendorId: generateId(),
    firstName: `Contact${idCounter}`,
    lastName: `Person${idCounter}`,
    email: `contact${idCounter}@vendor.com`,
    isMainContact: false,
    createdAt: generateDate(-30),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

export function createMockVendor(overrides?: Partial<Vendor>): Vendor {
  return {
    id: generateId(),
    tenantId: generateId(),
    name: `Vendor ${idCounter}`,
    organizationNumber: `${100000000 + idCounter}`,
    emailDomain: `vendor${idCounter}.com`,
    additionalData: {},
    createdAt: generateDate(-30),
    updatedAt: generateDate(-1),
    contacts: [],
    ...overrides,
  };
}

export function createMockProjectVendor(overrides?: Partial<ProjectVendor>): ProjectVendor {
  return {
    id: generateId(),
    projectId: generateId(),
    vendorId: generateId(),
    status: 'Pending',
    createdAt: generateDate(-20),
    updatedAt: generateDate(-1),
    vendor: createMockVendor(),
    ...overrides,
  };
}

// RFI factories
export function createMockRFIQuestionOption(
  overrides?: Partial<RFIQuestionOption>
): RFIQuestionOption {
  return {
    id: generateId(),
    questionId: generateId(),
    label: `Option ${idCounter}`,
    value: `value${idCounter}`,
    xAxis: false,
    yAxis: false,
    order: idCounter,
    createdAt: generateDate(-10),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

export function createMockRFIQuestion(overrides?: Partial<RFIQuestion>): RFIQuestion {
  return {
    id: generateId(),
    rfiId: generateId(),
    title: `Question ${idCounter}`,
    description: `Question description ${idCounter}`,
    type: 'SingleText',
    order: idCounter,
    required: true,
    scaleLabels: null,
    createdAt: generateDate(-10),
    updatedAt: generateDate(-1),
    options: [],
    ...overrides,
  };
}

export function createMockRFI(overrides?: Partial<RFI>): RFI {
  return {
    id: generateId(),
    projectId: generateId(),
    emailSubject: `RFI Subject ${idCounter}`,
    emailText: `RFI email text ${idCounter}`,
    rfiInformation: `RFI information ${idCounter}`,
    deadline: generateDate(30),
    autoPublishDate: null,
    isPublished: false,
    publishedAt: null,
    unpublishedAt: null,
    createdAt: generateDate(-20),
    updatedAt: generateDate(-1),
    questions: [],
    ...overrides,
  };
}

export function createMockRFIVendorResponse(
  overrides?: Partial<RFIVendorResponse>
): RFIVendorResponse {
  return {
    id: generateId(),
    vendorId: generateId(),
    vendorName: `Vendor ${idCounter}`,
    contactPerson: {
      id: generateId(),
      firstName: `Contact${idCounter}`,
      lastName: `Person${idCounter}`,
      email: `contact${idCounter}@vendor.com`,
      phone: null,
    },
    status: 'Sent',
    sentAt: generateDate(-5),
    answeredAt: null,
    createdAt: generateDate(-5),
    magicLinkToken: generateId(),
    ...overrides,
  };
}

// RFP factories
export function createMockRFP(overrides?: Partial<RFP>): RFP {
  return {
    id: generateId(),
    projectId: generateId(),
    status: 'Draft',
    contactPersonId: null,
    alternativeContactPersonId: null,
    publishDate: null,
    deliveryDate: null,
    createdAt: generateDate(-20),
    updatedAt: generateDate(-1),
    contactPerson: null,
    alternativeContactPerson: null,
    ...overrides,
  };
}

export function createMockRFPScheduleItem(
  overrides?: Partial<RFPScheduleItem>
): RFPScheduleItem {
  return {
    id: generateId(),
    rfpId: generateId(),
    type: 'StartDate',
    description: `Schedule item ${idCounter}`,
    date: generateDate(30),
    fromDate: null,
    toDate: null,
    order: idCounter,
    isRequired: true,
    createdAt: generateDate(-10),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

export function createMockRFPDocument(overrides?: Partial<RFPDocument>): RFPDocument {
  return {
    id: generateId(),
    rfpId: generateId(),
    type: 'Document',
    description: `Document ${idCounter}`,
    fileName: `document${idCounter}.pdf`,
    fileType: 'application/pdf',
    fileData: null,
    fileSize: 1024,
    url: null,
    order: idCounter,
    createdAt: generateDate(-10),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

export function createMockRFPChangelogEntry(
  overrides?: Partial<RFPChangelogEntry>
): RFPChangelogEntry {
  return {
    id: generateId(),
    rfpId: generateId(),
    description: `Changelog entry ${idCounter}`,
    createdById: generateId(),
    createdAt: generateDate(-5),
    updatedAt: generateDate(-1),
    createdBy: createMockUser(),
    ...overrides,
  };
}

export function createMockRFPQuestion(overrides?: Partial<RFPQuestion>): RFPQuestion {
  return {
    id: generateId(),
    rfpId: generateId(),
    question: `RFP Question ${idCounter}`,
    answer: null,
    answeredAt: null,
    answeredById: null,
    answeredBy: null,
    createdAt: generateDate(-10),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

export function createMockRFPAnnouncement(
  overrides?: Partial<RFPAnnouncement>
): RFPAnnouncement {
  return {
    id: generateId(),
    rfpId: generateId(),
    title: `Announcement ${idCounter}`,
    description: `Announcement description ${idCounter}`,
    scheduledSendAt: null,
    sentAt: null,
    createdById: generateId(),
    createdAt: generateDate(-5),
    updatedAt: generateDate(-1),
    createdBy: createMockUser(),
    ...overrides,
  };
}

// Comment factories
export function createMockComment(overrides?: Partial<Comment>): Comment {
  return {
    id: generateId(),
    content: `Comment ${idCounter}`,
    createdBy: createMockUser(),
    createdAt: generateDate(-1),
    updatedAt: generateDate(-1),
    ...overrides,
  };
}

// Notification factories
export function createMockNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: generateId(),
    type: 'TASK_COMMENT',
    taskId: generateId(),
    commentId: generateId(),
    read: false,
    createdAt: generateDate(-1),
    task: {
      id: generateId(),
      name: `Task ${idCounter}`,
      phaseId: generateId(),
      project: {
        id: generateId(),
        name: `Project ${idCounter}`,
      },
    },
    mentionedBy: createMockUser(),
    ...overrides,
  };
}

// Helper to reset ID counter (useful for test isolation)
export function resetIdCounter(): void {
  idCounter = 1;
}
