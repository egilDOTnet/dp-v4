// Dynamically determine API URL based on current hostname
// This allows the app to work when accessed via local network (e.g., egilDOTstudio.local:3000)
function getApiUrl(): string {
  // In browser, always use current hostname with port 3001
  // This ensures it works when accessed from other devices on the network
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:3001`;
  }

  // For server-side rendering, use environment variable or fallback to localhost
  // Note: NEXT_PUBLIC_API_URL in docker-compose is for SSR only
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

// Compute API URL at runtime to ensure it always uses the current hostname
// This is important when accessing from different devices on the network
const getApiUrlRuntime = () => getApiUrl();

export interface ApiError {
  error: string;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : (globalThis as any).localStorage?.getItem("token") ?? (globalThis as any).__TEST_AUTH_TOKEN ?? null;

  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // Only set Content-Type if there's a body
  if (options.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  try {
    const apiUrl = getApiUrlRuntime();
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError & { brregName?: string; [key: string]: any };
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, create a generic error
        errorData = { error: `Request failed with status ${response.status}` };
      }
      const errorMessage = errorData.message 
        ? `${errorData.error || "Request failed"}: ${errorData.message}`
        : (errorData.error || "Request failed");
      const error = new Error(errorMessage);
      // Attach the full error data to the error object for access in catch blocks
      (error as any).response = errorData;
      (error as any).status = response.status;
      throw error;
    }

    // Handle 204 No Content responses (no body to parse)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const apiUrl = getApiUrlRuntime();
      throw new Error(
        `Network error: Could not connect to server at ${apiUrl}. Please check if the API server is running.`
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
    updateProfile: (data: {
      firstName?: string;
      lastName?: string;
      companyName?: string;
      profileImageData?: string | null;
      profileImageFileType?: "image/png" | "image/jpeg" | "image/gif" | null;
      profileColor?: string | null;
    }) =>
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
    updateGraphics: (
      id: string,
      data: {
        logoData?: string | null;
        logoFileName?: string | null;
        logoFileType?: string | null;
        logoShape?: string | null;
        logoPlacement?: string | null;
        logoBorder?: string | null;
        bannerData?: string | null;
        bannerFileName?: string | null;
        bannerFileType?: string | null;
      }
    ) =>
      apiRequest<Project>(`/api/projects/${id}/graphics`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteLogo: (id: string) =>
      apiRequest<Project>(`/api/projects/${id}/graphics/logo`, {
        method: "DELETE",
      }),
    deleteBanner: (id: string) =>
      apiRequest<Project>(`/api/projects/${id}/graphics/banner`, {
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
          shallReceiveRFI?: boolean;
          shallReceiveRFP?: boolean;
          shallReceiveShortlist?: boolean;
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
          shallReceiveRFI?: boolean;
          shallReceiveRFP?: boolean;
          shallReceiveShortlist?: boolean;
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
    importTasks: (
      projectId: string,
      phaseId: string,
      tasks: Array<{ name: string }>
    ) =>
      apiRequest<{ count: number }>(`/api/projects/${projectId}/import/tasks`, {
        method: "POST",
        body: JSON.stringify({ phaseId, tasks }),
      }),
    importRFIQuestions: (
      projectId: string,
      questions: Array<{ title: string }>
    ) =>
      apiRequest<{ count: number }>(`/api/projects/${projectId}/import/rfi-questions`, {
        method: "POST",
        body: JSON.stringify({ questions }),
      }),
    importRequirements: (
      projectId: string,
      requirements: Array<{
        level1: string;
        level2?: string;
        requirement: string;
        type?: string;
      }>
    ) =>
      apiRequest<{ count: number }>(`/api/projects/${projectId}/import/requirements`, {
        method: "POST",
        body: JSON.stringify({ requirements }),
      }),
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
    approved: (projectId: string) =>
      apiRequest<Requirement[]>(`/api/projects/${projectId}/requirements/approved`),
    bulkApprove: (projectId: string) =>
      apiRequest<{ message: string; updatedCount: number }>(
        `/api/projects/${projectId}/requirements/bulk-approve`,
        {
          method: "PUT",
        }
      ),
    downloadPdf: async (projectId: string): Promise<Blob> => {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;
      const apiUrl = getApiUrlRuntime();
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/requirements/pdf`, {
        method: "GET",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || errorData.error || "Failed to download PDF");
      }
      return response.blob();
    },
    downloadExcel: async (projectId: string): Promise<Blob> => {
      const token = typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;
      const apiUrl = getApiUrlRuntime();
      const response = await fetch(`${apiUrl}/api/projects/${projectId}/requirements/excel`, {
        method: "GET",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || errorData.error || "Failed to download Excel");
      }
      return response.blob();
    },
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
      get: (projectId: string, vendorResponseId: string) =>
        apiRequest<RFIVendorResponseWithAnswers>(
          `/api/projects/${projectId}/rfi/vendor-responses/${vendorResponseId}`
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
    getPreviewToken: (projectId: string) =>
      apiRequest<{ token: string }>(`/api/projects/${projectId}/rfi/preview-token`, {
        method: "POST",
      }),
  },
  rfp: {
    get: (projectId: string) =>
      apiRequest<RFP>(`/api/projects/${projectId}/rfp`),
    update: (
      projectId: string,
      data: {
        status?: "Draft" | "Published" | "Closed";
        contactPersonId?: string | null;
        alternativeContactPersonId?: string | null;
        publishDate?: string | null;
        deliveryDate?: string | null;
        about?: string | null;
      }
    ) =>
      apiRequest<RFP>(`/api/projects/${projectId}/rfp`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    publish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/publish`, {
        method: "POST",
      }),
    unpublish: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/unpublish`, {
        method: "POST",
      }),
    getPreviewToken: (projectId: string) =>
      apiRequest<{ token: string }>(`/api/projects/${projectId}/rfp/preview-token`, {
        method: "POST",
      }),
    impersonate: (projectId: string, contactPersonId: string) =>
      apiRequest<{ token: string; contactPerson: VendorContactPerson }>(
        `/api/projects/${projectId}/rfp/impersonate/${contactPersonId}`,
        {
          method: "POST",
        }
      ),
    send: (projectId: string) =>
      apiRequest<{ success: boolean }>(`/api/projects/${projectId}/rfp/send`, {
        method: "POST",
      }),
    schedule: {
      list: (projectId: string) =>
        apiRequest<RFPScheduleItem[]>(`/api/projects/${projectId}/rfp/schedule`),
      create: (
        projectId: string,
        data: {
          type: "StartDate" | "AcceptanceDate" | "QuestionsDate" | "DeliveryDate" | "CustomDate" | "CustomDateRange";
          description: string;
          date?: string;
          fromDate?: string;
          toDate?: string;
          isRequired?: boolean;
        }
      ) =>
        apiRequest<RFPScheduleItem>(`/api/projects/${projectId}/rfp/schedule`, {
          method: "POST",
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
        apiRequest<RFPScheduleItem>(
          `/api/projects/${projectId}/rfp/schedule/${itemId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, itemId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/schedule/${itemId}`,
          {
            method: "DELETE",
          }
        ),
    },
    documents: {
      list: (projectId: string) =>
        apiRequest<RFPDocument[]>(`/api/projects/${projectId}/rfp/documents`),
      create: (
        projectId: string,
        data: {
          type: "Document" | "Link" | "Requirements";
          description: string;
          url?: string;
          fileName?: string;
          fileType?: string;
          fileData?: string;
          fileSize?: number;
        }
      ) =>
        apiRequest<RFPDocument>(`/api/projects/${projectId}/rfp/documents`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        docId: string,
        data: {
          description?: string;
          url?: string | null;
          fileName?: string | null;
          fileType?: string | null;
          fileData?: string | null;
          fileSize?: number | null;
        }
      ) =>
        apiRequest<RFPDocument>(
          `/api/projects/${projectId}/rfp/documents/${docId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, docId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/documents/${docId}`,
          {
            method: "DELETE",
          }
        ),
      reorder: (
        projectId: string,
        data: {
          documentIds: string[];
        }
      ) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/documents/reorder`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
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
        apiRequest<RFPChangelogEntry>(
          `/api/projects/${projectId}/rfp/changelog/${entryId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, entryId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/changelog/${entryId}`,
          {
            method: "DELETE",
          }
        ),
    },
    questions: {
      list: (projectId: string, filter?: "answered" | "unanswered") =>
        apiRequest<RFPQuestion[]>(
          `/api/projects/${projectId}/rfp/questions${filter ? `?filter=${filter}` : ""}`
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
          method: "POST",
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
            method: "POST",
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
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, questionId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/questions/${questionId}`,
          {
            method: "DELETE",
          }
        ),
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
          method: "POST",
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
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, announcementId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/announcements/${announcementId}`,
          {
            method: "DELETE",
          }
        ),
      send: (projectId: string, announcementId: string) =>
        apiRequest<{ success: boolean }>(
          `/api/projects/${projectId}/rfp/announcements/${announcementId}/send`,
          {
            method: "POST",
          }
        ),
    },
    vendorResponses: {
      list: (projectId: string) =>
        apiRequest<VendorResponseWithFiles[]>(`/api/projects/${projectId}/rfp/vendor-responses`),
    },
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
  vendor: {
    rfi: {
      getByToken: (token: string) =>
        apiRequest<{
          project: {
            id: string;
            name: string;
            type: string | null;
            logoData: string | null;
            logoFileName: string | null;
            logoFileType: string | null;
            logoShape: string | null;
            logoPlacement: string | null;
            logoBorder: string | null;
            bannerData: string | null;
            bannerFileName: string | null;
            bannerFileType: string | null;
          };
          rfi: {
            id: string;
            projectId: string;
            emailSubject: string | null;
            emailText: string | null;
            rfiInformation: string | null;
            deadline: string | null;
            status: string;
            publishedAt: string | null;
            unpublishedAt: string | null;
            questions: Array<{
              id: string;
              rfiId: string;
              title: string;
              description: string | null;
              type: string;
              order: number;
              required: boolean;
              scaleLabels: Record<string, string> | null;
              options: Array<{
                id: string;
                questionId: string;
                label: string;
                value: string | null;
                xAxis: boolean;
                yAxis: boolean;
                order: number;
              }>;
            }>;
          };
          vendor: {
            id: string;
            name: string;
          };
          vendorResponse: {
            id: string;
            status: string;
            answeredAt: string | null;
            sentAt: string | null;
          };
          contactPerson: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
          } | null;
          existingResponses: Record<string, any>;
          deadlinePassed?: boolean;
        }>(`/api/vendor/rfi/${encodeURIComponent(token)}`),
      getResponse: (token: string) =>
        apiRequest<{
          answers: Record<string, any>;
          contactPerson: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
          };
        }>(`/api/vendor/rfi/${encodeURIComponent(token)}/response`),
      submitResponse: (
        token: string,
        data: {
          answers: Record<string, any>;
          contactPerson: {
            firstName: string;
            lastName: string;
            email: string;
            phone?: string | null;
          };
        }
      ) =>
        apiRequest<{ success: boolean }>(`/api/vendor/rfi/${encodeURIComponent(token)}/response`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      saveAnswers: (token: string, answers: Record<string, any>) =>
        apiRequest<{ success: boolean }>(`/api/vendor/rfi/${encodeURIComponent(token)}/answers`, {
          method: "PUT",
          body: JSON.stringify({ answers }),
        }),
      getContacts: (token: string) =>
        apiRequest<
          Array<{
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            phone: string | null;
            isMainContact: boolean;
          }>
        >(`/api/vendor/rfi/${encodeURIComponent(token)}/contacts`),
      createContact: (
        token: string,
        data: {
          firstName: string;
          lastName: string;
          email: string;
          phone?: string | null;
        }
      ) =>
        apiRequest<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
          isMainContact: boolean;
        }>(`/api/vendor/rfi/${encodeURIComponent(token)}/contacts`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
  },
  vendorRfp: {
    auth: {
      checkUser: (email: string) =>
        apiRequest<{ exists: boolean; hasPassword: boolean }>("/api/vendor-rfp/auth/check-user", {
          method: "POST",
          body: JSON.stringify({ email }),
        }),
      login: (email: string, password?: string) =>
        apiRequest<{ token: string; contactPerson: VendorContactPerson }>("/api/vendor-rfp/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      requestMagicLink: (email: string) =>
        apiRequest<{
          message: string;
          magicLink?: string;
          token?: string;
        }>("/api/vendor-rfp/auth/magic-link", {
          method: "POST",
          body: JSON.stringify({ email }),
        }),
      setPassword: (token: string, password: string) =>
        apiRequest<{ token: string; contactPerson: VendorContactPerson }>("/api/vendor-rfp/auth/set-password", {
          method: "POST",
          body: JSON.stringify({ token, password }),
        }),
      me: () => apiRequest<{ contactPerson: VendorContactPerson; mainContact: { id: string; firstName: string; lastName: string; email: string } | null }>("/api/vendor-rfp/auth/me"),
    },
    rfps: {
      list: () => apiRequest<RFPListItem[]>("/api/vendor-rfp/rfps"),
      get: (rfpId: string) => apiRequest<RFPDetail>(`/api/vendor-rfp/rfps/${rfpId}`),
      getPreview: (rfpId: string, previewToken: string) => {
        // Preview requests don't use Authorization header - token is in query string
        const apiUrl = getApiUrlRuntime();
        return fetch(`${apiUrl}/api/vendor-rfp/rfps/${rfpId}/preview?token=${encodeURIComponent(previewToken)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }).then(async (response) => {
          if (!response.ok) {
            let errorData: ApiError;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: `Request failed with status ${response.status}` };
            }
            const errorMessage = errorData.message 
              ? `${errorData.error || "Request failed"}: ${errorData.message}`
              : (errorData.error || "Request failed");
            throw new Error(errorMessage);
          }
          return response.json();
        }) as Promise<RFPDetail>;
      },
      participate: (rfpId: string) =>
        apiRequest<{
          id: string;
          status: RFPVendorResponseStatus;
          participatedAt: string | null;
        }>(`/api/vendor-rfp/rfps/${rfpId}/participate`, {
          method: "POST",
        }),
      decline: (rfpId: string, note?: string) =>
        apiRequest<{
          id: string;
          status: RFPVendorResponseStatus;
        }>(`/api/vendor-rfp/rfps/${rfpId}/decline`, {
          method: "POST",
          body: JSON.stringify({ note }),
        }),
      downloadRequirementsPdf: async (rfpId: string): Promise<Blob> => {
        const token = typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;
        const apiUrl = getApiUrlRuntime();
        const response = await fetch(`${apiUrl}/api/vendor-rfp/rfps/${rfpId}/requirements/pdf`, {
          method: "GET",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
          throw new Error(errorData.message || errorData.error || "Failed to download PDF");
        }
        return response.blob();
      },
      downloadRequirementsExcel: async (rfpId: string): Promise<Blob> => {
        const token = typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;
        const apiUrl = getApiUrlRuntime();
        const response = await fetch(`${apiUrl}/api/vendor-rfp/rfps/${rfpId}/requirements/excel`, {
          method: "GET",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Request failed with status ${response.status}` }));
          throw new Error(errorData.message || errorData.error || "Failed to download Excel");
        }
        return response.blob();
      },
      askQuestion: (rfpId: string, question: string) =>
        apiRequest<{
          id: string;
          question: string;
          createdAt: string;
        }>(`/api/vendor-rfp/rfps/${rfpId}/questions`, {
          method: "POST",
          body: JSON.stringify({ question }),
        }),
      getQuestions: (rfpId: string) =>
        apiRequest<
          Array<{
            id: string;
            question: string;
            cleanedQuestion: string | null;
            answer: string | null;
            answeredAt: string | null;
            createdAt: string;
            vendor: { id: string; name: string };
            contactPerson: {
              id: string;
              firstName: string;
              lastName: string;
              email: string;
            };
            answeredBy: { id: string; name: string; email: string } | null;
          }>
        >(`/api/vendor-rfp/rfps/${rfpId}/questions`),
      getProposal: (rfpId: string) =>
        apiRequest<RFPProposalFile[]>(`/api/vendor-rfp/rfps/${rfpId}/proposal`),
      uploadFile: async (rfpId: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const token = typeof window !== "undefined"
          ? localStorage.getItem("token")
          : (globalThis as any).localStorage?.getItem("token") ?? null;

        const headers: HeadersInit = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const apiUrl = getApiUrlRuntime();
        const response = await fetch(`${apiUrl}/api/vendor-rfp/rfps/${rfpId}/proposal/files`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errorData.error || "Request failed");
        }

        return response.json() as Promise<{
          id: string;
          fileName: string;
          fileType: string;
          fileSize: number;
          order: number;
        }>;
      },
      updateFileName: (rfpId: string, fileId: string, fileName: string) =>
        apiRequest<{ id: string; fileName: string }>(`/api/vendor-rfp/rfps/${rfpId}/proposal/files/${fileId}`, {
          method: "PUT",
          body: JSON.stringify({ fileName }),
        }),
      deleteFile: (rfpId: string, fileId: string) =>
        apiRequest<{ message: string }>(`/api/vendor-rfp/rfps/${rfpId}/proposal/files/${fileId}`, {
          method: "DELETE",
        }),
      submitProposal: (rfpId: string) =>
        apiRequest<{
          id: string;
          status: RFPVendorResponseStatus;
          proposalSubmittedAt: string | null;
        }>(`/api/vendor-rfp/rfps/${rfpId}/proposal/submit`, {
          method: "POST",
        }),
      reopenProposal: (rfpId: string) =>
        apiRequest<{
          id: string;
          status: RFPVendorResponseStatus;
        }>(`/api/vendor-rfp/rfps/${rfpId}/proposal/reopen`, {
          method: "POST",
        }),
      uploadRequirementsResponse: async (
        rfpId: string,
        file: File,
        columnMapping?: { requirementNumber: number; answer: number; description: number; reference: number }
      ) => {
        const formData = new FormData();
        formData.append("file", file);
        
        if (columnMapping) {
          formData.append("columnMapping", JSON.stringify(columnMapping));
        }

        const token = typeof window !== "undefined"
          ? localStorage.getItem("token")
          : (globalThis as any).localStorage?.getItem("token") ?? null;

        const headers: HeadersInit = {
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const apiUrl = getApiUrlRuntime();
        const response = await fetch(`${apiUrl}/api/vendor-rfp/rfps/${rfpId}/requirements/upload`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errorData.error || "Request failed");
        }

        return response.json() as Promise<{
          totalRequirements: number;
          answeredCount: number;
          percentage: number;
          invalidAnswers?: Array<{ requirementNumber: string; invalidValue: string; row: number }>;
          needsColumnMapping?: boolean;
          availableColumns?: Array<{ index: number; header: string; sampleValues: string[] }>;
        }>;
      },
      getRequirementsResponses: (rfpId: string) =>
        apiRequest<{
          responses: Array<{
            id: string;
            requirementId: string;
            requirementNumber: string;
            answer: string | null;
            description: string | null;
            reference: string | null;
          }>;
          totalRequirements: number;
          answeredCount: number;
          percentage: number;
        }>(`/api/vendor-rfp/rfps/${rfpId}/requirements/responses`),
    },
  },
  evaluation: {
    scores: {
      list: (projectId: string) =>
        apiRequest<EvaluationScore[]>(`/api/projects/${projectId}/rfp/evaluation/scores`),
      create: (
        projectId: string,
        data: {
          vendorResponseId: string;
          requirementId: string;
          score: number | null;
          note?: string | null;
          question?: string | null;
        }
      ) =>
        apiRequest<EvaluationScore>(
          `/api/projects/${projectId}/rfp/evaluation/scores`,
          {
            method: "POST",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, scoreId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/rfp/evaluation/scores/${scoreId}`, {
          method: "DELETE",
        }),
    },
    requirements: (projectId: string) =>
      apiRequest<EvaluationRequirement[]>(
        `/api/projects/${projectId}/rfp/evaluation/requirements`
      ),
    progress: (projectId: string) =>
      apiRequest<EvaluationProgress>(
        `/api/projects/${projectId}/rfp/evaluation/progress`
      ),
    hierarchyWeights: {
      list: (projectId: string) =>
        apiRequest<EvaluationHierarchyWeight[]>(
          `/api/projects/${projectId}/rfp/evaluation/hierarchy-weights`
        ),
      update: (
        projectId: string,
        data: {
          weights: Array<{
            hierarchyId: string;
            level1HierarchyId?: string | null;
            weight: number;
          }>;
        }
      ) =>
        apiRequest<EvaluationHierarchyWeight[]>(
          `/api/projects/${projectId}/rfp/evaluation/hierarchy-weights`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
    },
    summary: (projectId: string) =>
      apiRequest<EvaluationSummary>(
        `/api/projects/${projectId}/rfp/evaluation/summary`
      ),
    comparison: (
      projectId: string,
      filters?: {
        hierarchyId?: string;
        evaluatorId?: string;
        vendorId?: string;
      }
    ) => {
      const queryParams = new URLSearchParams();
      if (filters?.hierarchyId) queryParams.append("hierarchyId", filters.hierarchyId);
      if (filters?.evaluatorId) queryParams.append("evaluatorId", filters.evaluatorId);
      if (filters?.vendorId) queryParams.append("vendorId", filters.vendorId);
      const query = queryParams.toString();
      return apiRequest<EvaluationComparison[]>(
        `/api/projects/${projectId}/rfp/evaluation/comparison${query ? `?${query}` : ""}`
      );
    },
    references: {
      list: (projectId: string) =>
        apiRequest<ReferenceCheck[]>(`/api/projects/${projectId}/rfp/evaluation/references`),
      get: (projectId: string, vendorId: string) =>
        apiRequest<ReferenceCheck[]>(
          `/api/projects/${projectId}/rfp/evaluation/references/${vendorId}`
        ),
      create: (
        projectId: string,
        data: {
          vendorId: string;
          companyName: string;
          contactName: string;
          contactPosition?: string | null;
          contactEmail?: string | null;
          contactPhone?: string | null;
          content: string;
        }
      ) =>
        apiRequest<ReferenceCheck>(`/api/projects/${projectId}/rfp/evaluation/references`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      update: (
        projectId: string,
        referenceId: string,
        data: {
          companyName?: string;
          contactName?: string;
          contactPosition?: string | null;
          contactEmail?: string | null;
          contactPhone?: string | null;
          content?: string;
        }
      ) =>
        apiRequest<ReferenceCheck>(
          `/api/projects/${projectId}/rfp/evaluation/references/${referenceId}`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          }
        ),
      delete: (projectId: string, referenceId: string) =>
        apiRequest<void>(`/api/projects/${projectId}/rfp/evaluation/references/${referenceId}`, {
          method: "DELETE",
        }),
    },
  },
  admin: {
    referenceCheckTemplate: {
      get: () => apiRequest<ReferenceCheckTemplate>("/api/admin/reference-check-template"),
      update: (data: { content: string }) =>
        apiRequest<ReferenceCheckTemplate>("/api/admin/reference-check-template", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },
    companies: {
      list: () => apiRequest<Array<{ id: string; name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null; trialStartedAt?: string | null; createdAt: string; updatedAt: string; _count: { User: number; Project: number } }>>("/api/admin/companies"),
      get: (id: string) => apiRequest<{ id: string; name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null; trialStartedAt?: string | null; createdAt: string; updatedAt: string; _count: { User: number; Project: number } }>(`/api/admin/companies/${id}`),
      create: (data: { name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus?: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null }) => apiRequest<{ id: string; name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null; trialStartedAt?: string | null; createdAt: string; updatedAt: string }>("/api/admin/companies", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus?: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null; trialStartedAt?: string | null }) => apiRequest<{ id: string; name: string; organizationNumber?: string | null; emailDomain?: string | null; subscriptionStatus: "Trial" | "Active" | "Expired"; subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null; subscriptionExpiresAt?: string | null; trialStartedAt?: string | null; createdAt: string; updatedAt: string }>(`/api/admin/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/api/admin/companies/${id}`, { method: "DELETE" }),
    },
    users: {
      list: () => apiRequest<Array<{ id: string; email: string; name?: string | null; firstName?: string | null; lastName?: string | null; role: string; tenantId?: string | null; tenant?: { id: string; name: string } | null; createdAt: string; updatedAt: string }>>("/api/admin/users"),
      get: (id: string) => apiRequest<{ id: string; email: string; name?: string | null; firstName?: string | null; lastName?: string | null; role: string; tenantId?: string | null; tenant?: { id: string; name: string } | null; createdAt: string; updatedAt: string }>(`/api/admin/users/${id}`),
      create: (data: { email: string; firstName?: string; lastName?: string; name?: string; role: string; tenantId?: string | null }) => apiRequest<{ id: string; email: string; name?: string | null; firstName?: string | null; lastName?: string | null; role: string; tenantId?: string | null; tenant?: { id: string; name: string } | null; createdAt: string; updatedAt: string }>("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { email?: string; firstName?: string; lastName?: string; name?: string; role?: string; tenantId?: string | null }) => apiRequest<{ id: string; email: string; name?: string | null; firstName?: string | null; lastName?: string | null; role: string; tenantId?: string | null; tenant?: { id: string; name: string } | null; createdAt: string; updatedAt: string }>(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    },
    requirementTemplates: {
      list: () => apiRequest<Array<{ id: string; shortName: string; description?: string | null; languageCode: string; createdAt: string; updatedAt: string; createdBy: { id: string; email: string; name?: string | null } }>>("/api/admin/requirement-templates"),
      get: (id: string) => apiRequest<{ id: string; shortName: string; description?: string | null; languageCode: string; createdAt: string; updatedAt: string; createdBy: { id: string; email: string; name?: string | null }; hierarchies: any[] }>(`/api/admin/requirement-templates/${id}`),
      create: (data: { shortName: string; description?: string; languageCode: string }) => apiRequest<{ id: string; shortName: string; description?: string | null; languageCode: string; createdAt: string; updatedAt: string; createdBy: { id: string; email: string; name?: string | null } }>("/api/admin/requirement-templates", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { shortName?: string; description?: string; languageCode?: string }) => apiRequest<{ id: string; shortName: string; description?: string | null; languageCode: string; createdAt: string; updatedAt: string; createdBy: { id: string; email: string; name?: string | null } }>(`/api/admin/requirement-templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/api/admin/requirement-templates/${id}`, { method: "DELETE" }),
      hierarchies: {
        list: (templateId: string) =>
          apiRequest<RequirementHierarchy[]>(
            `/api/admin/requirement-templates/${templateId}/hierarchies`
          ),
        create: (
          templateId: string,
          data: {
            title: string;
            description?: string | null;
            parentId?: string | null;
          }
        ) =>
          apiRequest<RequirementHierarchy>(
            `/api/admin/requirement-templates/${templateId}/hierarchies`,
            {
              method: "POST",
              body: JSON.stringify(data),
            }
          ),
        update: (
          templateId: string,
          hierarchyId: string,
          data: {
            title?: string;
            description?: string | null;
          }
        ) =>
          apiRequest<RequirementHierarchy>(
            `/api/admin/requirement-templates/${templateId}/hierarchies/${hierarchyId}`,
            {
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
        delete: (templateId: string, hierarchyId: string) =>
          apiRequest<void>(
            `/api/admin/requirement-templates/${templateId}/hierarchies/${hierarchyId}`,
            {
              method: "DELETE",
            }
          ),
        reorder: (
          templateId: string,
          data: {
            hierarchyIds: string[];
            parentId?: string | null;
          }
        ) =>
          apiRequest<void>(
            `/api/admin/requirement-templates/${templateId}/hierarchies/reorder`,
            {
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
      },
      requirements: {
        list: (templateId: string) =>
          apiRequest<Requirement[]>(
            `/api/admin/requirement-templates/${templateId}/requirements`
          ),
        create: (
          templateId: string,
          data: {
            hierarchyId: string;
            description: string;
            type?: string;
          }
        ) =>
          apiRequest<Requirement>(
            `/api/admin/requirement-templates/${templateId}/requirements`,
            {
              method: "POST",
              body: JSON.stringify(data),
            }
          ),
        update: (
          templateId: string,
          requirementId: string,
          data: {
            description?: string;
            type?: string;
          }
        ) =>
          apiRequest<Requirement>(
            `/api/admin/requirement-templates/${templateId}/requirements/${requirementId}`,
            {
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
        delete: (templateId: string, requirementId: string) =>
          apiRequest<void>(
            `/api/admin/requirement-templates/${templateId}/requirements/${requirementId}`,
            {
              method: "DELETE",
            }
          ),
        reorder: (
          templateId: string,
          requirementId: string,
          data: {
            requirementIds: string[];
            hierarchyId: string;
          }
        ) =>
          apiRequest<void>(
            `/api/admin/requirement-templates/${templateId}/requirements/${requirementId}/reorder`,
            {
              method: "PUT",
              body: JSON.stringify(data),
            }
          ),
      },
      importRequirements: (
        templateId: string,
        requirements: Array<{
          level1: string;
          level2?: string;
          requirement: string;
          type?: string;
        }>
      ) =>
        apiRequest<{ count: number }>(
          `/api/admin/requirement-templates/${templateId}/import/requirements`,
          {
            method: "POST",
            body: JSON.stringify({ requirements }),
          }
        ),
    },
    emailTemplates: {
      list: () => apiRequest<Array<{ id: string; name: string; content?: string | null; isGlobal: boolean; createdAt: string; updatedAt: string; languages: Array<{ id: string; languageCode: string; subject?: string | null; content: string }> }>>("/api/admin/email-templates"),
      get: (id: string) => apiRequest<{ id: string; name: string; content?: string | null; isGlobal: boolean; createdAt: string; updatedAt: string; languages: Array<{ id: string; languageCode: string; subject?: string | null; content: string; createdAt: string; updatedAt: string }> }>(`/api/admin/email-templates/${id}`),
      create: (data: { name: string; content?: string }) => apiRequest<{ id: string; name: string; content?: string | null; isGlobal: boolean; createdAt: string; updatedAt: string; languages: any[] }>("/api/admin/email-templates", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: { name?: string; content?: string }) => apiRequest<{ id: string; name: string; content?: string | null; isGlobal: boolean; createdAt: string; updatedAt: string }>(`/api/admin/email-templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/api/admin/email-templates/${id}`, { method: "DELETE" }),
      addLanguage: (id: string, data: { languageCode: string; subject?: string; content: string }) => apiRequest<{ id: string; languageCode: string; subject?: string | null; content: string; createdAt: string; updatedAt: string }>(`/api/admin/email-templates/${id}/languages`, { method: "POST", body: JSON.stringify(data) }),
      deleteLanguage: (id: string, languageCode: string) => apiRequest<void>(`/api/admin/email-templates/${id}/languages/${languageCode}`, { method: "DELETE" }),
    },
    stats: () => apiRequest<{ companies: number; users: number; requirementTemplates: number; emailTemplates: number; projects: number }>("/api/admin/stats"),
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
  profileImageData?: string | null;
  profileImageFileType?: string | null;
  profileColor?: string | null;
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
  logoShape: string | null;
  logoPlacement: string | null;
  logoBorder: string | null;
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
  type: "TASK_MENTION" | "TASK_COMMENT" | "RFP_QUESTION";
  taskId: string | null;
  commentId: string | null;
  rfpQuestionId: string | null;
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
  rfpQuestion: {
    id: string;
    rfpId: string;
    rfp: {
      id: string;
      projectId: string;
      project: {
        id: string;
        name: string;
      };
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
  projectId?: string | null;
  templateId?: string | null;
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
  | "RFI_Started"
  | "RFI_Answered"
  | "RFP_Received"
  | "RFP_Delivered"
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
  lastLoggedIn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  organizationNumber: string | null;
  emailDomain: string | null;
  shallReceiveRFI: boolean;
  shallReceiveRFP: boolean;
  shallReceiveShortlist: boolean;
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

export type RFIVendorResponseStatus = "Sent" | "Started" | "Received" | "Answered" | "Rejected" | null;

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
  status: RFIStatus;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: RFIQuestion[];
}

export interface RFIResponse {
  id: string;
  questionId: string;
  answer: any; // JSON answer - can be string, number, array, object depending on question type
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

export interface RFIVendorResponse {
  id: string | null;
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
  createdAt: string | null;
  magicLinkToken: string | null;
}

export interface RFIVendorResponseWithAnswers extends RFIVendorResponse {
  responses: RFIResponse[];
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

export type RFIStatus = "Draft" | "Published" | "Unpublished";

export type RFPStatus = "Draft" | "Published" | "Unpublished" | "Closed";

export type RFPScheduleItemType =
  | "StartDate"
  | "AcceptanceDate"
  | "QuestionsDate"
  | "DeliveryDate"
  | "CustomDate"
  | "CustomDateRange";

export type RFPDocumentType = "Document" | "Link" | "Requirements";

export interface RFP {
  id: string;
  projectId: string;
  status: RFPStatus;
  contactPersonId: string | null;
  alternativeContactPersonId: string | null;
  publishDate: string | null;
  deliveryDate: string | null;
  about: string | null;
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
  linkedToDeliveryDate: boolean;
  disregardTimestamp: boolean;
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
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

export interface RFPQuestion {
  id: string;
  rfpId: string;
  question: string;
  cleanedQuestion: string | null;
  answer: string | null;
  answeredAt: string | null;
  answeredById: string | null;
  vendorId: string;
  contactPersonId: string;
  createdAt: string;
  updatedAt: string;
  vendor?: {
    id: string;
    name: string;
  };
  contactPerson?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  answeredBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  } | null;
}

export interface RFPAnnouncement {
  id: string;
  rfpId: string;
  title: string;
  description: string;
  sentAt: string | null;
  scheduledSendAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

// Vendor RFP Portal Types
export enum RFPVendorResponseStatus {
  Sent = "Sent",
  Viewed = "Viewed",
  Participating = "Participating",
  ProposalSubmitted = "ProposalSubmitted",
  Declined = "Declined",
}

export interface RFPVendorResponse {
  id: string;
  rfpId: string;
  projectVendorId: string;
  contactPersonId: string;
  status: RFPVendorResponseStatus;
  participatedAt: string | null;
  proposalSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RFPProposalFile {
  id: string;
  vendorResponseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  order: number;
  createdAt: string;
  updatedAt: string;
  fileData?: string; // Base64 encoded, included when fetching vendor responses
}

export interface VendorResponseWithFiles {
  id: string;
  vendorId: string;
  vendorName: string;
  proposalSubmittedAt: string | null;
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData: string; // Base64 encoded
    order: number;
  }>;
}

export interface VendorContactPerson {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isMainContact: boolean;
  vendor: {
    id: string;
    name: string;
  };
}

export interface RFPListItem {
  id: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    logoData: string | null;
    logoFileName: string | null;
    logoFileType: string | null;
    logoShape: string | null;
    logoPlacement: string | null;
    logoBorder: string | null;
    bannerData: string | null;
    bannerFileName: string | null;
    bannerFileType: string | null;
  };
  about: string | null;
  deliveryDate: string | null;
  scheduleItems: Array<{
    type: string;
    date: string | null;
  }>;
  vendorResponse: {
    id: string;
    status: RFPVendorResponseStatus;
    participatedAt: string | null;
  } | null;
}

export interface RFPDetail extends RFPListItem {
  scheduleItems: Array<{
    id: string;
    type: string;
    description: string;
    date: string | null;
    fromDate: string | null;
    toDate: string | null;
    order: number;
    isRequired: boolean;
  }>;
  documents: Array<{
    id: string;
    type: string;
    description: string;
    fileName: string | null;
    fileType: string | null;
    fileData: string | null;
    fileSize: number | null;
    url: string | null;
    order: number;
  }>;
  changelogEntries: Array<{
    id: string;
    description: string;
    createdAt: string;
    createdBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  questions: Array<{
    id: string;
    question: string;
    cleanedQuestion: string | null;
    answer: string | null;
    answeredAt: string | null;
    createdAt: string;
    vendor: {
      id: string;
      name: string;
    };
    contactPerson: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    answeredBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  vendorResponse: {
    id: string;
    status: RFPVendorResponseStatus;
    participatedAt: string | null;
    proposalSubmittedAt: string | null;
    declineNote: string | null;
    hasProposalChanges: boolean;
    proposalFiles: RFPProposalFile[];
  } | null;
}

// Evaluation Types
export interface EvaluationScore {
  id: string;
  vendorResponseId: string;
  requirementId: string;
  score: number | null;
  note: string | null;
  question: string | null;
  evaluatedById: string;
  evaluatedAt: string;
  updatedAt: string;
  requirement?: {
    id: string;
    number: string;
    description: string;
    type: "Information" | "Mandatory" | "Important" | "Wish";
    hierarchy: {
      id: string;
      number: string;
      title: string;
      parentId: string | null;
    };
  };
  vendorResponse?: {
    id: string;
    vendorId: string;
    vendorName: string;
    anonymizedId?: string;
  };
  evaluatedBy?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

export interface EvaluationRequirement {
  id: string;
  number: string;
  description: string;
  type: "Information" | "Mandatory" | "Important" | "Wish";
  hierarchy: {
    id: string;
    number: string;
    title: string;
    parentId: string | null;
    parent: {
      id: string;
      number: string;
      title: string;
    } | null;
  };
  vendorResponses: Array<{
    id: string;
    vendorResponseId: string;
    answer: "Yes" | "No" | "Partial" | "Development" | null;
    description: string | null;
    reference: string | null;
    vendor: {
      id: string;
      name: string;
      anonymizedId: string;
    };
  }>;
}

export interface EvaluationProgress {
  totalNeeded: number;
  completed: number;
  percentage: number;
  notesCount: number;
  questionsCount: number;
}

export interface EvaluationHierarchyWeight {
  id: string;
  rfpId: string;
  hierarchyId: string;
  level1HierarchyId: string | null;
  weight: string; // Decimal as string
  createdById: string;
  createdAt: string;
  updatedAt: string;
  hierarchy: {
    id: string;
    number: string;
    title: string;
    parentId: string | null;
  };
  createdBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

export interface EvaluationSummary {
  summary: Array<{
    requirementId: string;
    requirementNumber: string;
    requirementDescription: string;
    hierarchy: {
      id: string;
      number: string;
      title: string;
      parentId: string | null;
    };
    vendorStats: Array<{
      vendorId: string;
      anonymizedId: string;
      average: number;
      scores: number[];
    }>;
  }>;
  stats: {
    totalRequirements: number;
    totalVendors: number;
    submittedVendors: number;
    evaluationsCompleted: number;
    totalNeeded: number;
    averageScore: number;
    requirementsWithCompleteEvaluations: number;
    evaluatorsActive: number;
    totalEvaluators: number;
    notesCount: number;
    questionsCount: number;
  };
}

export interface EvaluationComparison {
  requirementId: string;
  requirementNumber: string;
  requirementDescription: string;
  requirementType: "Information" | "Mandatory" | "Important" | "Wish";
  hierarchy: {
    id: string;
    number: string;
    title: string;
    parentId: string | null;
    parent: {
      id: string;
      number: string;
      title: string;
    } | null;
  };
  vendorData: Array<{
    vendorId: string;
    anonymizedId: string;
    vendorName: string;
    scores: number[];
    average: number | null;
    stdDev: number | null;
  }>;
}

export interface ReferenceCheck {
  id: string;
  projectId: string;
  vendorId: string;
  vendorName: string;
  companyName: string;
  contactName: string;
  contactPosition: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  content: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

export interface ReferenceCheckTemplate {
  id: string;
  content: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}

