import { describe, it, expect, beforeEach } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { authenticate, requireRole, requireTenant, getUser } from "../../middleware/auth";
import { buildTestApp, generateTestToken } from "../utils/test-helpers";
import { createTestUser, createTestTenant } from "../utils/db-helpers";
import { Role } from "@dp/lib";
import type { FastifyInstance } from "fastify";

describe("Auth Middleware", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("getUser", () => {
    it("should extract user from request", () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: "tenant-123",
          role: Role.User,
        },
      } as unknown as FastifyRequest;

      const user = getUser(mockRequest);
      expect(user).toEqual({
        userId: "user-123",
        email: "test@example.com",
        tenantId: "tenant-123",
        role: Role.User,
      });
    });
  });

  describe("authenticate", () => {
    it("should authenticate valid JWT token and attach user to request", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });

      generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: Role.User,
      });

      const mockRequest = {
        jwtVerify: async () => {},
        user: {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: Role.User,
        },
      } as unknown as FastifyRequest;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => ({ statusCode: code, body: data }),
        }),
      } as unknown as FastifyReply;

      await authenticate(mockRequest, mockReply);

      expect(mockRequest.user).toEqual({
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: Role.User,
      });
    });

    it("should return 401 if JWT verification fails", async () => {
      const mockRequest = {
        jwtVerify: async () => {
          throw new Error("Invalid token");
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

      await authenticate(mockRequest, mockReply);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({ error: "Unauthorized" });
    });

    it("should return 401 if user does not exist in database", async () => {
      const mockRequest = {
        jwtVerify: async () => {},
        user: {
          userId: "non-existent-user-id",
          email: "nonexistent@example.com",
          tenantId: "tenant-123",
          role: Role.User,
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

      await authenticate(mockRequest, mockReply);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({ error: "User not found. Please log out and log back in." });
    });

    it("should update user data from database even if token has stale data", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "original@example.com",
        tenantId: tenant.id,
        role: Role.User,
      });

      // Token has old email, but middleware should fetch fresh data
      const mockRequest = {
        jwtVerify: async () => {},
        user: {
          userId: user.id,
          email: "old-email@example.com", // Stale email
          tenantId: user.tenantId,
          role: Role.User,
        },
      } as unknown as FastifyRequest;

      const mockReply = {
        status: (code: number) => ({
          send: (data: any) => ({ statusCode: code, body: data }),
        }),
      } as unknown as FastifyReply;

      await authenticate(mockRequest, mockReply);

      // Should have fresh data from database
      expect(mockRequest.user).toEqual({
        userId: user.id,
        email: "original@example.com", // Fresh email from DB
        tenantId: user.tenantId,
        role: Role.User,
      });
    });
  });

  describe("requireRole", () => {
    it("should allow access for user with allowed role", async () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: "tenant-123",
          role: Role.CompanyAdministrator,
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

      const middleware = requireRole([Role.CompanyAdministrator, Role.GlobalAdministrator]);
      await middleware(mockRequest, mockReply);

      // Should not call reply.status (no error)
      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
    });

    it("should deny access for user without allowed role", async () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: "tenant-123",
          role: Role.User,
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

      const middleware = requireRole([Role.CompanyAdministrator, Role.GlobalAdministrator]);
      await middleware(mockRequest, mockReply);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({ error: "Forbidden" });
    });

    it("should return 401 if user is not authenticated", async () => {
      const mockRequest = {
        user: undefined,
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

      const middleware = requireRole([Role.CompanyAdministrator]);
      await middleware(mockRequest, mockReply);

      expect(statusCode).toBe(401);
      expect(responseBody).toEqual({ error: "Unauthorized" });
    });

    it("should allow access for multiple allowed roles", async () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: "tenant-123",
          role: Role.GlobalAdministrator,
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

      const middleware = requireRole([Role.CompanyAdministrator, Role.GlobalAdministrator, Role.User]);
      await middleware(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
    });
  });

  describe("requireTenant", () => {
    it("should allow access for user with tenant", async () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: "tenant-123",
          role: Role.User,
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

      await requireTenant(mockRequest, mockReply);

      expect(statusCode).toBeUndefined();
      expect(responseBody).toBeUndefined();
    });

    it("should deny access for user without tenant", async () => {
      const mockRequest = {
        user: {
          userId: "user-123",
          email: "test@example.com",
          tenantId: null,
          role: Role.User,
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

      await requireTenant(mockRequest, mockReply);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({ error: "Tenant required" });
    });

    it("should deny access if user is undefined", async () => {
      const mockRequest = {
        user: undefined,
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

      await requireTenant(mockRequest, mockReply);

      expect(statusCode).toBe(403);
      expect(responseBody).toEqual({ error: "Tenant required" });
    });
  });
});





