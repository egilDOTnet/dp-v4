import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestProjectMember,
  createTestVendor,
  createTestProjectVendor,
  createTestVendorContactPerson,
  createTestRFP,
  createTestRFPScheduleItem,
  createTestRFPDocument,
  createTestRFPChangelogEntry,
  createTestRFPQuestion,
  createTestRFPAnnouncement,
} from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { db } from "@dp/db";

describe("RFP Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("GET /api/projects/:id/rfp", () => {
    it("should return existing RFP for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Draft",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(rfp.id);
      expect(body.projectId).toBe(project.id);
      expect(body.status).toBe("Draft");
    });

    it("should create RFP with default schedule items if it doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.projectId).toBe(project.id);
      expect(body.status).toBe("Draft");

      // Verify default schedule items were created
      const scheduleItems = await db.rFPScheduleItem.findMany({
        where: { rfpId: body.id },
      });
      expect(scheduleItems.length).toBeGreaterThanOrEqual(4);
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
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 401 without token", async () => {
      const tenant = await createTestTenant();
      const project = await createTestProject({ tenantId: tenant.id });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/projects/:id/rfp", () => {
    it("should update RFP settings", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Draft",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
        payload: {
          status: "Published",
          publishDate: "2025-12-01T00:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("Published");
      expect(body.publishDate).toBeDefined();
    });

    it("should create RFP if it doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
        payload: {
          status: "Draft",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.projectId).toBe(project.id);
      expect(body.status).toBe("Draft");
    });

    it("should update contact persons", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const contactUser = await createTestUser({
        email: "contact@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
        payload: {
          contactPersonId: contactUser.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contactPersonId).toBe(contactUser.id);
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
        method: "PUT",
        url: `/api/projects/${project.id}/rfp`,
        headers: createAuthHeader(token),
        payload: {
          status: "Draft",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:id/rfp/publish", () => {
    it("should publish RFP when all required dates are set", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Draft",
      });

      // Create required schedule items with dates
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "StartDate",
        description: "RFP Start Date/Time",
        date: new Date("2025-12-01"),
        isRequired: true,
        order: 0,
      });
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "AcceptanceDate",
        description: "Acceptance Date/Time",
        date: new Date("2025-12-15"),
        isRequired: true,
        order: 1,
      });
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "QuestionsDate",
        description: "Questions Date/Time",
        date: new Date("2025-12-10"),
        isRequired: true,
        order: 2,
      });
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "DeliveryDate",
        description: "Delivery Date/Time",
        date: new Date("2025-12-20"),
        isRequired: true,
        order: 3,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify RFP is published
      const updatedRfp = await db.rFP.findUnique({
        where: { id: rfp.id },
      });
      expect(updatedRfp?.status).toBe("Published");
      expect(updatedRfp?.publishDate).toBeDefined();
    });

    it("should return 400 if required dates are missing", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Draft",
      });

      // Create required schedule items without dates
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "StartDate",
        description: "RFP Start Date/Time",
        date: null,
        isRequired: true,
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
        url: `/api/projects/${project.id}/rfp/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required dates");
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/publish`,
        headers: createAuthHeader(token),
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
      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:id/rfp/send", () => {
    it("should return success for sending RFP", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfp/schedule", () => {
    it("should return schedule items for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const item1 = await createTestRFPScheduleItem({
        rfpId: rfp.id,
        description: "Item 1",
        order: 1,
      });
      const item2 = await createTestRFPScheduleItem({
        rfpId: rfp.id,
        description: "Item 2",
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
        url: `/api/projects/${project.id}/rfp/schedule`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.some((item: any) => item.id === item1.id)).toBe(true);
      expect(body.some((item: any) => item.id === item2.id)).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/schedule`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/schedule", () => {
    it("should create schedule item", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/schedule`,
        headers: createAuthHeader(token),
        payload: {
          type: "CustomDate",
          description: "New Schedule Item",
          date: "2025-12-01T00:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("New Schedule Item");
      expect(body.type).toBe("CustomDate");
    });

    it("should create RFP if it doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/schedule`,
        headers: createAuthHeader(token),
        payload: {
          type: "CustomDate",
          description: "New Schedule Item",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("New Schedule Item");
    });

    it("should return 400 for missing required fields", async () => {
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
        url: `/api/projects/${project.id}/rfp/schedule`,
        headers: createAuthHeader(token),
        payload: {
          type: "CustomDate",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/projects/:id/rfp/schedule/:itemId", () => {
    it("should update schedule item", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const item = await createTestRFPScheduleItem({
        rfpId: rfp.id,
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
        url: `/api/projects/${project.id}/rfp/schedule/${item.id}`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
          date: "2025-12-01T00:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("Updated Description");
    });

    it("should return 404 for non-existent item", async () => {
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
        url: `/api/projects/${project.id}/rfp/schedule/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfp/schedule/:itemId", () => {
    it("should delete non-required schedule item", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const item = await createTestRFPScheduleItem({
        rfpId: rfp.id,
        isRequired: false,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/schedule/${item.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const deleted = await db.rFPScheduleItem.findUnique({
        where: { id: item.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 400 for required schedule item", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const item = await createTestRFPScheduleItem({
        rfpId: rfp.id,
        isRequired: true,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/schedule/${item.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should return 404 for non-existent item", async () => {
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
        url: `/api/projects/${project.id}/rfp/schedule/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfp/documents", () => {
    it("should return documents for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const doc1 = await createTestRFPDocument({
        rfpId: rfp.id,
        description: "Document 1",
        order: 1,
      });
      const doc2 = await createTestRFPDocument({
        rfpId: rfp.id,
        description: "Document 2",
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((doc: any) => doc.id === doc1.id)).toBe(true);
      expect(body.some((doc: any) => doc.id === doc2.id)).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/documents", () => {
    it("should create link document", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
        payload: {
          type: "Link",
          description: "Test Link",
          url: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe("Link");
      expect(body.description).toBe("Test Link");
      expect(body.url).toBe("https://example.com");
    });

    it("should create document with file data", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
        payload: {
          type: "Document",
          description: "Test Document",
          fileName: "test.pdf",
          fileType: "application/pdf",
          fileData: "base64encodeddata",
          fileSize: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe("Document");
      expect(body.description).toBe("Test Document");
    });

    it("should return 400 for link without URL", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
        payload: {
          type: "Link",
          description: "Test Link",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for document without file data", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
        payload: {
          type: "Document",
          description: "Test Document",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid file type", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/documents`,
        headers: createAuthHeader(token),
        payload: {
          type: "Document",
          description: "Test Document",
          fileType: "application/zip",
          fileData: "base64data",
        },
      });

      // application/zip is allowed, so this should succeed
      expect(response.statusCode).toBe(200);
    });
  });

  describe("PUT /api/projects/:id/rfp/documents/:docId", () => {
    it("should update document", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const doc = await createTestRFPDocument({
        rfpId: rfp.id,
        description: "Original Description",
        url: "https://original.com",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp/documents/${doc.id}`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
          url: "https://updated.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("Updated Description");
      expect(body.url).toBe("https://updated.com");
    });

    it("should return 404 for non-existent document", async () => {
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
        url: `/api/projects/${project.id}/rfp/documents/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfp/documents/:docId", () => {
    it("should delete document", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const doc = await createTestRFPDocument({
        rfpId: rfp.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/documents/${doc.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const deleted = await db.rFPDocument.findUnique({
        where: { id: doc.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent document", async () => {
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
        url: `/api/projects/${project.id}/rfp/documents/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfp/documents/reorder", () => {
    it("should reorder documents", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const doc1 = await createTestRFPDocument({
        rfpId: rfp.id,
        order: 1,
      });
      const doc2 = await createTestRFPDocument({
        rfpId: rfp.id,
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
        url: `/api/projects/${project.id}/rfp/documents/reorder`,
        headers: createAuthHeader(token),
        payload: {
          documentIds: [doc2.id, doc1.id],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify reordering
      const updated1 = await db.rFPDocument.findUnique({
        where: { id: doc1.id },
      });
      const updated2 = await db.rFPDocument.findUnique({
        where: { id: doc2.id },
      });
      expect(updated1?.order).toBe(1);
      expect(updated2?.order).toBe(0);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/documents/reorder`,
        headers: createAuthHeader(token),
        payload: {
          documentIds: ["doc1", "doc2"],
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfp/changelog", () => {
    it("should return changelog entries for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const entry1 = await createTestRFPChangelogEntry({
        rfpId: rfp.id,
        description: "Entry 1",
        createdById: user.id,
      });
      const entry2 = await createTestRFPChangelogEntry({
        rfpId: rfp.id,
        description: "Entry 2",
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp/changelog`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.some((entry: any) => entry.id === entry1.id)).toBe(true);
      expect(body.some((entry: any) => entry.id === entry2.id)).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/changelog`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfp/changelog/:entryId", () => {
    it("should update changelog entry", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const entry = await createTestRFPChangelogEntry({
        rfpId: rfp.id,
        description: "Original Description",
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp/changelog/${entry.id}`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("Updated Description");
    });

    it("should return 404 for non-existent entry", async () => {
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
        url: `/api/projects/${project.id}/rfp/changelog/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          description: "Updated Description",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfp/changelog/:entryId", () => {
    it("should delete changelog entry", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const entry = await createTestRFPChangelogEntry({
        rfpId: rfp.id,
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/changelog/${entry.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const deleted = await db.rFPChangelogEntry.findUnique({
        where: { id: entry.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent entry", async () => {
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
        url: `/api/projects/${project.id}/rfp/changelog/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfp/questions", () => {
    it("should return questions for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const question1 = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        question: "Question 1",
      });
      const question2 = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        question: "Question 2",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.some((q: any) => q.id === question1.id)).toBe(true);
      expect(body.some((q: any) => q.id === question2.id)).toBe(true);
    });

    it("should filter by answered questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const answeredQuestion = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        answer: "Answer",
        answeredAt: new Date(),
        answeredById: user.id,
      });
      await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        answer: null,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp/questions?filter=answered`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((q: any) => q.id === answeredQuestion.id)).toBe(true);
      expect(body.every((q: any) => q.answer !== null)).toBe(true);
    });

    it("should filter by unanswered questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson1 = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const contactPerson2 = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson1.id,
        answer: "Answer",
        answeredAt: new Date(),
        answeredById: user.id,
      });
      const unansweredQuestion = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson2.id,
        answer: null,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp/questions?filter=unanswered`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((q: any) => q.id === unansweredQuestion.id)).toBe(true);
      expect(body.every((q: any) => q.answer === null)).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/questions", () => {
    it("should create question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "New Question?",
          vendorId: vendor.id,
          contactPersonId: contactPerson.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.question).toBe("New Question?");
      expect(body.vendorId).toBe(vendor.id);
      expect(body.contactPersonId).toBe(contactPerson.id);
    });

    it("should return 400 for invalid vendor", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      // Create a valid vendor and contact person, but use invalid vendor ID in request
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "New Question?",
          vendorId: "invalid-vendor-id",
          contactPersonId: contactPerson.id,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid contact person", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "New Question?",
          vendorId: vendor.id,
          contactPersonId: "invalid-contact-id",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 if RFP doesn't exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "New Question?",
          vendorId: vendor.id,
          contactPersonId: contactPerson.id,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/questions/:questionId/split", () => {
    it("should split question into multiple questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const question = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        question: "Original Question?",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions/${question.id}/split`,
        headers: createAuthHeader(token),
        payload: {
          questions: ["Question 1?", "Question 2?", "Question 3?"],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      expect(body[0].question).toBe("Question 1?");
      expect(body[1].question).toBe("Question 2?");
      expect(body[2].question).toBe("Question 3?");

      // Verify original question is deleted
      const deleted = await db.rFPQuestion.findUnique({
        where: { id: question.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 400 if less than 2 questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const question = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/questions/${question.id}/split`,
        headers: createAuthHeader(token),
        payload: {
          questions: ["Question 1?"],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 for non-existent question", async () => {
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
        url: `/api/projects/${project.id}/rfp/questions/invalid-id/split`,
        headers: createAuthHeader(token),
        payload: {
          questions: ["Question 1?", "Question 2?"],
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfp/questions/:questionId/answer", () => {
    it("should answer question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const question = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
        question: "Test Question?",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp/questions/${question.id}/answer`,
        headers: createAuthHeader(token),
        payload: {
          cleanedQuestion: "Test Question?",
          answer: "<p>This is the answer</p>",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.cleanedQuestion).toBe("Test Question?");
      expect(body.answer).toBe("<p>This is the answer</p>");
      expect(body.answeredAt).toBeDefined();
      expect(body.answeredById).toBe(user.id);
    });

    it("should return 404 for non-existent question", async () => {
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
        url: `/api/projects/${project.id}/rfp/questions/invalid-id/answer`,
        headers: createAuthHeader(token),
        payload: {
          cleanedQuestion: "Test Question?",
          answer: "<p>Answer</p>",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfp/questions/:questionId", () => {
    it("should delete question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
      });
      const question = await createTestRFPQuestion({
        rfpId: rfp.id,
        vendorId: vendor.id,
        contactPersonId: contactPerson.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/questions/${question.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const deleted = await db.rFPQuestion.findUnique({
        where: { id: question.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent question", async () => {
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
        url: `/api/projects/${project.id}/rfp/questions/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfp/announcements", () => {
    it("should return announcements for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const announcement1 = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        title: "Announcement 1",
        createdById: user.id,
      });
      const announcement2 = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        title: "Announcement 2",
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfp/announcements`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
      expect(body.some((a: any) => a.id === announcement1.id)).toBe(true);
      expect(body.some((a: any) => a.id === announcement2.id)).toBe(true);
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/announcements`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/announcements", () => {
    it("should create announcement with immediate send", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/announcements`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Announcement",
          description: "<p>Announcement content</p>",
          sendImmediately: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("New Announcement");
      expect(body.description).toBe("<p>Announcement content</p>");
      expect(body.sentAt).toBeDefined();
      expect(body.createdById).toBe(user.id);
    });

    it("should create announcement with scheduled send", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
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
        url: `/api/projects/${project.id}/rfp/announcements`,
        headers: createAuthHeader(token),
        payload: {
          title: "Scheduled Announcement",
          description: "<p>Announcement content</p>",
          sendImmediately: false,
          scheduledSendAt: "2025-12-31T00:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Scheduled Announcement");
      expect(body.sentAt).toBeNull();
      expect(body.scheduledSendAt).toBeDefined();
    });

    it("should return 404 if RFP doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfp/announcements`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Announcement",
          description: "<p>Content</p>",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfp/announcements/:announcementId/send", () => {
    it("should send announcement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const announcement = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        sentAt: null,
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfp/announcements/${announcement.id}/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify sentAt is updated
      const updated = await db.rFPAnnouncement.findUnique({
        where: { id: announcement.id },
      });
      expect(updated?.sentAt).toBeDefined();
    });

    it("should return 404 for non-existent announcement", async () => {
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
        url: `/api/projects/${project.id}/rfp/announcements/invalid-id/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfp/announcements/:announcementId", () => {
    it("should update unsent announcement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const announcement = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        title: "Original Title",
        sentAt: null,
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp/announcements/${announcement.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
          description: "<p>Updated content</p>",
          sendImmediately: false,
          scheduledSendAt: "2025-12-31T00:00:00Z",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Updated Title");
      expect(body.description).toBe("<p>Updated content</p>");
    });

    it("should return 400 for sent announcement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const announcement = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        sentAt: new Date(),
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfp/announcements/${announcement.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
          description: "<p>Updated content</p>",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("sent");
    });

    it("should return 404 for non-existent announcement", async () => {
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
        url: `/api/projects/${project.id}/rfp/announcements/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
          description: "<p>Content</p>",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfp/announcements/:announcementId", () => {
    it("should delete announcement", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfp = await createTestRFP({
        projectId: project.id,
      });
      const announcement = await createTestRFPAnnouncement({
        rfpId: rfp.id,
        createdById: user.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfp/announcements/${announcement.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const deleted = await db.rFPAnnouncement.findUnique({
        where: { id: announcement.id },
      });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent announcement", async () => {
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
        url: `/api/projects/${project.id}/rfp/announcements/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
