const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiError {
  error: string;
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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.error || "Request failed");
  }

  // Handle 204 No Content responses (no body to parse)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
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
    },
  },
  templates: {
    list: () => apiRequest<Template[]>("/api/templates"),
    get: (id: string) => apiRequest<Template>(`/api/templates/${id}`),
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
}

