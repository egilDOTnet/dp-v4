import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestProjectMember,
  createTestPhase,
  createTestTask,
  createTestVendor,
  createTestProjectVendor,
} from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { db } from "@dp/db";

describe("Project Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("GET /api/projects", () => {
    it("should return all company projects for CompanyAdministrator", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project1 = await createTestProject({ name: "Project 1", tenantId: tenant.id });
      const project2 = await createTestProject({ name: "Project 2", tenantId: tenant.id });

      // Only add user to project1
      await createTestProjectMember({ projectId: project1.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((p: any) => p.id === project1.id)).toBe(true);
      expect(body.some((p: any) => p.id === project2.id)).toBe(true);
    });

    it("should return only user's projects for regular User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project1 = await createTestProject({ name: "Project 1", tenantId: tenant.id });
      await createTestProject({ name: "Project 2", tenantId: tenant.id });

      // Only add user to project1
      await createTestProjectMember({ projectId: project1.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].id).toBe(project1.id);
    });

    it("should return empty array for admin with no tenant", async () => {
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: null,
        role: "GlobalAdministrator",
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: null,
        role: "GlobalAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should include project members in response", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const member1 = await createTestUser({
        email: "member1@example.com",
        firstName: "Member",
        lastName: "One",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({ name: "Project", tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: member1.id });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].members).toBeDefined();
      expect(Array.isArray(body[0].members)).toBe(true);
      expect(body[0].members.length).toBe(1);
      expect(body[0].members[0].id).toBe(member1.id);
      expect(body[0].members[0].name).toBe("Member One");
    });
  });

  describe("GET /api/projects/:id", () => {
    it("should return project details for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Test Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(project.id);
      expect(body.name).toBe("Test Project");
      expect(body.members).toBeDefined();
      expect(Array.isArray(body.members)).toBe(true);
    });

    it("should return project details for company admin", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const project = await createTestProject({
        name: "Test Project",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(project.id);
      expect(body.name).toBe("Test Project");
    });

    it("should return 403 for user not a project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Test Project",
        tenantId: tenant.id,
      });
      // Don't add user as member

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Access denied - not a project member");
    });

    it("should return 404 for non-existent project", async () => {
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
        url: `/api/projects/non-existent-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Project not found");
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/some-id`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/projects", () => {
    it("should create project with required fields for admin", async () => {
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
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {
          name: "New Project",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("New Project");
      expect(body.tenantId).toBe(tenant.id);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      // Verify project was created in database
      const project = await db.project.findUnique({ where: { id: body.id } });
      expect(project).toBeDefined();
      expect(project?.name).toBe("New Project");
    });

    it("should create project with optional fields", async () => {
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

      const startDate = "2024-01-01";
      const endDate = "2024-12-31";

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {
          name: "New Project",
          type: "Software",
          startDate,
          endDate,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe("New Project");
      expect(body.type).toBe("Software");
      expect(body.startDate).toContain("2024-01-01");
      expect(body.endDate).toContain("2024-12-31");
    });

    it("should automatically initialize phases when creating project", async () => {
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
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {
          name: "New Project",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify phases were created
      const phases = await db.phase.findMany({
        where: { projectId: body.id },
        orderBy: { order: "asc" },
      });

      // Should have 9 default phases
      expect(phases.length).toBeGreaterThanOrEqual(9);
      expect(phases[0].name).toBeDefined();
    });

    it("should add members when memberIds provided", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const member = await createTestUser({
        email: "member@example.com",
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
        method: "POST",
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {
          name: "New Project",
          memberIds: [member.id],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify member was added
      const members = await db.projectMember.findMany({
        where: { projectId: body.id },
      });
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe(member.id);
    });

    it("should return 403 for User role", async () => {
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
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {
          name: "New Project",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 400 for missing name", async () => {
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
        url: "/api/projects",
        headers: createAuthHeader(token),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "New Project",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/projects/:id", () => {
    it("should update project for admin", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const project = await createTestProject({
        name: "Original Name",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
        payload: {
          name: "Updated Name",
          type: "Hardware",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(project.id);
      expect(body.name).toBe("Updated Name");
      expect(body.type).toBe("Hardware");

      // Verify update in database
      const updated = await db.project.findUnique({ where: { id: project.id } });
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.type).toBe("Hardware");
    });

    it("should return 403 for User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 for non-existent project", async () => {
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
        method: "PUT",
        url: `/api/projects/non-existent-id`,
        headers: createAuthHeader(token),
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("should delete project for admin", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const project = await createTestProject({
        name: "Project to Delete",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify project was deleted
      const deleted = await db.project.findUnique({ where: { id: project.id } });
      expect(deleted).toBeNull();
    });

    it("should return 403 for User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 for non-existent project", async () => {
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
        method: "DELETE",
        url: `/api/projects/non-existent-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/members", () => {
    it("should add members to project for admin", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const member1 = await createTestUser({
        email: "member1@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const member2 = await createTestUser({
        email: "member2@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: [member1.id, member2.id],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.members.length).toBe(2);
      expect(body.members.some((m: any) => m.id === member1.id)).toBe(true);
      expect(body.members.some((m: any) => m.id === member2.id)).toBe(true);

      // Verify members were added in database
      const members = await db.projectMember.findMany({
        where: { projectId: project.id },
      });
      expect(members.length).toBe(2);
    });

    it("should not add duplicate members", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const member = await createTestUser({
        email: "member@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: member.id });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: [member.id], // Try to add same member again
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.members.length).toBe(1); // Should still be 1, not 2
      expect(body.members[0].id).toBe(member.id);
    });

    it("should return 400 for invalid member IDs", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: ["non-existent-id"],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 403 for User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
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
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: [user.id],
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/projects/:id/members", () => {
    it("should remove members from project for admin", async () => {
      const tenant = await createTestTenant();
      const admin = await createTestUser({
        email: "admin@example.com",
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });
      const member1 = await createTestUser({
        email: "member1@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const member2 = await createTestUser({
        email: "member2@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: member1.id });
      await createTestProjectMember({ projectId: project.id, userId: member2.id });

      const token = generateTestToken(app, {
        userId: admin.id,
        email: admin.email,
        tenantId: tenant.id,
        role: "CompanyAdministrator",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: [member1.id],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.members.length).toBe(1);
      expect(body.members[0].id).toBe(member2.id);

      // Verify member was removed from database
      const members = await db.projectMember.findMany({
        where: { projectId: project.id },
      });
      expect(members.length).toBe(1);
      expect(members[0].userId).toBe(member2.id);
    });

    it("should return 403 for User role", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/members`,
        headers: createAuthHeader(token),
        payload: {
          memberIds: [user.id],
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/projects/:id/phases", () => {
    it("should return phases for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase1 = await createTestPhase({
        projectId: project.id,
        name: "Phase 1",
        order: 0,
      });
      const phase2 = await createTestPhase({
        projectId: project.id,
        name: "Phase 2",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/phases`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.some((p: any) => p.id === phase1.id)).toBe(true);
      expect(body.some((p: any) => p.id === phase2.id)).toBe(true);
      expect(body[0]).toHaveProperty("status");
      expect(body[0]).toHaveProperty("taskCount");
      expect(body[0]).toHaveProperty("completedTaskCount");
    });

    it("should return 403 for user not a project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
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
        url: `/api/projects/${project.id}/phases`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/projects/:id/phases/:phaseId/tasks", () => {
    it("should return tasks for phase", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const task1 = await createTestTask({
        phaseId: phase.id,
        name: "Task 1",
        order: 1,
      });
      const task2 = await createTestTask({
        phaseId: phase.id,
        name: "Task 2",
        order: 2,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((t: any) => t.id === task1.id)).toBe(true);
      expect(body.some((t: any) => t.id === task2.id)).toBe(true);
      expect(body[0].order).toBeLessThanOrEqual(body[1].order); // Should be ordered
    });

    it("should return 404 for phase not belonging to project", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project1 = await createTestProject({
        name: "Project 1",
        tenantId: tenant.id,
      });
      const project2 = await createTestProject({
        name: "Project 2",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project1.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project2.id, // Phase belongs to project2
        name: "Phase",
        order: 0,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project1.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/phases/:phaseId/tasks", () => {
    it("should create task for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
        payload: {
          name: "New Task",
          description: "Task description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("New Task");
      expect(body.description).toBe("Task description");
      expect(body.phaseId).toBe(phase.id);
      expect(body.order).toBeDefined();

      // Verify task was created in database
      const task = await db.task.findUnique({ where: { id: body.id } });
      expect(task).toBeDefined();
      expect(task?.name).toBe("New Task");
    });

    it("should assign task owner if ownerId provided", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const owner = await createTestUser({
        email: "owner@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
        payload: {
          name: "New Task",
          ownerId: owner.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ownerId).toBe(owner.id);
      expect(body.owner).toBeDefined();
      expect(body.owner.id).toBe(owner.id);
    });

    it("should return 400 for invalid ownerId", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
        payload: {
          name: "New Task",
          ownerId: "non-existent-id",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for missing name", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks`,
        headers: createAuthHeader(token),
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/projects/:id/phases/:phaseId/tasks/:taskId", () => {
    it("should update task for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const task = await createTestTask({
        phaseId: phase.id,
        name: "Original Task",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks/${task.id}`,
        headers: createAuthHeader(token),
        payload: {
          name: "Updated Task",
          description: "Updated description",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(task.id);
      expect(body.name).toBe("Updated Task");
      expect(body.description).toBe("Updated description");

      // Verify update in database
      const updated = await db.task.findUnique({ where: { id: task.id } });
      expect(updated?.name).toBe("Updated Task");
    });

    it("should return 404 for task not in phase", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase1 = await createTestPhase({
        projectId: project.id,
        name: "Phase 1",
        order: 0,
      });
      const phase2 = await createTestPhase({
        projectId: project.id,
        name: "Phase 2",
        order: 1,
      });

      const task = await createTestTask({
        phaseId: phase2.id, // Task belongs to phase2
        name: "Task",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/phases/${phase1.id}/tasks/${task.id}`, // Trying to update via phase1
        headers: createAuthHeader(token),
        payload: {
          name: "Updated Task",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/phases/:phaseId/tasks/:taskId", () => {
    it("should delete task for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const phase = await createTestPhase({
        projectId: project.id,
        name: "Phase",
        order: 0,
      });

      const task = await createTestTask({
        phaseId: phase.id,
        name: "Task to Delete",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/phases/${phase.id}/tasks/${task.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify task was deleted
      const deleted = await db.task.findUnique({ where: { id: task.id } });
      expect(deleted).toBeNull();
    });
  });

  describe("GET /api/projects/:id/dashboard/stats", () => {
    it("should return dashboard stats for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/dashboard/stats`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("vendors");
      expect(body).toHaveProperty("rfi");
      expect(body).toHaveProperty("requirements");
      expect(body.vendors).toHaveProperty("total");
      expect(body.vendors).toHaveProperty("byStatus");
      expect(body.rfi).toHaveProperty("questionCount");
      expect(body.rfi).toHaveProperty("status");
      expect(body.requirements).toHaveProperty("total");
      expect(body.requirements).toHaveProperty("byStatus");
      expect(body.requirements).toHaveProperty("byType");
    });
  });

  describe("GET /api/projects/:id/vendors", () => {
    it("should return vendors for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });

      const project = await createTestProject({
        name: "Project",
        tenantId: tenant.id,
      });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const vendor = await createTestVendor({ name: "Test Vendor", tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
        status: "Pending",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/vendors`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].vendorId).toBe(vendor.id);
      expect(body[0].vendor.name).toBe("Test Vendor");
      expect(body[0].status).toBe("Pending");
    });
  });
});
