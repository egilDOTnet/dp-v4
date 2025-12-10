const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiError {
  error: string;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Only set Content-Type if there's a body
  if (options.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, create a generic error
        errorData = { error: `Request failed with status ${response.status}` };
      }
      const errorMessage = errorData.message 
        ? `${errorData.error || "Request failed"}: ${errorData.message}`
        : (errorData.error || "Request failed");
      throw new Error(errorMessage);
    }

    // Handle 204 No Content responses (no body to parse)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Network error: Could not connect to server at ${API_URL}. Please check if the API server is running.`
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}

export const api = {
  vendors: {
    search: (query: string) =>
      apiRequest<{
        results: BrregSearchResult[];
        total: number;
      }>(`/api/vendors/search?query=${encodeURIComponent(query)}`),
    getBrregData: (orgNumber: string) =>
      apiRequest<BrregCompanyDetails>(`/api/vendors/brreg/${orgNumber}`),
  },
  auth: {
    checkUser: (email: string) =>
      apiRequest<{ exists: boolean; hasPassword: boolean }>("/api/auth/check-user", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    login: (email: string, password?: string) =>
      apiRequest<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    requestMagicLink: (email: string) =>
      apiRequest<{ 
        message: string; 
        magicLink?: string; 
        token?: string;
        userExists?: boolean;
        hasPassword?: boolean;
      }>(
        "/api/auth/magic-link",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        }
      ),
    verifyMagicLink: (token: string) =>
      apiRequest<{ email: string; token: string }>(
        `/api/auth/verify-magic-link?token=${token}`
      ),
    setPassword: (token: string, password: string) =>
      apiRequest<{ token: string; user: User }>("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
    me: () => apiRequest<User>("/api/auth/me"),
    logout: () => apiRequest<{ message: string }>("/api/auth/logout", { method: "POST" }),
  },
  users: {
    getProfile: () => apiRequest<User>("/api/users/profile"),
    updateProfile: (data: { firstName?: string; lastName?: string; companyName?: string }) =>
      apiRequest<User>("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getCompanyUsers: () => apiRequest<User[]>("/api/users/company"),
    create: (data: { email: string; firstName: string; lastName: string }) =>
      apiRequest<User>("/api/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  projects: {
    list: () => apiRequest<Project[]>("/api/projects"),
    get: (id: string) => apiRequest<Project>(`/api/projects/${id}`),
    create: (data: {
      name: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      memberIds?: string[];
    }) =>
      apiRequest<Project>("/api/projects", {
        method: "POST",
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
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<void>(`/api/projects/${id}`, {
        method: "DELETE",
      }),
    addMembers: (id: string, memberIds: string[]) =>
      apiRequest<Project>(`/api/projects/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ memberIds }),
      }),
    removeMembers: (id: string, memberIds: string[]) =>
      apiRequest<Project>(`/api/projects/${id}/members`, {
        method: "DELETE",
        body: JSON.stringify({ memberIds }),
      }),
    dashboard: {
      getStats: (projectId: string) => apiRequest<DashboardStats>(`/api/projects/${projectId}/dashboard/stats`),
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
          method: "POST",
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
        apiRequest<Task>(`/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      deleteTask: (projectId: string, phaseId: string, taskId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}`, {
          method: "DELETE",
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
              notifyOption: "task_owner" | "task_owner_mentions" | "all_members" | "none";
            }
          ) =>
            apiRequest<Comment>(
              `/api/projects/${projectId}/phases/${phaseId}/tasks/${taskId}/comments`,
              {
                method: "POST",
                body: JSON.stringify(data),
              }
            ),
        },
      },
    },
    vendors: {
      list: (projectId: string) => apiRequest<ProjectVendor[]>(`/api/projects/${projectId}/vendors`),
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
          method: "POST",
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
          method: "PUT",
          body: JSON.stringify(data),
        }),
      updateDetails: (
        projectId: string,
        vendorId: string,
        data: {
          name?: string;
          organizationNumber?: string;
          emailDomain?: string;
          additionalData?: any;
        }
      ) =>
        apiRequest<ProjectVendor>(`/api/projects/${projectId}/vendors/${vendorId}/details`, {
          method: "PUT",
          body: JSON.stringify(data),
        }),
      delete: (projectId: string, vendorId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/vendors/${vendorId}`, {
          method: "DELETE",
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
              method: "POST",
              body: JSON.stringify(data),
            }
          ),
        update: (
          projectId: string,
          vendorId: string,
          contactId: string,
          data: {
            firstName?: string;
            lastName?: string;
            email?: string;
            isMainContact?: boolean;
          }
        ) =>
          apiRequest<VendorContactPerson>(
            `/api/projects/${projectId}/vendors/${vendorId}/contacts/${contactId}`,
            {
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
        delete: (projectId: string, vendorId: string, contactId: string) =>
          apiRequest<void>(`/api/projects/${projectId}/vendors/${vendorId}/contacts/${contactId}`, {
            method: "DELETE",
          }),
      },
    },
  },
  templates: {
    list: () => apiRequest<Template[]>("/api/templates"),
    get: (id: string) => apiRequest<Template>(`/api/templates/${id}`),
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
            method: "POST",
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
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, id: string) =>
        apiRequest<void>(
          `/api/projects/${projectId}/requirements/hierarchies/${id}`,
          {
            method: "DELETE",
          }
        ),
      reorder: (
        projectId: string,
        data: {
          hierarchyIds: string[];
          parentId?: string | null;
        }
      ) =>
        apiRequest<void>(
          `/api/projects/${projectId}/requirements/hierarchies/reorder`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
    },
    list: (projectId: string) =>
      apiRequest<Requirement[]>(`/api/projects/${projectId}/requirements`),
    create: (
      projectId: string,
      data: {
        hierarchyId: string;
        description: string;
        type: "Information" | "Mandatory" | "Important" | "Wish";
        status: "Approved" | "ForReview" | "New" | null;
      }
    ) =>
      apiRequest<Requirement>(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      projectId: string,
      id: string,
      data: {
        description?: string;
        type?: "Information" | "Mandatory" | "Important" | "Wish";
        status?: "Approved" | "ForReview" | "New" | null;
      }
    ) =>
      apiRequest<Requirement>(`/api/projects/${projectId}/requirements/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, id: string) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/${id}`, {
        method: "DELETE",
      }),
    move: (
      projectId: string,
      id: string,
      data: {
        hierarchyId: string;
        order?: number;
      }
    ) =>
      apiRequest<Requirement>(
        `/api/projects/${projectId}/requirements/${id}/move`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    reorder: (
      projectId: string,
      data: {
        requirementIds: string[];
        hierarchyId: string;
      }
    ) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/reorder`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    bulkUpdate: (
      projectId: string,
      data: {
        requirementIds: string[];
        type?: "Information" | "Mandatory" | "Important" | "Wish";
        status?: "Approved" | "ForReview" | "New" | null;
        hierarchyId?: string;
      }
    ) =>
      apiRequest<Requirement[]>(
        `/api/projects/${projectId}/requirements/bulk-update`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    bulkDelete: (
      projectId: string,
      data: {
        requirementIds: string[];
      }
    ) =>
      apiRequest<void>(`/api/projects/${projectId}/requirements/bulk-delete`, {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
    getHistory: (projectId: string, id: string) =>
      apiRequest<RequirementHistory[]>(
        `/api/projects/${projectId}/requirements/${id}/history`
      ),
  },
  rfi: {
    get: (projectId: string) =>
      apiRequest<RFI>(`/api/projects/${projectId}/rfi`),
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
        method: "PUT",
        body: JSON.stringify(data),
      }),
    publish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/publish`, {
        method: "POST",
      }),
    unpublish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/unpublish`, {
        method: "POST",
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
          method: "POST",
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
        apiRequest<RFIQuestion>(
          `/api/projects/${projectId}/rfi/questions/${questionId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, questionId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfi/questions/${questionId}`,
          {
            method: "DELETE",
          }
        ),
      reorder: (
        projectId: string,
        data: {
          questionIds: string[];
        }
      ) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfi/questions/reorder`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
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
              method: "POST",
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
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
        delete: (
          projectId: string,
          questionId: string,
          optionId: string
        ) =>
          apiRequest<{ success: boolean }>(
            `/api/projects/${projectId}/rfi/questions/${questionId}/options/${optionId}`,
            {
              method: "DELETE",
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
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
      },
    },
    vendorResponses: {
      list: (projectId: string) =>
        apiRequest<RFIVendorResponse[]>(
          `/api/projects/${projectId}/rfi/vendor-responses`
        ),
    },
    send: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfi/send`, {
        method: "POST",
      }),
    resend: (projectId: string, vendorId: string) =>
      apiRequest<{ success: boolean }>(
        `/api/projects/${projectId}/rfi/resend/${vendorId}`,
        {
          method: "POST",
        }
      ),
    preview: (projectId: string) =>
      apiRequest<RFI>(`/api/projects/${projectId}/rfi/preview`),
  },
  notifications: {
    list: () => apiRequest<Notification[]>("/api/notifications"),
    getUnreadCount: () => apiRequest<{ count: number }>("/api/notifications/unread-count"),
    markRead: (id: string) =>
      apiRequest<void>(`/api/notifications/${id}/read`, {
        method: "PUT",
      }),
    markAllRead: () =>
      apiRequest<void>("/api/notifications/read-all", {
        method: "PUT",
      }),
  },
};

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

export interface Template {
  id: string;
  name: string;
  content: string | null;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  status: "not_started" | "ongoing" | "delayed" | "completed";
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

export interface Notification {
  id: string;
  type: "TASK_MENTION" | "TASK_COMMENT";
  taskId: string | null;
  commentId: string | null;
  read: boolean;
  createdAt: string;
  task: {
    id: string;
    name: string;
    phaseId: string;
    project: {
      id: string;
      name: string;
    };
  } | null;
  mentionedBy: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
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
  type: "Information" | "Mandatory" | "Important" | "Wish";
  status: "Approved" | "ForReview" | "New" | null;
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

export interface RequirementHistory {
  id: string;
  requirementId: string;
  description: string;
  type: "Information" | "Mandatory" | "Important" | "Wish";
  status: "Approved" | "ForReview" | "New" | null;
  modifiedById: string;
  createdAt: string;
  modifiedBy?: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export type VendorStatus =
  | "Pending"
  | "RFI_Received"
  | "RFI_Rejected"
  | "RFI_Answered"
  | "RFP_Received"
  | "RFP_Answered"
  | "RFP_Rejected"
  | "Shortlisted"
  | "Lost"
  | "Won";

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

export interface BrregSearchResult {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  address: {
    street: string | null;
    postalCode: string | null;
    city: string | null;
    municipality: string | null;
  } | null;
  website: string | null;
  industry: string | null;
}

export interface BrregCompanyDetails {
  organizationNumber: string;
  name: string;
  organizationForm: string | null;
  address: {
    street: string | null;
    postalCode: string | null;
    city: string | null;
    municipality: string | null;
  } | null;
  website: string | null;
  industry: string | null;
  rawData: any;
}

export type RFIQuestionType =
  | "YesNo"
  | "Dropdown"
  | "MultipleChoice"
  | "Scale"
  | "ContactDetails"
  | "SingleText"
  | "MultilineText";

export type RFIVendorResponseStatus = "Sent" | "Received" | "Answered" | "Rejected";

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

export interface RFIVendorResponse {
  id: string;
  vendorId: string;
  vendorName: string;
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
  createdAt: string;
}

export interface DashboardStats {
  vendors: {
    total: number;
    byStatus: Record<string, number>;
  };
  rfi: {
    questionCount: number;
    status: "planning" | "ongoing" | "finished";
    deadline: string | null;
  };
  requirements: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    unresolvedComments: number;
  };
}

