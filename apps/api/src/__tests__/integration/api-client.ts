/**
 * Test-only API Client
 * 
 * This is a Node.js-compatible API client for integration tests.
 * It uses fetch directly and stores tokens in memory (no browser dependencies).
 * 
 * This client mirrors the structure of the web API client but is designed
 * to work in a Node.js test environment.
 */

// In-memory token storage (replaces localStorage)
const tokenStore = new Map<string, string>();

/**
 * Get the API URL from environment variable
 */
function getApiUrl(): string {
  return process.env.TEST_API_URL || 'http://localhost:3002';
}

/**
 * Get the stored auth token
 */
export function getToken(): string | null {
  return tokenStore.get('token') || null;
}

/**
 * Set the auth token
 */
export function setToken(token: string): void {
  tokenStore.set('token', token);
}

/**
 * Clear the auth token
 */
export function clearToken(): void {
  tokenStore.delete('token');
}

/**
 * Make an API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Only set Content-Type if there's a body
  if (options.body) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: { error?: string; message?: string };
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `Request failed with status ${response.status}` };
      }
      const errorMessage = errorData.message
        ? `${errorData.error || 'Request failed'}: ${errorData.message}`
        : errorData.error || `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).response = errorData;
      throw error;
    }

    // Handle 204 No Content responses (no body to parse)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const apiUrl = getApiUrl();
      throw new Error(
        `Network error: Could not connect to server at ${apiUrl}. Please check if the API server is running.`
      );
    }
    throw error;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: string | null;
  companyName?: string;
}

export interface Project {
  id: string;
  name: string;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  logoData: string | null;
  logoFileName: string | null;
  logoFileType: string | null;
  bannerData: string | null;
  bannerFileName: string | null;
  bannerFileType: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  members?: Array<{
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  }>;
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: 'not_started' | 'ongoing' | 'delayed' | 'completed';
  taskCount: number;
  completedTaskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  phaseId: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  owner: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  startDate: string | null;
  plannedCompletionDate: string | null;
  actualCompletionDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  commentCount?: number;
}

export interface Comment {
  id: string;
  content: string;
  createdBy: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RequirementHierarchy {
  id: string;
  projectId: string;
  parentId: string | null;
  number: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  parent?: RequirementHierarchy | null;
  children?: RequirementHierarchy[];
  _count?: {
    requirements: number;
  };
}

export interface Requirement {
  id: string;
  hierarchyId: string;
  number: string;
  description: string;
  type: 'Information' | 'Mandatory' | 'Important' | 'Wish';
  status: 'Approved' | 'ForReview' | 'New' | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  lastModifiedById: string;
  hierarchy?: RequirementHierarchy;
  createdBy?: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  lastModifiedBy?: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export type VendorStatus =
  | 'Pending'
  | 'RFI_Received'
  | 'RFI_Started'
  | 'RFI_Answered'
  | 'RFP_Received'
  | 'RFP_Delivered'
  | 'RFP_Rejected'
  | 'Shortlisted'
  | 'Lost'
  | 'Won';

export interface VendorContactPerson {
  id: string;
  vendorId: string;
  firstName: string;
  lastName: string;
  email: string;
  isMainContact: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  organizationNumber: string | null;
  emailDomain: string | null;
  additionalData: any;
  createdAt: string;
  updatedAt: string;
  contacts?: VendorContactPerson[];
}

export interface ProjectVendor {
  id: string;
  projectId: string;
  vendorId: string;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
  vendor: Vendor & {
    contacts: VendorContactPerson[];
  };
}

export type RFIQuestionType =
  | 'YesNo'
  | 'Dropdown'
  | 'MultipleChoice'
  | 'Scale'
  | 'ContactDetails'
  | 'SingleText'
  | 'MultilineText';

export interface RFIQuestionOption {
  id: string;
  questionId: string;
  label: string;
  value: string | null;
  xAxis: boolean;
  yAxis: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RFIQuestion {
  id: string;
  rfiId: string;
  title: string;
  description: string | null;
  type: RFIQuestionType;
  order: number;
  required: boolean;
  scaleLabels: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  options?: RFIQuestionOption[];
}

export interface RFI {
  id: string;
  projectId: string;
  emailSubject: string;
  emailText: string;
  rfiInformation: string;
  deadline: string | null;
  autoPublishDate: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: RFIQuestion[];
}

export type RFIVendorResponseStatus = 'Sent' | 'Started' | 'Received' | 'Answered' | 'Rejected' | null;

export interface RFIVendorResponse {
  id: string | null;
  vendorId: string;
  vendorName: string;
  vendor?: {
    id: string;
    name: string;
  };
  contactPerson: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  status: RFIVendorResponseStatus;
  sentAt: string | null;
  answeredAt: string | null;
  createdAt: string | null;
  magicLinkToken: string | null;
}

export interface RFIResponse {
  id: string;
  questionId: string;
  answer: any;
  question: {
    id: string;
    title: string;
    description: string | null;
    type: RFIQuestionType;
    order: number;
    required: boolean;
    scaleLabels: Record<string, string> | null;
    options?: RFIQuestionOption[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface RFIVendorResponseWithAnswers extends RFIVendorResponse {
  vendor: {
    id: string;
    name: string;
  };
  responses: RFIResponse[];
}

export interface DashboardStats {
  vendors: {
    total: number;
    byStatus: Record<string, number>;
  };
  rfi: {
    questionCount: number;
    status: 'planning' | 'ongoing' | 'finished';
    deadline: string | null;
  };
  requirements: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    unresolvedComments: number;
  };
}

export type RFPStatus = 'Draft' | 'Published' | 'Closed';

export type RFPScheduleItemType =
  | 'StartDate'
  | 'AcceptanceDate'
  | 'QuestionsDate'
  | 'DeliveryDate'
  | 'CustomDate'
  | 'CustomDateRange';

export type RFPDocumentType = 'Document' | 'Link' | 'Requirements';

export interface RFP {
  id: string;
  projectId: string;
  status: RFPStatus;
  contactPersonId: string | null;
  alternativeContactPersonId: string | null;
  publishDate: string | null;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  contactPerson?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  } | null;
  alternativeContactPerson?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  } | null;
}

export interface RFPScheduleItem {
  id: string;
  rfpId: string;
  type: RFPScheduleItemType;
  description: string;
  date: string | null;
  fromDate: string | null;
  toDate: string | null;
  order: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RFPDocument {
  id: string;
  rfpId: string;
  type: RFPDocumentType;
  description: string;
  fileName: string | null;
  fileType: string | null;
  fileData: string | null;
  fileSize: number | null;
  url: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface RFPChangelogEntry {
  id: string;
  rfpId: string;
  description: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface RFPQuestion {
  id: string;
  rfpId: string;
  vendorId: string;
  contactPersonId: string;
  question: string;
  cleanedQuestion: string | null;
  answer: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RFPAnnouncement {
  id: string;
  rfpId: string;
  title: string;
  description: string;
  sendImmediately: boolean;
  scheduledSendAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Client Object
// ============================================================================

export const api = {
  auth: {
    login: (email: string, password?: string) =>
      apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => apiRequest<{ message: string }>('/api/auth/logout', { method: 'POST' }),
  },
  projects: {
    list: () => apiRequest<Project[]>('/api/projects'),
    get: (id: string) => apiRequest<Project>(`/api/projects/${id}`),
    create: (data: {
      name: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      memberIds?: string[];
      phases?: Array<{ name: string; order: number }>;
    }) =>
      apiRequest<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: {
        name?: string;
        type?: string | null;
        startDate?: string | null;
        endDate?: string | null;
      }
    ) =>
      apiRequest<Project>(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/api/projects/${id}`, {
        method: 'DELETE',
      }),
    addMembers: (id: string, memberIds: string[]) =>
      apiRequest<Project>(`/api/projects/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberIds }),
      }),
    removeMembers: (id: string, memberIds: string[]) =>
      apiRequest<Project>(`/api/projects/${id}/members`, {
        method: 'DELETE',
        body: JSON.stringify({ memberIds }),
      }),
    dashboard: {
      getStats: (projectId: string) =>
        apiRequest<DashboardStats>(`/api/projects/${projectId}/dashboard/stats`),
    },
    phases: {
      list: (projectId: string) => apiRequest<Phase[]>(`/api/projects/${projectId}/phases`),
      getTasks: (projectId: string, phaseId: string) =>
        apiRequest<Task[]>(`/api/projects/${projectId}/phases/${phaseId}/tasks`),
      createTask: (
        projectId: string,
        phaseId: string,
        data: {
          name: string;
          description?: string;
          ownerId?: string;
          order?: number;
        }
      ) =>
        apiRequest<Task>(`/api/projects/${projectId}/phases/${phaseId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateTask: (
        projectId: string,
        phaseId: string,
        taskId: string,
        data: {
          name?: string;
          description?: string | null;
          ownerId?: string | null;
          startDate?: string | null;
          plannedCompletionDate?: string | null;
          actualCompletionDate?: string | null;
          order?: number;
        }
      ) =>
        apiRequest<Task>(
          `/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        ),
      deleteTask: (projectId: string, phaseId: string, taskId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`, {
          method: 'DELETE',
        }),
      tasks: {
        comments: {
          list: (projectId: string, phaseId: string, taskId: string) =>
            apiRequest<Comment[]>(
              `/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}/comments`
            ),
          create: (
            projectId: string,
            phaseId: string,
            taskId: string,
            data: {
              content: string;
              notifyOption: 'task_owner' | 'task_owner_mentions' | 'all_members' | 'none';
            }
          ) =>
            apiRequest<Comment>(
              `/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}/comments`,
              {
                method: 'POST',
                body: JSON.stringify(data),
              }
            ),
        },
      },
    },
    vendors: {
      list: (projectId: string) =>
        apiRequest<ProjectVendor[]>(`/api/projects/${projectId}/vendors`),
      create: (
        projectId: string,
        data: {
          vendorId?: string;
          name: string;
          organizationNumber?: string;
          emailDomain?: string;
          additionalData?: any;
          status?: VendorStatus;
        }
      ) =>
        apiRequest<ProjectVendor>(`/api/projects/${projectId}/vendors`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        vendorId: string,
        data: {
          status: VendorStatus;
        }
      ) =>
        apiRequest<ProjectVendor>(`/api/projects/${projectId}/vendors/${vendorId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, vendorId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/vendors/${vendorId}`, {
          method: 'DELETE',
        }),
      contacts: {
        create: (
          projectId: string,
          vendorId: string,
          data: {
            firstName: string;
            lastName: string;
            email: string;
            isMainContact?: boolean;
          }
        ) =>
          apiRequest<VendorContactPerson>(
            `/api/projects/${projectId}/vendors/${vendorId}/contacts`,
            {
              method: 'POST',
              body: JSON.stringify(data),
            }
          ),
      },
    },
  },
  requirements: {
    hierarchies: {
      list: (projectId: string) =>
        apiRequest<RequirementHierarchy[]>(
          `/api/projects/${projectId}/requirements/hierarchies`
        ),
      create: (
        projectId: string,
        data: {
          title: string;
          description?: string;
          parentId?: string | null;
        }
      ) =>
        apiRequest<RequirementHierarchy>(
          `/api/projects/${projectId}/requirements/hierarchies`,
          {
            method: 'POST',
            body: JSON.stringify(data),
          }
        ),
      update: (
        projectId: string,
        id: string,
        data: {
          title?: string;
          description?: string | null;
        }
      ) =>
        apiRequest<RequirementHierarchy>(
          `/api/projects/${projectId}/requirements/hierarchies/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, id: string) =>
        apiRequest<void>(`/api/projects/${projectId}/requirements/hierarchies/${id}`, {
          method: 'DELETE',
        }),
      reorder: (
        projectId: string,
        data: {
          hierarchyIds: string[];
          parentId?: string | null;
        }
      ) =>
        apiRequest<void>(`/api/projects/${projectId}/requirements/hierarchies/reorder`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
    },
    list: (projectId: string) =>
      apiRequest<Requirement[]>(`/api/projects/${projectId}/requirements`),
    create: (
      projectId: string,
      data: {
        hierarchyId: string;
        description: string;
        type: 'Information' | 'Mandatory' | 'Important' | 'Wish';
        status: 'Approved' | 'ForReview' | 'New' | null;
      }
    ) =>
      apiRequest<Requirement>(`/api/projects/${projectId}/requirements`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (
      projectId: string,
      id: string,
      data: {
        description?: string;
        type?: 'Information' | 'Mandatory' | 'Important' | 'Wish';
        status?: 'Approved' | 'ForReview' | 'New' | null;
      }
    ) =>
      apiRequest<Requirement>(`/api/projects/${projectId}/requirements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, id: string) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/${id}`, {
        method: 'DELETE',
      }),
    move: (
      projectId: string,
      id: string,
      data: {
        hierarchyId: string;
        order?: number;
      }
    ) =>
      apiRequest<Requirement>(`/api/projects/${projectId}/requirements/${id}/move`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    reorder: (
      projectId: string,
      data: {
        requirementIds: string[];
        hierarchyId: string;
      }
    ) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/reorder`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    bulkUpdate: (
      projectId: string,
      data: {
        requirementIds: string[];
        type?: 'Information' | 'Mandatory' | 'Important' | 'Wish';
        status?: 'Approved' | 'ForReview' | 'New' | null;
        hierarchyId?: string;
      }
    ) =>
      apiRequest<Requirement[]>(`/api/projects/${projectId}/requirements/bulk-update`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    bulkDelete: (
      projectId: string,
      data: {
        requirementIds: string[];
      }
    ) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/bulk-delete`, {
        method: 'DELETE',
        body: JSON.stringify(data),
      }),
  },
  rfi: {
    get: (projectId: string) => apiRequest<RFI>(`/api/projects/${projectId}/rfi`),
    update: (
      projectId: string,
      data: {
        emailSubject?: string;
        emailText?: string;
        rfiInformation?: string;
        deadline?: string | null;
        autoPublishDate?: string | null;
      }
    ) =>
      apiRequest<RFI>(`/api/projects/${projectId}/rfi`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    publish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/publish`, {
        method: 'POST',
      }),
    unpublish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/unpublish`, {
        method: 'POST',
      }),
    questions: {
      list: (projectId: string) =>
        apiRequest<RFIQuestion[]>(`/api/projects/${projectId}/rfi/questions`),
      create: (
        projectId: string,
        data: {
          title: string;
          description?: string | null;
          type: RFIQuestionType;
          required?: boolean;
          scaleLabels?: Record<string, string> | null;
        }
      ) =>
        apiRequest<RFIQuestion>(`/api/projects/${projectId}/rfi/questions`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        questionId: string,
        data: {
          title?: string;
          description?: string | null;
          type?: RFIQuestionType;
          required?: boolean;
          scaleLabels?: Record<string, string> | null;
        }
      ) =>
        apiRequest<RFIQuestion>(`/api/projects/${projectId}/rfi/questions/${questionId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, questionId: string) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/questions/${questionId}`, {
          method: 'DELETE',
        }),
      reorder: (
        projectId: string,
        data: {
          questionIds: string[];
        }
      ) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/questions/reorder`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      options: {
        create: (
          projectId: string,
          questionId: string,
          data: {
            label: string;
            value?: string | null;
            xAxis?: boolean;
            yAxis?: boolean;
          }
        ) =>
          apiRequest<RFIQuestionOption>(
            `/api/projects/${projectId}/rfi/questions/${questionId}/options`,
            {
              method: 'POST',
              body: JSON.stringify(data),
            }
          ),
        update: (
          projectId: string,
          questionId: string,
          optionId: string,
          data: {
            label?: string;
            value?: string | null;
            xAxis?: boolean;
            yAxis?: boolean;
          }
        ) =>
          apiRequest<RFIQuestionOption>(
            `/api/projects/${projectId}/rfi/questions/${questionId}/options/${optionId}`,
            {
              method: 'PUT',
              body: JSON.stringify(data),
            }
          ),
        delete: (projectId: string, questionId: string, optionId: string) =>
          apiRequest<{ success: boolean }>(
            `/api/projects/${projectId}/rfi/questions/${questionId}/options/${optionId}`,
            {
              method: 'DELETE',
            }
          ),
        reorder: (
          projectId: string,
          questionId: string,
          data: {
            optionIds: string[];
          }
        ) =>
          apiRequest<{ success: boolean }>(
            `/api/projects/${projectId}/rfi/questions/${questionId}/options/reorder`,
            {
              method: 'PUT',
              body: JSON.stringify(data),
            }
          ),
      },
    },
    vendorResponses: {
      list: (projectId: string) =>
        apiRequest<RFIVendorResponse[]>(`/api/projects/${projectId}/rfi/vendor-responses`),
      get: (projectId: string, vendorResponseId: string) =>
        apiRequest<RFIVendorResponseWithAnswers>(
          `/api/projects/${projectId}/rfi/vendor-responses/${vendorResponseId}`
        ),
    },
    send: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/send`, {
        method: 'POST',
      }),
    resend: (projectId: string, vendorId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/resend/${vendorId}`, {
        method: 'POST',
      }),
    preview: (projectId: string) => apiRequest<RFI>(`/api/projects/${projectId}/rfi/preview`),
  },
  rfp: {
    get: (projectId: string) => apiRequest<RFP>(`/api/projects/${projectId}/rfp`),
    update: (
      projectId: string,
      data: {
        status?: 'Draft' | 'Published' | 'Closed';
        contactPersonId?: string | null;
        alternativeContactPersonId?: string | null;
        publishDate?: string | null;
        deliveryDate?: string | null;
      }
    ) =>
      apiRequest<RFP>(`/api/projects/${projectId}/rfp`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    publish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/publish`, {
        method: 'POST',
      }),
    send: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/send`, {
        method: 'POST',
      }),
    schedule: {
      list: (projectId: string) =>
        apiRequest<RFPScheduleItem[]>(`/api/projects/${projectId}/rfp/schedule`),
      create: (
        projectId: string,
        data: {
          type: RFPScheduleItemType;
          description: string;
          date?: string;
          fromDate?: string;
          toDate?: string;
          isRequired?: boolean;
        }
      ) =>
        apiRequest<RFPScheduleItem>(`/api/projects/${projectId}/rfp/schedule`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        itemId: string,
        data: {
          description?: string;
          date?: string | null;
          fromDate?: string | null;
          toDate?: string | null;
        }
      ) =>
        apiRequest<RFPScheduleItem>(`/api/projects/${projectId}/rfp/schedule/${itemId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, itemId: string) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/schedule/${itemId}`, {
          method: 'DELETE',
        }),
    },
    documents: {
      list: (projectId: string) =>
        apiRequest<RFPDocument[]>(`/api/projects/${projectId}/rfp/documents`),
      create: (
        projectId: string,
        data: {
          type: RFPDocumentType;
          description: string;
          url?: string;
          fileName?: string;
          fileType?: string;
          fileData?: string;
          fileSize?: number;
        }
      ) =>
        apiRequest<RFPDocument>(`/api/projects/${projectId}/rfp/documents`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        docId: string,
        data: {
          description?: string;
          url?: string | null;
        }
      ) =>
        apiRequest<RFPDocument>(`/api/projects/${projectId}/rfp/documents/${docId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, docId: string) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/documents/${docId}`, {
          method: 'DELETE',
        }),
      reorder: (
        projectId: string,
        data: {
          documentIds: string[];
        }
      ) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/documents/reorder`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
    },
    changelog: {
      list: (projectId: string) =>
        apiRequest<RFPChangelogEntry[]>(`/api/projects/${projectId}/rfp/changelog`),
      update: (
        projectId: string,
        entryId: string,
        data: {
          description: string;
        }
      ) =>
        apiRequest<RFPChangelogEntry>(`/api/projects/${projectId}/rfp/changelog/${entryId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, entryId: string) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/changelog/${entryId}`, {
          method: 'DELETE',
        }),
    },
    questions: {
      list: (projectId: string, filter?: 'answered' | 'unanswered') =>
        apiRequest<RFPQuestion[]>(
          `/api/projects/${projectId}/rfp/questions${filter ? `?filter=${filter}` : ''}`
        ),
      create: (
        projectId: string,
        data: {
          question: string;
          vendorId: string;
          contactPersonId: string;
          createdAt?: string;
        }
      ) =>
        apiRequest<RFPQuestion>(`/api/projects/${projectId}/rfp/questions`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      split: (
        projectId: string,
        questionId: string,
        data: {
          questions: string[];
        }
      ) =>
        apiRequest<RFPQuestion[]>(
          `/api/projects/${projectId}/rfp/questions/${questionId}/split`,
          {
            method: 'POST',
            body: JSON.stringify(data),
          }
        ),
      answer: (
        projectId: string,
        questionId: string,
        data: {
          cleanedQuestion: string;
          answer: string;
        }
      ) =>
        apiRequest<RFPQuestion>(
          `/api/projects/${projectId}/rfp/questions/${questionId}/answer`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, questionId: string) =>
        apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/questions/${questionId}`, {
          method: 'DELETE',
        }),
    },
    announcements: {
      list: (projectId: string) =>
        apiRequest<RFPAnnouncement[]>(`/api/projects/${projectId}/rfp/announcements`),
      create: (
        projectId: string,
        data: {
          title: string;
          description: string;
          sendImmediately?: boolean;
          scheduledSendAt?: string;
        }
      ) =>
        apiRequest<RFPAnnouncement>(`/api/projects/${projectId}/rfp/announcements`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        announcementId: string,
        data: {
          title: string;
          description: string;
          sendImmediately?: boolean;
          scheduledSendAt?: string;
        }
      ) =>
        apiRequest<RFPAnnouncement>(
          `/api/projects/${projectId}/rfp/announcements/${announcementId}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, announcementId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/announcements/${announcementId}`,
          {
            method: 'DELETE',
          }
        ),
      send: (projectId: string, announcementId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/announcements/${announcementId}/send`,
          {
            method: 'POST',
          }
        ),
    },
  },
};
