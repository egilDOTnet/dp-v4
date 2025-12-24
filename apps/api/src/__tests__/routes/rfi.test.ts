import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, generateTestToken, createAuthHeader } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestProjectMember,
  createTestVendor,
  createTestProjectVendor,
  createTestRFI,
  createTestRFIQuestion,
  createTestRFIQuestionOption,
  createTestRFIVendorResponse,
} from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { db } from "@dp/db";

describe("RFI Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("GET /api/projects/:id/rfi", () => {
    it("should return existing RFI for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({
        projectId: project.id,
        emailSubject: "Test RFI Subject",
        emailText: "Test RFI Email Text",
        rfiInformation: "Test RFI Information",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(rfi.id);
      expect(body.projectId).toBe(project.id);
      expect(body.emailSubject).toBe("Test RFI Subject");
      expect(body.emailText).toBe("Test RFI Email Text");
      expect(body.rfiInformation).toBe("Test RFI Information");
      expect(Array.isArray(body.questions)).toBe(true);
    });

    it("should create RFI with default templates if it doesn't exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ 
        tenantId: tenant.id,
        name: "Test Project",
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
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.projectId).toBe(project.id);
      expect(body.emailSubject).toContain("Test Project");
      expect(Array.isArray(body.questions)).toBe(true);
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
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 401 without token", async () => {
      const tenant = await createTestTenant();
      const project = await createTestProject({ tenantId: tenant.id });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi`,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return RFI with questions and options", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Test Question",
        type: "MultipleChoice",
        order: 1,
      });
      const option1 = await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Option 1",
        order: 1,
      });
      const option2 = await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Option 2",
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
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.questions.length).toBe(1);
      expect(body.questions[0].id).toBe(question.id);
      expect(body.questions[0].title).toBe("Test Question");
      expect(body.questions[0].options.length).toBe(2);
      expect(body.questions[0].options.some((o: any) => o.id === option1.id)).toBe(true);
      expect(body.questions[0].options.some((o: any) => o.id === option2.id)).toBe(true);
    });
  });

  describe("PUT /api/projects/:id/rfi", () => {
    it("should update RFI settings", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        emailSubject: "Original Subject",
        emailText: "Original Text",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          emailSubject: "Updated Subject",
          emailText: "Updated Text",
          rfiInformation: "Updated Information",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeDefined();
      expect(body.emailSubject).toBe("Updated Subject");
      expect(body.emailText).toBe("Updated Text");
      expect(body.rfiInformation).toBe("Updated Information");
    });

    it("should create RFI if it doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          emailSubject: "New Subject",
          emailText: "New Text",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeDefined();
      expect(body.projectId).toBe(project.id);
      expect(body.emailSubject).toBe("New Subject");
      expect(body.emailText).toBe("New Text");
    });

    it("should update deadline and autoPublishDate", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const deadline = "2025-12-31";
      const autoPublishDate = "2025-12-01";

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          deadline,
          autoPublishDate,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeDefined();
      expect(body.deadline).toBeDefined();
      expect(body.autoPublishDate).toBeDefined();
    });

    it("should return 400 if autoPublishDate is after deadline", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          deadline: "2025-12-01",
          autoPublishDate: "2025-12-31",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
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
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          emailSubject: "Test Subject",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow setting deadline and autoPublishDate to null", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const deadline = new Date("2025-12-31");
      await createTestRFI({
        projectId: project.id,
        deadline,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi`,
        headers: createAuthHeader(token),
        payload: {
          deadline: null,
          autoPublishDate: null,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeDefined();
      expect(body.deadline).toBeNull();
      expect(body.autoPublishDate).toBeNull();
    });
  });

  describe("POST /api/projects/:id/rfi/publish", () => {
    it("should publish RFI when deadline is set and at least 1 question exists", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const deadline = new Date("2025-12-31");
      const rfi = await createTestRFI({
        projectId: project.id,
        deadline,
        isPublished: false,
      });

      // Create at least 1 question (required for publishing)
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Test Question",
        type: "SingleText",
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
        url: `/api/projects/${project.id}/rfi/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify RFI is published
      const updatedRfi = await db.rFI.findUnique({
        where: { id: rfi.id },
      });
      expect(updatedRfi?.isPublished).toBe(true);
      expect(updatedRfi?.publishedAt).toBeDefined();
    });

    it("should return 400 if no questions exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const deadline = new Date("2025-12-31");
      await createTestRFI({
        projectId: project.id,
        deadline,
        isPublished: false,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("question");
    });

    it("should return 400 if deadline is not set", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        deadline: null,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Deadline");
    });

    it("should return 404 if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/publish`,
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
      const deadline = new Date("2025-12-31");
      await createTestRFI({
        projectId: project.id,
        deadline,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/publish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:id/rfi/unpublish", () => {
    it("should unpublish RFI", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const publishedAt = new Date();
      const rfi = await createTestRFI({
        projectId: project.id,
        isPublished: true,
        publishedAt,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/unpublish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify RFI is unpublished
      const updatedRfi = await db.rFI.findUnique({
        where: { id: rfi.id },
      });
      expect(updatedRfi?.isPublished).toBe(false);
      expect(updatedRfi?.unpublishedAt).toBeDefined();
    });

    it("should return 404 if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/unpublish`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("RFI not found");
    });
  });

  describe("GET /api/projects/:id/rfi/questions", () => {
    it("should return questions for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question1 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Question 1",
        order: 1,
      });
      const question2 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Question 2",
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
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body.some((q: any) => q.id === question1.id)).toBe(true);
      expect(body.some((q: any) => q.id === question2.id)).toBe(true);
    });

    it("should return empty array if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return questions ordered by order field", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question2 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Second",
        order: 2,
      });
      const question1 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "First",
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
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body[0].id).toBe(question1.id);
      expect(body[1].id).toBe(question2.id);
    });
  });

  describe("POST /api/projects/:id/rfi/questions", () => {
    it("should create question for RFI", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Question",
          description: "Question description",
          type: "SingleText",
          required: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("New Question");
      expect(body.description).toBe("Question description");
      expect(body.type).toBe("SingleText");
      expect(body.required).toBe(true);
      expect(body.order).toBe(1);
    });

    it("should create RFI if it doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Question",
          type: "SingleText",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("New Question");
    });

    it("should auto-generate order based on existing questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "First",
        order: 1,
      });
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Second",
        order: 2,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
        payload: {
          title: "Third",
          type: "SingleText",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.order).toBe(3);
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
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
        payload: {
          description: "Missing title and type",
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

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/questions`,
        headers: createAuthHeader(token),
        payload: {
          title: "New Question",
          type: "SingleText",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/projects/:id/rfi/questions/:questionId", () => {
    it("should update question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Original Title",
        description: "Original Description",
        type: "SingleText",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
          description: "Updated Description",
          type: "MultipleChoice",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe("Updated Title");
      expect(body.description).toBe("Updated Description");
      expect(body.type).toBe("MultipleChoice");
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
        url: `/api/projects/${project.id}/rfi/questions/invalid-id`,
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
      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}`,
        headers: createAuthHeader(token),
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/projects/:id/rfi/questions/:questionId", () => {
    it("should delete question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const deleted = await db.rFIQuestion.findUnique({
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
        url: `/api/projects/${project.id}/rfi/questions/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfi/questions/reorder", () => {
    it("should reorder questions", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question1 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "First",
        order: 1,
      });
      const question2 = await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Second",
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
        url: `/api/projects/${project.id}/rfi/questions/reorder`,
        headers: createAuthHeader(token),
        payload: {
          questionIds: [question2.id, question1.id],
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify reordering
      const updated1 = await db.rFIQuestion.findUnique({
        where: { id: question1.id },
      });
      const updated2 = await db.rFIQuestion.findUnique({
        where: { id: question2.id },
      });
      expect(updated1?.order).toBe(2);
      expect(updated2?.order).toBe(1);
    });

    it("should return 400 for invalid question IDs", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi/questions/reorder`,
        headers: createAuthHeader(token),
        payload: {
          questionIds: ["invalid-id"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid question IDs");
    });
  });

  describe("POST /api/projects/:id/rfi/questions/:questionId/options", () => {
    it("should create option for question", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        type: "MultipleChoice",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options`,
        headers: createAuthHeader(token),
        payload: {
          label: "Option 1",
          value: "option1",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.label).toBe("Option 1");
      expect(body.value).toBe("option1");
      expect(body.order).toBe(1);
    });

    it("should auto-generate order based on existing options", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        type: "MultipleChoice",
      });
      await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Option 1",
        order: 1,
      });
      await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Option 2",
        order: 2,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options`,
        headers: createAuthHeader(token),
        payload: {
          label: "Option 3",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.order).toBe(3);
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
        url: `/api/projects/${project.id}/rfi/questions/invalid-id/options`,
        headers: createAuthHeader(token),
        payload: {
          label: "Option 1",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /api/projects/:id/rfi/questions/:questionId/options/:optionId", () => {
    it("should update option", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        type: "MultipleChoice",
      });
      const option = await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Original Label",
        value: "original",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options/${option.id}`,
        headers: createAuthHeader(token),
        payload: {
          label: "Updated Label",
          value: "updated",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.label).toBe("Updated Label");
      expect(body.value).toBe("updated");
    });

    it("should return 404 for non-existent option", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "PUT",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options/invalid-id`,
        headers: createAuthHeader(token),
        payload: {
          label: "Updated Label",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id/rfi/questions/:questionId/options/:optionId", () => {
    it("should delete option", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        type: "MultipleChoice",
      });
      const option = await createTestRFIQuestionOption({
        questionId: question.id,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options/${option.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(204);

      // Verify deletion
      const deleted = await db.rFIQuestionOption.findUnique({
        where: { id: option.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("PUT /api/projects/:id/rfi/questions/:questionId/options/reorder", () => {
    it("should reorder options", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const question = await createTestRFIQuestion({
        rfiId: rfi.id,
        type: "MultipleChoice",
      });
      const option1 = await createTestRFIQuestionOption({
        questionId: question.id,
        label: "First",
        order: 1,
      });
      const option2 = await createTestRFIQuestionOption({
        questionId: question.id,
        label: "Second",
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
        url: `/api/projects/${project.id}/rfi/questions/${question.id}/options/reorder`,
        headers: createAuthHeader(token),
        payload: {
          optionIds: [option2.id, option1.id],
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify reordering
      const updated1 = await db.rFIQuestionOption.findUnique({
        where: { id: option1.id },
      });
      const updated2 = await db.rFIQuestionOption.findUnique({
        where: { id: option2.id },
      });
      expect(updated1?.order).toBe(2);
      expect(updated2?.order).toBe(1);
    });
  });

  describe("GET /api/projects/:id/rfi/vendor-responses", () => {
    it("should return vendor responses for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const vendor = await createTestVendor({
        tenantId: tenant.id,
        name: "Test Vendor",
      });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });
      // Create a contact person for the vendor
      const contactPerson = await db.vendorContactPerson.create({
        data: {
          vendorId: vendor.id,
          firstName: "Test",
          lastName: "Contact",
          email: "contact@test.com",
          isMainContact: true,
        },
      });
      const vendorResponse = await createTestRFIVendorResponse({
        rfiId: rfi.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Sent",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi/vendor-responses`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body.some((vr: any) => vr.id === vendorResponse.id)).toBe(true);
    });

    it("should return empty array if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/vendor-responses`,
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
        url: `/api/projects/${project.id}/rfi/vendor-responses`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/projects/:id/rfi/vendor-responses/:vendorResponseId", () => {
    it("should return single vendor response for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      const vendor = await createTestVendor({
        tenantId: tenant.id,
      });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });
      // Create a contact person for the vendor
      const contactPerson = await db.vendorContactPerson.create({
        data: {
          vendorId: vendor.id,
          firstName: "Test",
          lastName: "Contact",
          email: "contact@test.com",
          isMainContact: true,
        },
      });
      const vendorResponse = await createTestRFIVendorResponse({
        rfiId: rfi.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Sent",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi/vendor-responses/${vendorResponse.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(vendorResponse.id);
      expect(body.status).toBe("Sent");
    });

    it("should return 404 for non-existent vendor response", async () => {
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
        url: `/api/projects/${project.id}/rfi/vendor-responses/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/projects/:id/rfi/send", () => {
    it("should return 400 if RFI is not published", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        isPublished: false,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("published");
    });

    it("should return 404 if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 400 if no vendors in project", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        isPublished: true,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/send`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("vendor");
    });
  });

  describe("POST /api/projects/:id/rfi/resend/:vendorId", () => {
    it("should return 400 if RFI is not published", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        isPublished: false,
      });
      const vendor = await createTestVendor({
        tenantId: tenant.id,
      });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
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
        url: `/api/projects/${project.id}/rfi/resend/${projectVendor.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 if vendor not found in project", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({
        projectId: project.id,
        isPublished: true,
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/resend/invalid-id`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/projects/:id/rfi/preview", () => {
    it("should return RFI preview for project member", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({
        projectId: project.id,
        emailSubject: "Preview Subject",
        emailText: "Preview Text",
        rfiInformation: "Preview Information",
      });
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Preview Question",
        type: "SingleText",
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi/preview`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.emailSubject).toBe("Preview Subject");
      expect(body.emailText).toBe("Preview Text");
      expect(body.rfiInformation).toBe("Preview Information");
      expect(Array.isArray(body.questions)).toBe(true);
    });

    it("should return 404 if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/preview`,
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
      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${project.id}/rfi/preview`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/projects/:id/rfi/preview-token", () => {
    it("should generate preview token when at least 1 question exists", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      const rfi = await createTestRFI({ projectId: project.id });
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Test Question",
        type: "SingleText",
        order: 1,
      });

      // Create vendor with contact for preview token generation
      const vendor = await createTestVendor({
        tenantId: tenant.id,
        name: "Test Vendor",
      });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });
      await db.vendorContactPerson.create({
        data: {
          vendorId: vendor.id,
          firstName: "Test",
          lastName: "Contact",
          email: "contact@test.com",
          isMainContact: true,
        },
      });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/preview-token`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe("string");
    });

    it("should return 400 if no questions exist", async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({
        email: "user@example.com",
        tenantId: tenant.id,
        role: "User",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectMember({ projectId: project.id, userId: user.id });

      await createTestRFI({ projectId: project.id });

      const token = generateTestToken(app, {
        userId: user.id,
        email: user.email,
        tenantId: tenant.id,
        role: "User",
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/rfi/preview-token`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("question");
    });

    it("should return 404 if RFI doesn't exist", async () => {
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
        url: `/api/projects/${project.id}/rfi/preview-token`,
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
      const rfi = await createTestRFI({ projectId: project.id });
      await createTestRFIQuestion({
        rfiId: rfi.id,
        title: "Test Question",
        type: "SingleText",
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
        url: `/api/projects/${project.id}/rfi/preview-token`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

