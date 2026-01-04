import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import { createTestUser, createTestTenant } from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";

describe("Authentication Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("POST /api/auth/check-user", () => {
    it("should return exists: false, hasPassword: false for non-existent user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/check-user",
        payload: {
          email: "nonexistent@example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        exists: false,
        hasPassword: false,
      });
    });

    it("should return exists: true, hasPassword: false for user without password", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "nopassword@example.com",
        tenantId: tenant.id,
        passwordHash: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/check-user",
        payload: {
          email: user.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        exists: true,
        hasPassword: false,
      });
    });

    it("should return exists: true, hasPassword: true for user with password", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "withpassword@example.com",
        tenantId: tenant.id,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/check-user",
        payload: {
          email: user.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        exists: true,
        hasPassword: true,
      });
    });

    it("should return 400 for missing email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/check-user",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return token and user for valid credentials", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: user.email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe(user.email);
      expect(body.user.id).toBe(user.id);
      expect(typeof body.token).toBe("string");
    });

    it("should return 404 for non-existent user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "nonexistent@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("User not found");
    });

    it("should return 401 for invalid password", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: user.email,
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid password");
    });

    it("should return 400 when user has no password set", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "nopassword@example.com",
        tenantId: tenant.id,
        passwordHash: null,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: user.email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Password not set");
    });

    it("should return 400 when password is missing", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: user.email,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Password required");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "not-an-email",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/magic-link", () => {
    it("should generate magic link for existing user in dev mode", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: user.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("magicLink");
      expect(body).toHaveProperty("token");
      expect(body.userExists).toBe(true);
      expect(body.hasPassword).toBe(true);
      expect(body.magicLink).toContain("magic-link?token=");
    });

    it("should generate magic link for non-existent user in dev mode", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "newuser@example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("magicLink");
      expect(body).toHaveProperty("token");
      expect(body.userExists).toBe(false);
      expect(body.hasPassword).toBe(false);
    });

    it("should return 400 for invalid email format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "not-an-email",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/auth/verify-magic-link", () => {
    it("should verify valid magic link token", async () => {
      // First, generate a magic link
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "test@example.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Then verify it
      const response = await app.inject({
        method: "GET",
        url: `/api/auth/verify-magic-link?token=${token}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("email");
      expect(body).toHaveProperty("token");
      expect(body.email).toBe("test@example.com");
      expect(body.token).toBe(token);
    });

    it("should return 400 for missing token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/verify-magic-link",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      // Fastify schema validation returns a different message
      expect(body.error).toContain("token");
    });

    it("should return 400 for invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/verify-magic-link?token=invalid-token",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid");
    });
  });

  describe("POST /api/auth/set-password", () => {
    it("should set password for new user and return token", async () => {
      // Generate magic link for new user
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "newuser@example.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe("newuser@example.com");
      expect(typeof body.token).toBe("string");
    });

    it("should create tenant with company name derived from domain", async () => {
      // Generate magic link for new user
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "jake@acme.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Check that tenant was created with correct name
      const { db } = await import("@dp/db");
      const tenant = await db.tenant.findUnique({
        where: { id: body.user.tenantId },
      });
      
      expect(tenant).toBeTruthy();
      expect(tenant?.name).toBe("Acme");
      expect(tenant?.emailDomain).toBe("acme.com");
    });

    it("should create tenant with company name from subdomain (first part)", async () => {
      // Generate magic link for new user
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "user@mail.google.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Check that tenant was created with correct name (first part of domain)
      const { db } = await import("@dp/db");
      const tenant = await db.tenant.findUnique({
        where: { id: body.user.tenantId },
      });
      
      expect(tenant).toBeTruthy();
      expect(tenant?.name).toBe("Mail");
      expect(tenant?.emailDomain).toBe("mail.google.com");
    });

    it("should set emailDomain to null when domain conflict exists", async () => {
      // Create first tenant with domain
      const { db } = await import("@dp/db");
      const firstTenant = await db.tenant.create({
        data: {
          id: `tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: "First Company",
          emailDomain: "acme.com",
          updatedAt: new Date(),
        },
      });

      // Generate magic link for new user with same domain
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "jake@acme.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Check that new tenant was created but emailDomain is null due to conflict
      const newTenant = await db.tenant.findUnique({
        where: { id: body.user.tenantId },
      });
      
      expect(newTenant).toBeTruthy();
      expect(newTenant?.id).not.toBe(firstTenant.id);
      expect(newTenant?.emailDomain).toBeNull();
      expect(newTenant?.name).toBe("Acme");
    });

    it("should handle name conflicts by appending suffix", async () => {
      // Create first tenant with name "Acme"
      const { db } = await import("@dp/db");
      await db.tenant.create({
        data: {
          id: `tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: "Acme",
          updatedAt: new Date(),
        },
      });

      // Generate magic link for new user that would create "Acme" tenant
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "jake@acme.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Check that new tenant was created with name "Acme 1" due to conflict
      const newTenant = await db.tenant.findUnique({
        where: { id: body.user.tenantId },
      });
      
      expect(newTenant).toBeTruthy();
      expect(newTenant?.name).toBe("Acme 1");
    });

    it("should update password for existing user and return token", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "existing@example.com",
        tenantId: tenant.id,
      });

      // Generate magic link
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: user.email,
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      // Set new password
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("token");
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe(user.email);

      // Verify new password works
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: user.email,
          password: "newpassword123",
        },
      });

      expect(loginResponse.statusCode).toBe(200);
    });

    it("should return 400 for invalid token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token: "invalid-token",
          password: "newpassword123",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid");
    });

    it("should return 400 for missing password", async () => {
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "test@example.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for password too short", async () => {
      const magicLinkResponse = await app.inject({
        method: "POST",
        url: "/api/auth/magic-link",
        payload: {
          email: "test@example.com",
        },
      });

      const magicLinkBody = JSON.parse(magicLinkResponse.body);
      const token = magicLinkBody.token;

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/set-password",
        payload: {
          token,
          password: "short",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user information with valid token", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe(user.email);
      expect(body.id).toBe(user.id);
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: createAuthHeader("invalid-token"),
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 if user no longer exists", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      // Delete the user
      const { db } = await import("@dp/db");
      await db.user.delete({ where: { id: user.id } });

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: createAuthHeader(token),
      });

      // The authenticate middleware returns 401 when user is not found
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("User not found");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should return success message with valid token", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Logged out");
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});





