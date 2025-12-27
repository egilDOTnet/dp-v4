import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestProjectMember,
  createTestRequirementHierarchy,
  createTestRequirement,
} from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { db } from "@dp/db";

describe("Requirements Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("GET /api/projects/:projectId/requirements/hierarchies", () => {
    it("should return hierarchies for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy1 = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Hierarchy 1",
        number: "1.",
        order: 1,
      });
      const hierarchy2 = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Hierarchy 2",
        number: "2.",
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
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((h: any) => h.id === hierarchy1.id)).toBe(true);
      expect(body.some((h: any) => h.id === hierarchy2.id)).toBe(true);
    });

    it("should return empty array when no hierarchies exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return 403 for non-project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return hierarchies with parent and children relationships", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const parentHierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Parent",
        number: "1.",
        order: 1,
      });
      const childHierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        parentId: parentHierarchy.id,
        title: "Child",
        number: "1.1.",
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
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const parent = body.find((h: any) => h.id === parentHierarchy.id);
      expect(parent).toBeDefined();
      expect(parent.children).toBeDefined();
      expect(parent.children.length).toBe(1);
      expect(parent.children[0].id).toBe(childHierarchy.id);
    });
  });

  describe("POST /api/projects/:projectId/requirements/hierarchies", () => {
    it("should create level 1 hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Hierarchy",
          description: "Test description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body || "{}");
      expect(body).toBeDefined();
      expect(body.title).toBe("New Hierarchy");
      expect(body.description).toBe("Test description");
      expect(body.parentId).toBeNull();
      expect(body.number).toBe("1.");
      expect(body.order).toBe(1);
    });

    it("should create level 2 hierarchy with parent", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const parentHierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Parent",
        number: "1.",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
        payload: {
          title: "Child Hierarchy",
          parentId: parentHierarchy.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Child Hierarchy");
      expect(body.parentId).toBe(parentHierarchy.id);
      expect(body.number).toMatch(/^1\.\d+\.$/);
    });

    it("should return 400 for invalid parent hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Hierarchy",
          parentId: "invalid-id",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 when trying to create level 3 hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const level1 = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Level 1",
        number: "1.",
        order: 1,
      });
      const level2 = await createTestRequirementHierarchy({
        projectId: project.id,
        parentId: level1.id,
        title: "Level 2",
        number: "1.1.",
        order: 1,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
        payload: {
          title: "Level 3",
          parentId: level2.id,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Maximum hierarchy depth");
    });

    it("should return 403 for non-project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements/hierarchies`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Hierarchy",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/hierarchies/:id", () => {
    it("should update hierarchy title and description", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Original Title",
        description: "Original Description",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/hierarchies/${hierarchy.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Updated Title");
      expect(body.description).toBe("Updated Description");
    });

    it("should return 404 for non-existent hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/hierarchies/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for non-project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/hierarchies/${hierarchy.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/projects/:projectId/requirements/hierarchies/:id", () => {
    it("should delete empty hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/hierarchies/${hierarchy.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const deleted = await db.requirementHierarchy.findUnique({
        where: { id: hierarchy.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 400 when hierarchy has requirements", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/hierarchies/${hierarchy.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot delete hierarchy with requirements");
    });

    it("should return 400 when hierarchy has children", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const parentHierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      await createTestRequirementHierarchy({
        projectId: project.id,
        parentId: parentHierarchy.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/hierarchies/${parentHierarchy.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot delete hierarchy with requirements or child hierarchies");
    });

    it("should return 404 for non-existent hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/hierarchies/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/hierarchies/reorder", () => {
    it("should reorder level 1 hierarchies", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy1 = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "First",
        number: "1.",
        order: 1,
      });
      const hierarchy2 = await createTestRequirementHierarchy({
        projectId: project.id,
        title: "Second",
        number: "2.",
        order: 2,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/hierarchies/reorder`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyIds: [hierarchy2.id, hierarchy1.id],
          parentId: null,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify reordering
      const updated1 = await db.requirementHierarchy.findUnique({
        where: { id: hierarchy1.id },
      });
      const updated2 = await db.requirementHierarchy.findUnique({
        where: { id: hierarchy2.id },
      });
      expect(updated1?.order).toBe(2);
      expect(updated2?.order).toBe(1);
      expect(updated2?.number).toBe("1.");
      expect(updated1?.number).toBe("2.");
    });

    it("should return 400 for invalid hierarchy IDs", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/hierarchies/reorder`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyIds: ["invalid-id"],
          parentId: null,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/projects/:projectId/requirements", () => {
    it("should return requirements for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement1 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "Requirement 1",
        createdById: user.id,
        lastModifiedById: user.id,
      });
      const requirement2 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "Requirement 2",
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((r: any) => r.id === requirement1.id)).toBe(true);
      expect(body.some((r: any) => r.id === requirement2.id)).toBe(true);
    });

    it("should return empty array when no requirements exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return 403 for non-project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:projectId/requirements", () => {
    it("should create requirement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: hierarchy.id,
          description: "New Requirement",
          type: "Mandatory",
          status: "New",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("New Requirement");
      expect(body.type).toBe("Mandatory");
      expect(body.status).toBe("New");
      expect(body.hierarchyId).toBe(hierarchy.id);
      expect(body.createdById).toBe(user.id);
      expect(body.lastModifiedById).toBe(user.id);
    });

    it("should create requirement with auto-generated number", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "1.",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: hierarchy.id,
          description: "New Requirement",
          type: "Information",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.number).toMatch(/^1\.\d+\.$/);
    });

    it("should return 400 for invalid hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: "invalid-id",
          description: "New Requirement",
          type: "Information",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 403 for non-project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/requirements`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: hierarchy.id,
          description: "New Requirement",
          type: "Information",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/:id", () => {
    it("should update requirement description, type, and status", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "Original Description",
        type: "Information",
        status: null,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/${requirement.id}`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
          type: "Mandatory",
          status: "New",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("Updated Description");
      expect(body.type).toBe("Mandatory");
      expect(body.status).toBe("New");
      expect(body.lastModifiedById).toBe(user.id);
    });

    it("should prevent changing status from set value to null", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "Test Requirement",
        type: "Information",
        status: "New",
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/${requirement.id}`,
        headers: createAuthHeader(token),
        payload: {
          status: null,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot change status from a set value back to blank");
    });

    it("should return 404 for non-existent requirement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:projectId/requirements/:id", () => {
    it("should delete requirement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/${requirement.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const deleted = await db.requirement.findUnique({
        where: { id: requirement.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent requirement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/:id/move", () => {
    it("should move requirement to different hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy1 = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "1.",
      });
      const hierarchy2 = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "2.",
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy1.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/${requirement.id}/move`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: hierarchy2.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.hierarchyId).toBe(hierarchy2.id);
      expect(body.number).toMatch(/^2\.\d+\.$/);
    });

    it("should return 400 for invalid target hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/${requirement.id}/move`,
        headers: createAuthHeader(token),
        payload: {
          hierarchyId: "invalid-id",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/reorder", () => {
    it("should reorder requirements within hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "1.",
      });
      const requirement1 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "First",
        order: 1,
        number: "1.1.",
        createdById: user.id,
        lastModifiedById: user.id,
      });
      const requirement2 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        description: "Second",
        order: 2,
        number: "1.2.",
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/reorder`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: [requirement2.id, requirement1.id],
          hierarchyId: hierarchy.id,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify reordering
      const updated1 = await db.requirement.findUnique({
        where: { id: requirement1.id },
      });
      const updated2 = await db.requirement.findUnique({
        where: { id: requirement2.id },
      });
      expect(updated1?.order).toBe(2);
      expect(updated2?.order).toBe(1);
    });

    it("should return 400 for invalid hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/reorder`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: ["req-id"],
          hierarchyId: "invalid-id",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/projects/:projectId/requirements/:id/history", () => {
    it("should return requirement history", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      // Create history entry manually
      await db.requirementHistory.create({
        data: {
          requirementId: requirement.id,
          description: requirement.description,
          type: requirement.type,
          status: requirement.status,
          modifiedById: user.id,
        },
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements/${requirement.id}/history`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].requirementId).toBe(requirement.id);
      expect(body[0].modifiedBy).toBeDefined();
    });

    it("should return empty array when no history exists", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements/${requirement.id}/history`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return 404 for non-existent requirement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/requirements/invalid-id/history`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:projectId/requirements/bulk-update", () => {
    it("should bulk update requirement type and status", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement1 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        type: "Information",
        status: null,
        createdById: user.id,
        lastModifiedById: user.id,
      });
      const requirement2 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        type: "Information",
        status: null,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/bulk-update`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: [requirement1.id, requirement2.id],
          type: "Mandatory",
          status: "New",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.every((r: any) => r.type === "Mandatory")).toBe(true);
      expect(body.every((r: any) => r.status === "New")).toBe(true);
    });

    it("should bulk move requirements to different hierarchy", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy1 = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "1.",
      });
      const hierarchy2 = await createTestRequirementHierarchy({
        projectId: project.id,
        number: "2.",
      });
      const requirement1 = await createTestRequirement({
        hierarchyId: hierarchy1.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });
      const requirement2 = await createTestRequirement({
        hierarchyId: hierarchy1.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/bulk-update`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: [requirement1.id, requirement2.id],
          hierarchyId: hierarchy2.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(2);
      expect(body.every((r: any) => r.hierarchyId === hierarchy2.id)).toBe(true);
    });

    it("should return 400 for invalid requirement IDs", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/requirements/bulk-update`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: ["invalid-id"],
          type: "Mandatory",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/projects/:projectId/requirements/bulk-delete", () => {
    it("should bulk delete requirements", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const hierarchy = await createTestRequirementHierarchy({
        projectId: project.id,
      });
      const requirement1 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });
      const requirement2 = await createTestRequirement({
        hierarchyId: hierarchy.id,
        createdById: user.id,
        lastModifiedById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/bulk-delete`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: [requirement1.id, requirement2.id],
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const deleted1 = await db.requirement.findUnique({
        where: { id: requirement1.id },
      });
      const deleted2 = await db.requirement.findUnique({
        where: { id: requirement2.id },
      });
      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();
    });

    it("should return 400 for invalid requirement IDs", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/requirements/bulk-delete`,
        headers: createAuthHeader(token),
        payload: {
          requirementIds: ["invalid-id"],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});




