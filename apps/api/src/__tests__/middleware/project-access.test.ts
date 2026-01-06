import { describe, it, expect, beforeEach } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { verifyProjectAccess } from "../../middleware/project-access";
import { buildTestApp } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestProjectMember,
} from "../utils/db-helpers";
import { Role } from "@dp/lib";

describe("Project Access Middleware", () => {
  beforeEach(async () => {
    await buildTestApp();
  });

  describe("verifyProjectAccess", () => {
    it("should allow access for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "member@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });
      const project = await createTestProject({
        tenantId: tenant.id,
      });
      await createTestProjectMember({
        projectId: project.id,
        userId: user.id,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
      expect((mockRequest as any).project).toBeDefined();
      expect((mockRequest as any).project.id).toBe(project.id);
    });

    it("should allow access for CompanyAdministrator from same tenant", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: Role.CompanyAdministrator,
      });
      const project = await createTestProject({
        tenantId: tenant.id,
      });

      const mockRequest = {
        user: {
          userId: admin.id,
          email: admin.email,
          tenantId: admin.tenantId,
          role: admin.role,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
      expect((mockRequest as any).project).toBeDefined();
    });

    it("should allow access for GlobalAdministrator from same tenant", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "globaladmin@example.com",
        tenantId: tenant.id,
        role: Role.GlobalAdministrator,
      });
      const project = await createTestProject({
        tenantId: tenant.id,
      });

      const mockRequest = {
        user: {
          userId: admin.id,
          email: admin.email,
          tenantId: admin.tenantId,
          role: admin.role,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
    });

    it("should deny access for user who is not a member and not an admin", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "nonmember@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });
      const project = await createTestProject({
        tenantId: tenant.id,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({ error: "Access denied - not a project member" });
    });

    it("should deny access for admin from different tenant", async () => {
      const tenant1 = await createTestTenant({ id: "tenant-1" });
      const tenant2 = await createTestTenant({ id: "tenant-2" });
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant1.id,
        role: Role.CompanyAdministrator,
      });
      const project = await createTestProject({
        tenantId: tenant2.id, // Different tenant
      });

      const mockRequest = {
        user: {
          userId: admin.id,
          email: admin.email,
          tenantId: admin.tenantId,
          role: admin.role,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({ error: "Access denied - not a project member" });
    });

    it("should return 401 if user is not authenticated", async () => {
      const tenant = await createTestTenant();
      const project = await createTestProject({
        tenantId: tenant.id,
      });

      const mockRequest = {
        user: undefined,
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({ error: "Unauthorized" });
    });

    it("should return 400 if project ID is missing from params", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: {}, // No project ID
        url: "/api/projects/requirements",
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(400);
      expect(responseBody).toEqual({ error: "Project ID required" });
    });

    it("should return 404 if project does not exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: { id: "non-existent-project-id" },
        url: "/api/projects/non-existent-project-id",
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(404);
      expect(responseBody).toEqual({ error: "Project not found" });
    });

    it("should return 401 if user does not exist in database", async () => {
      const tenant = await createTestTenant();
      const project = await createTestProject({
        tenantId: tenant.id,
      });

      const mockRequest = {
        user: {
          userId: "non-existent-user-id",
          email: "nonexistent@example.com",
          tenantId: tenant.id,
          role: Role.User,
        },
        params: { id: project.id },
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({ error: "User not found" });
    });

    it("should extract projectId from projectId param when available", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "member@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });
      const project = await createTestProject({
        tenantId: tenant.id,
      });
      await createTestProjectMember({
        projectId: project.id,
        userId: user.id,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: { projectId: project.id }, // Using projectId instead of id
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
      expect((mockRequest as any).project.id).toBe(project.id);
    });

    it("should prefer projectId over id when both are present", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "member@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });
      const project1 = await createTestProject({
        tenantId: tenant.id,
      });
      const project2 = await createTestProject({
        tenantId: tenant.id,
      });
      await createTestProjectMember({
        projectId: project1.id,
        userId: user.id,
      });

      const mockRequest = {
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        params: { id: project2.id, projectId: project1.id }, // Both present, projectId should be used
        log: {
          debug: () => {},
          warn: () => {},
        },
      } as unknown as FastifyRequest;

      let statusCode: number | undefined;
      let responseBody: any;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => {
            statusCode = code;
            responseBody = data;
            return { statusCode: code, body: data };
          },
        }),
      } as unknown as FastifyReply;

      await verifyProjectAccess(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
      expect((mockRequest as any).project.id).toBe(project1.id); // Should use projectId, not id
    });
  });
});





