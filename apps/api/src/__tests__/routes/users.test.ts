import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import { createTestUser, createTestTenant } from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";

describe("User Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("GET /api/users/profile", () => {
    it("should return current user's profile with valid token", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(user.id);
      expect(body.email).toBe(user.email);
      expect(body.firstName).toBe("John");
      expect(body.lastName).toBe("Doe");
      expect(body.name).toBe("John Doe");
      expect(body.role).toBe("User");
      expect(body.tenantId).toBe(tenant.id);
      expect(body.companyName).toBe(tenant.name);
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/profile",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/profile",
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
        url: "/api/users/profile",
        headers: createAuthHeader(token),
      });

      // The authenticate middleware returns 401 when user is not found
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("User not found");
    });

    it("should return user profile with null name fields", async () => {
      const tenant = await createTestTenant();
      // Create user using helper to ensure tenant exists
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const user = await createTestUser({
        email: `test-${uniqueSuffix}@example.com`,
        firstName: null,
        lastName: null,
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBeNull();
      expect(body.lastName).toBeNull();
      expect(body.name).toBeNull();
    });
  });

  describe("PUT /api/users/profile", () => {
    it("should update user's firstName and lastName", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "Jane",
          lastName: "Smith",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBe("Jane");
      expect(body.lastName).toBe("Smith");
      expect(body.name).toBe("Jane Smith");

      // Verify in database
      const { db } = await import("@dp/db");
      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.firstName).toBe("Jane");
      expect(updatedUser?.lastName).toBe("Smith");
    });

    it("should update only firstName when lastName is not provided", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "Jane",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBe("Jane");
      expect(body.lastName).toBe("Doe"); // Unchanged
    });

    it("should allow CompanyAdministrator to update company name", async () => {
      const tenant = await createTestTenant({ name: "Old Company Name" });
      const user = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          companyName: "New Company Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.companyName).toBe("New Company Name");

      // Verify in database
      const { db } = await import("@dp/db");
      const updatedTenant = await db.tenant.findUnique({
        where: { id: tenant.id },
      });
      expect(updatedTenant?.name).toBe("New Company Name");
    });

    it("should allow GlobalAdministrator to update company name", async () => {
      const tenant = await createTestTenant({ name: "Old Company Name" });
      const user = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          companyName: "New Company Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.companyName).toBe("New Company Name");
    });

    it("should return 403 when non-admin tries to update company name", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          companyName: "New Company Name",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Only company admins can edit company name");
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        payload: {
          firstName: "Jane",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 if user not found", async () => {
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
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "Jane",
        },
      });

      // The authenticate middleware returns 401 when user is not found
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("User not found");
    });

    it("should trim whitespace from firstName and lastName", async () => {
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
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "  Jane  ",
          lastName: "  Smith  ",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBe("Jane");
      expect(body.lastName).toBe("Smith");
    });

    it("should convert empty strings to null", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "",
          lastName: "",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.firstName).toBeNull();
      expect(body.lastName).toBeNull();
    });

    it("should return 403 when user has no tenant", async () => {
      // Create user directly without tenant
      const { db } = await import("@dp/db");
      const uniqueId = randomUUID();
      const user = await db.user.create({
        data: {
          email: `test-${uniqueId}@example.com`,
          firstName: "Test",
          lastName: "User",
          role: "User",
          tenantId: null,
        },
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: null,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: "/api/users/profile",
        headers: createAuthHeader(token),
        payload: {
          firstName: "Jane",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Tenant required");
    });
  });

  describe("GET /api/users/company", () => {
    it("should return all users in company for CompanyAdministrator", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const user1 = await createTestUser({
        email: "user1@example.com",
        firstName: "User",
        lastName: "One",
        tenantId: tenant.id,
        role: "User",
      });
      const user2 = await createTestUser({
        email: "user2@example.com",
        firstName: "User",
        lastName: "Two",
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(3);
      
      // Should include all users from the tenant
      const emails = body.map((u: any) => u.email);
      expect(emails).toContain(admin.email);
      expect(emails).toContain(user1.email);
      expect(emails).toContain(user2.email);
      
      // Check structure
      const firstUser = body[0];
      expect(firstUser).toHaveProperty("id");
      expect(firstUser).toHaveProperty("email");
      expect(firstUser).toHaveProperty("firstName");
      expect(firstUser).toHaveProperty("lastName");
      expect(firstUser).toHaveProperty("role");
      expect(firstUser).toHaveProperty("createdAt");
    });

    it("should return all users in company for GlobalAdministrator", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });

    it("should return 403 for regular User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Forbidden");
    });

    it("should return 403 when user has no tenant", async () => {
      // Create user directly without tenant
      const { db } = await import("@dp/db");
      const uniqueId = randomUUID();
      const user = await db.user.create({
        data: {
          email: `admin-${uniqueId}@example.com`,
          firstName: "Admin",
          lastName: "User",
          role: "CompanyAdministrator",
          tenantId: null,
        },
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: null,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Tenant required");
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should not return users from other tenants", async () => {
      const tenant1 = await createTestTenant();
      const tenant2 = await createTestTenant();
      
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant1.id,
        role: "CompanyAdministrator",
      });
      
      // Create users in different tenants
      await createTestUser({
        email: "user1@example.com",
        tenantId: tenant1.id,
      });
      await createTestUser({
        email: "user2@example.com",
        tenantId: tenant2.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant1.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/users/company",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const emails = body.map((u: any) => u.email);
      expect(emails).toContain("admin@example.com");
      expect(emails).toContain("user1@example.com");
      expect(emails).not.toContain("user2@example.com");
    });
  });

  describe("POST /api/users", () => {
    it("should create new user as CompanyAdministrator", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "newuser@example.com",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.email).toBe("newuser@example.com");
      expect(body.firstName).toBe("New");
      expect(body.lastName).toBe("User");
      expect(body.name).toBe("New User"); // Computed display name
      expect(body.role).toBe("User"); // Default role
      expect(body.tenantId).toBe(tenant.id);

      // Verify in database
      const { db } = await import("@dp/db");
      const createdUser = await db.user.findUnique({
        where: { email: "newuser@example.com" },
      });
      expect(createdUser).toBeTruthy();
      expect(createdUser?.tenantId).toBe(tenant.id);
      expect(createdUser?.role).toBe("User");
    });

    it("should create new user as GlobalAdministrator", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "GlobalAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "newuser@example.com",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.email).toBe("newuser@example.com");
    });

    it("should return 400 for duplicate email", async () => {
      const tenant = await createTestTenant();
      const existingUser = await createTestUser({
        email: "existing@example.com",
        tenantId: tenant.id,
      });

      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: existingUser.email,
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("User with this email already exists");
    });

    it("should return 403 for regular User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "newuser@example.com",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 when user has no tenant", async () => {
      // Create user directly without tenant
      const { db } = await import("@dp/db");
      const uniqueId = randomUUID();
      const user = await db.user.create({
        data: {
          email: `admin-${uniqueId}@example.com`,
          firstName: "Admin",
          lastName: "User",
          role: "CompanyAdministrator",
          tenantId: null,
        },
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: null,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "newuser@example.com",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Tenant required");
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        payload: {
          email: "newuser@example.com",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 400 for missing required fields", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "newuser@example.com",
          // Missing firstName and lastName
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid email format", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: createAuthHeader(token),
        payload: {
          email: "not-an-email",
          firstName: "New",
          lastName: "User",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});



