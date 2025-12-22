/**
 * API mocking utilities for component tests
 * Provides helpers to mock the api object and fetch calls
 */

import { vi } from 'vitest';

// Mock the api module
export const mockApi = {
  vendors: {
    search: vi.fn(),
    getBrregData: vi.fn(),
  },
  auth: {
    checkUser: vi.fn(),
    login: vi.fn(),
    requestMagicLink: vi.fn(),
    verifyMagicLink: vi.fn(),
    setPassword: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
  },
  users: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getCompanyUsers: vi.fn(),
    create: vi.fn(),
  },
  projects: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateGraphics: vi.fn(),
    deleteLogo: vi.fn(),
    deleteBanner: vi.fn(),
    addMembers: vi.fn(),
    removeMembers: vi.fn(),
    getPhases: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getDashboardStats: vi.fn(),
    getVendors: vi.fn(),
  },
  requirements: {
    getHierarchies: vi.fn(),
    createHierarchy: vi.fn(),
    updateHierarchy: vi.fn(),
    deleteHierarchy: vi.fn(),
    reorderHierarchies: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    move: vi.fn(),
    reorder: vi.fn(),
    getHistory: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
  },
  rfi: {
    get: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    getQuestions: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    reorderQuestions: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    deleteOption: vi.fn(),
    reorderOptions: vi.fn(),
    getVendorResponses: vi.fn(),
    getVendorResponse: vi.fn(),
    send: vi.fn(),
    resend: vi.fn(),
    getPreview: vi.fn(),
  },
  rfp: {
    get: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    send: vi.fn(),
    getSchedule: vi.fn(),
    createScheduleItem: vi.fn(),
    updateScheduleItem: vi.fn(),
    deleteScheduleItem: vi.fn(),
    getDocuments: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    reorderDocuments: vi.fn(),
    getChangelog: vi.fn(),
    updateChangelogEntry: vi.fn(),
    deleteChangelogEntry: vi.fn(),
    getQuestions: vi.fn(),
    createQuestion: vi.fn(),
    splitQuestion: vi.fn(),
    answerQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    getAnnouncements: vi.fn(),
    createAnnouncement: vi.fn(),
    sendAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
  },
  vendor: {
    rfi: {
      get: vi.fn(),
      getQuestions: vi.fn(),
      submitResponse: vi.fn(),
      updateResponse: vi.fn(),
      getContacts: vi.fn(),
      createContact: vi.fn(),
    },
  },
  templates: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  notifications: {
    list: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
};

/**
 * Setup API mocks before each test
 * Call this in beforeEach to reset all mocks
 */
export function setupApiMocks(): void {
  // Reset all mocks
  Object.values(mockApi).forEach((namespace) => {
    if (typeof namespace === 'object') {
      Object.values(namespace).forEach((fn) => {
        if (typeof fn === 'function' && 'mockReset' in fn) {
          fn.mockReset();
        }
      });
    }
  });
}

/**
 * Mock fetch globally
 * Useful for testing components that use apiRequest directly
 */
export function mockFetch(
  response: any,
  options: { status?: number; ok?: boolean } = {}
): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: options.ok !== false,
    status: options.status || 200,
    json: async () => response,
    text: async () => JSON.stringify(response),
  } as Response);
}

/**
 * Mock fetch to return an error
 */
export function mockFetchError(
  error: string,
  status: number = 500
): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error, message: error }),
    text: async () => JSON.stringify({ error, message: error }),
  } as Response);
}

/**
 * Mock fetch to throw a network error
 */
export function mockFetchNetworkError(): void {
  global.fetch = vi.fn().mockRejectedValue(
    new TypeError('Failed to fetch')
  );
}

/**
 * Reset fetch mock
 */
export function resetFetchMock(): void {
  if (global.fetch && 'mockReset' in global.fetch) {
    (global.fetch as any).mockReset();
  }
}

/**
 * Helper to create a successful API response
 */
export function createSuccessResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}

/**
 * Helper to create a failed API response
 */
export function createErrorResponse(error: string, message?: string): Promise<never> {
  return Promise.reject(new Error(message || error));
}



