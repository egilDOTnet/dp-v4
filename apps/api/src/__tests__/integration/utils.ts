import { api, setToken, clearToken, getToken } from './api-client';
import type { User, Project, RFI, RFP, RequirementHierarchy, Requirement } from './api-client';
import { getTestApiUrl } from './setup';
import {
  createTestUser,
  createTestTenant,
} from '../utils/db-helpers';

/**
 * Integration Test Utilities
 * 
 * These utilities help write integration tests that test full workflows
 * by making real HTTP requests to the test API server.
 */

/**
 * Authenticate a user and return the token and user data
 */
export async function authenticateUser(email: string, password: string): Promise<{ token: string; user: User }> {
  const response = await api.auth.login(email, password);
  
  // Set token in memory for subsequent API calls
  setToken(response.token);
  
  return response;
}

/**
 * Create an authenticated user and return credentials
 */
export async function createAuthenticatedUser(overrides?: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId?: string;
}): Promise<{ user: User; token: string; email: string; password: string }> {
  const password = overrides?.password || 'password123';
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const email = overrides?.email || `test-${uniqueSuffix}@example.com`;
  
  // Create tenant if tenantId is provided
  const tenantId = overrides?.tenantId;
  if (tenantId) {
    await createTestTenant({ id: tenantId, name: 'Test Company' });
  }
  
  // Create user in database
  // Default to CompanyAdministrator role to allow project creation in tests
  await createTestUser({
    email,
    firstName: overrides?.firstName || 'Test',
    lastName: overrides?.lastName || 'User',
    role: overrides?.role || 'CompanyAdministrator',
    tenantId,
  });
  
  // Authenticate to get token
  const { token, user } = await authenticateUser(email, password);
  
  return { user, token, email, password };
}

/**
 * Create a test project with a member
 */
export async function createProjectWithMember(options?: {
  projectName?: string;
  userId?: string;
  tenantId?: string;
}): Promise<{ project: Project; user: User; token: string }> {
  // Create authenticated user
  const { user, token } = await createAuthenticatedUser({
    tenantId: options?.tenantId,
  });
  
  // Create project via API
  const project = await api.projects.create({
    name: options?.projectName || 'Test Project',
  });
  
  // Add user as member (if not already added by create)
  // Note: The create endpoint may automatically add the creator as a member
  // This depends on the actual API implementation
  
  return { project, user, token };
}

/**
 * Create a complete RFI setup with questions
 */
export async function createRFISetup(options?: {
  projectId?: string;
  questionCount?: number;
  tenantId?: string;
}): Promise<{
  project: Project;
  rfi: RFI;
  questions: any[];
  user: User;
  token: string;
}> {
  // Create project with member
  const { project, user, token } = await createProjectWithMember({
    tenantId: options?.tenantId,
  });
  
  // Get or create RFI
  let rfi: RFI;
  try {
    rfi = await api.rfi.get(project.id);
  } catch {
    // RFI doesn't exist, create it via API
    // Note: RFI is typically auto-created, so we'll get it
    rfi = await api.rfi.get(project.id);
  }
  
  // Create questions
  const questionCount = options?.questionCount || 3;
  const questions = [];
  for (let i = 0; i < questionCount; i++) {
    const question = await api.rfi.questions.create(project.id, {
      title: `Test Question ${i + 1}`,
      type: 'SingleText' as any,
      required: false,
    });
    questions.push(question);
  }
  
  return { project, rfi, questions, user, token };
}

/**
 * Create a complete RFP setup
 */
export async function createRFPSetup(options?: {
  projectId?: string;
  tenantId?: string;
}): Promise<{
  project: Project;
  rfp: RFP;
  user: User;
  token: string;
}> {
  // Create project with member
  const { project, user, token } = await createProjectWithMember({
    tenantId: options?.tenantId,
  });
  
  // Get or create RFP
  let rfp: RFP;
  try {
    rfp = await api.rfp.get(project.id);
  } catch {
    // RFP doesn't exist, create it via API
    // Note: RFP is typically auto-created, so we'll get it
    rfp = await api.rfp.get(project.id);
  }
  
  return { project, rfp, user, token };
}

/**
 * Create a requirements hierarchy with requirements
 */
export async function createRequirementsSetup(options?: {
  projectId?: string;
  hierarchyCount?: number;
  requirementsPerHierarchy?: number;
  tenantId?: string;
}): Promise<{
  project: Project;
  hierarchies: RequirementHierarchy[];
  requirements: Requirement[];
  user: User;
  token: string;
}> {
  // Create project with member
  const { project, user, token } = await createProjectWithMember({
    tenantId: options?.tenantId,
  });
  
  // Create hierarchies
  const hierarchyCount = options?.hierarchyCount || 2;
  const requirementsPerHierarchy = options?.requirementsPerHierarchy || 2;
  const hierarchies: RequirementHierarchy[] = [];
  const requirements: Requirement[] = [];
  
  for (let i = 0; i < hierarchyCount; i++) {
    const hierarchy = await api.requirements.hierarchies.create(project.id, {
      title: `Test Hierarchy ${i + 1}`,
      description: `Description for hierarchy ${i + 1}`,
    });
    hierarchies.push(hierarchy);
    
    // Create requirements for this hierarchy
    for (let j = 0; j < requirementsPerHierarchy; j++) {
      const requirement = await api.requirements.create(project.id, {
        hierarchyId: hierarchy.id,
        description: `Test Requirement ${i + 1}.${j + 1}`,
        type: 'Information',
        status: null,
      });
      requirements.push(requirement);
    }
  }
  
  return { project, hierarchies, requirements, user, token };
}

/**
 * Create a vendor with contact person in a project
 */
export async function createVendorWithContact(options?: {
  projectId?: string;
  vendorName?: string;
  tenantId?: string;
}): Promise<{
  project: Project;
  vendor: any;
  contactPerson: any;
  user: User;
  token: string;
}> {
  // Create project with member (or use existing project)
  let project: Project;
  let user: User;
  let token: string;
  
  if (options?.projectId) {
    // Use existing project - need to get user/token separately
    const authResult = await createAuthenticatedUser({
      tenantId: options?.tenantId,
    });
    user = authResult.user;
    token = authResult.token;
    project = await api.projects.get(options.projectId);
  } else {
    // Create new project
    const result = await createProjectWithMember({
      tenantId: options?.tenantId,
    });
    project = result.project;
    user = result.user;
    token = result.token;
  }
  
  // Create vendor in project via API
  const projectVendor = await api.projects.vendors.create(project.id, {
    name: options?.vendorName || 'Test Vendor',
  });
  
  // Create contact person via API
  const contactPerson = await api.projects.vendors.contacts.create(
    project.id,
    projectVendor.vendorId,
    {
      firstName: 'John',
      lastName: 'Doe',
      email: `contact-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@example.com`,
      isMainContact: true,
    }
  );
  
  return { project, vendor: projectVendor, contactPerson, user, token };
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Make an authenticated API request
 * This is a helper that automatically includes the auth token
 */
export async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  if (!token) {
    throw new Error('No authentication token available. Call authenticateUser first.');
  }
  
  const apiUrl = getTestApiUrl();
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || `Request failed with status ${response.status}`);
  }
  
  if (response.status === 204) {
    return undefined as T;
  }
  
  return response.json();
}

/**
 * Clear authentication (logout and clear token)
 */
export async function clearAuthentication(): Promise<void> {
  try {
    await api.auth.logout();
  } catch {
    // Ignore errors
  }
  
  clearToken();
}


