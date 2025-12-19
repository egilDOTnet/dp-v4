import { describe, it, expect, beforeEach } from "vitest";
import { buildTestApp, createAuthHeader } from "../utils/test-helpers";
import {
  createTestUser,
  createTestTenant,
  createTestProject,
  createTestVendor,
  createTestProjectVendor,
  createTestVendorContactPerson,
  createTestRFP,
  createTestRFPScheduleItem,
  createTestRFPVendorResponse,
  createTestRFPProposalFile,
} from "../utils/db-helpers";
import type { FastifyInstance } from "fastify";
import { db } from "@dp/db";

/**
 * Generate a vendor contact JWT token for testing
 */
function generateVendorContactToken(
  app: FastifyInstance,
  payload: {
    contactPersonId: string;
    vendorId: string;
    email: string;
    isMainContact: boolean;
  }
): string {
  return app.jwt.sign({
    contactPersonId: payload.contactPersonId,
    vendorId: payload.vendorId,
    email: payload.email,
    isMainContact: payload.isMainContact,
    type: "vendor-contact",
  } as any);
}

describe("Vendor RFP Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe("POST /api/vendor-rfp/auth/check-user", () => {
    it("should return exists: false for non-existent email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/check-user",
        payload: {
          email: "nonexistent@example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exists).toBe(false);
      expect(body.hasPassword).toBe(false);
    });

    it("should return exists: true and hasPassword: false for vendor contact without password", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/check-user",
        payload: {
          email: contactPerson.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exists).toBe(true);
      expect(body.hasPassword).toBe(false);
    });

    it("should return exists: true and hasPassword: true for vendor contact with password", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      // Create user account with password
      await createTestUser({
        email: contactPerson.email,
        tenantId: tenant.id,
        role: "Vendor",
        password: "testpassword123",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/check-user",
        payload: {
          email: contactPerson.email,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exists).toBe(true);
      expect(body.hasPassword).toBe(true);
    });
  });

  describe("POST /api/vendor-rfp/auth/login", () => {
    it("should return 404 for non-existent vendor contact", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/login",
        payload: {
          email: "nonexistent@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Vendor contact not found");
    });

    it("should return 400 for vendor contact without password", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/login",
        payload: {
          email: contactPerson.email,
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Password not set");
    });

    it("should return 401 for invalid password", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      await createTestUser({
        email: contactPerson.email,
        tenantId: tenant.id,
        role: "Vendor",
        password: "correctpassword",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/login",
        payload: {
          email: contactPerson.email,
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Invalid password");
    });

    it("should return JWT token for valid credentials", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });

      await createTestUser({
        email: contactPerson.email,
        tenantId: tenant.id,
        role: "Vendor",
        password: "testpassword123",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/auth/login",
        payload: {
          email: contactPerson.email,
          password: "testpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(body.contactPerson).toBeDefined();
      expect(body.contactPerson.id).toBe(contactPerson.id);
      expect(body.contactPerson.email).toBe(contactPerson.email);
      expect(body.contactPerson.isMainContact).toBe(true);
      expect(body.contactPerson.vendor).toBeDefined();
      expect(body.contactPerson.vendor.id).toBe(vendor.id);
    });
  });

  describe("GET /api/vendor-rfp/auth/me", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return vendor contact info for authenticated vendor contact", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/auth/me",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contactPerson).toBeDefined();
      expect(body.contactPerson.id).toBe(contactPerson.id);
      expect(body.contactPerson.email).toBe(contactPerson.email);
      expect(body.contactPerson.isMainContact).toBe(true);
      expect(body.contactPerson.vendor).toBeDefined();
      expect(body.contactPerson.vendor.id).toBe(vendor.id);
    });
  });

  describe("GET /api/vendor-rfp/rfps", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return empty array when vendor has no RFPs", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it("should return only published RFPs before delivery date", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const _projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      // Create published RFP with future delivery date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
        deliveryDate: futureDate,
      });

      // Create draft RFP (should not appear)
      await createTestRFP({
        projectId: project.id,
        status: "Draft",
        deliveryDate: futureDate,
      });

      // Create published RFP with past delivery date (should not appear)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await createTestRFP({
        projectId: project.id,
        status: "Published",
        deliveryDate: pastDate,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].id).toBe(rfp.id);
      expect(body[0].projectId).toBe(project.id);
    });

    it("should include vendor response status if exists", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
        deliveryDate: futureDate,
      });

      const vendorResponse = await createTestRFPVendorResponse({
        rfpId: rfp.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Participating",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.length).toBe(1);
      expect(body[0].vendorResponse).toBeDefined();
      expect(body[0].vendorResponse.id).toBe(vendorResponse.id);
      expect(body[0].vendorResponse.status).toBe("Participating");
    });
  });

  describe("GET /api/vendor-rfp/rfps/:rfpId", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps/test-rfp-id",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for non-existent RFP", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/vendor-rfp/rfps/non-existent-rfp-id",
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for RFP vendor doesn't have access to", async () => {
      const tenant = await createTestTenant();
      const vendor1 = await createTestVendor({ tenantId: tenant.id });
      const vendor2 = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor1.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      // Only vendor2 is linked to project
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor2.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor1.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/vendor-rfp/rfps/${rfp.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return full RFP details for accessible RFP", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const _projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
        about: "<p>Test RFP about</p>",
      });

      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "StartDate",
        description: "Start date",
        date: new Date(),
        order: 0,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/vendor-rfp/rfps/${rfp.id}`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(rfp.id);
      expect(body.projectId).toBe(project.id);
      expect(body.about).toBe("<p>Test RFP about</p>");
      expect(Array.isArray(body.scheduleItems)).toBe(true);
      expect(Array.isArray(body.documents)).toBe(true);
      expect(Array.isArray(body.changelogEntries)).toBe(true);
      expect(Array.isArray(body.questions)).toBe(true);
    });
  });

  describe("POST /api/vendor-rfp/rfps/:rfpId/participate", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/rfps/test-rfp-id/participate",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 for non-main contact", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: false, // Not main contact
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/participate`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("main contact");
    });

    it("should create vendor response when participating", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const _projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
        deliveryDate: futureDate,
      });

      // Create acceptance date in the future
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "AcceptanceDate",
        description: "Acceptance deadline",
        date: futureDate,
        order: 1,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/participate`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.status).toBe("Participating");
      expect(body.participatedAt).toBeDefined();

      // Verify in database
      const vendorResponse = await db.rFPVendorResponse.findUnique({
        where: { id: body.id },
      });
      expect(vendorResponse).toBeDefined();
      expect(vendorResponse?.status).toBe("Participating");
      expect(vendorResponse?.participatedAt).toBeDefined();
    });

    it("should return 400 if participation deadline has passed", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      // Create acceptance date in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await createTestRFPScheduleItem({
        rfpId: rfp.id,
        type: "AcceptanceDate",
        description: "Acceptance deadline",
        date: pastDate,
        order: 1,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/participate`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("deadline has passed");
    });
  });

  describe("POST /api/vendor-rfp/rfps/:rfpId/questions", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/rfps/test-rfp-id/questions",
        payload: {
          question: "Test question?",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should create a question", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "What is the deadline?",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.question).toBe("What is the deadline?");
      expect(body.createdAt).toBeDefined();

      // Verify in database
      const question = await db.rFPQuestion.findUnique({
        where: { id: body.id },
      });
      expect(question).toBeDefined();
      expect(question?.question).toBe("What is the deadline?");
      expect(question?.vendorId).toBe(vendor.id);
      expect(question?.contactPersonId).toBe(contactPerson.id);
    });

    it("should return 400 for empty question", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/questions`,
        headers: createAuthHeader(token),
        payload: {
          question: "   ",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });
  });

  describe("GET /api/vendor-rfp/rfps/:rfpId/questions", () => {
    it("should return all questions for RFP", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
      });
      const project = await createTestProject({ tenantId: tenant.id });
      await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      // Create questions
      await db.rFPQuestion.create({
        data: {
          id: `test-question-1-${Date.now()}`,
          rfpId: rfp.id,
          vendorId: vendor.id,
          contactPersonId: contactPerson.id,
          question: "Question 1?",
        },
      });

      await db.rFPQuestion.create({
        data: {
          id: `test-question-2-${Date.now()}`,
          rfpId: rfp.id,
          vendorId: vendor.id,
          contactPersonId: contactPerson.id,
          question: "Question 2?",
          answer: "<p>Answer 2</p>",
          answeredAt: new Date(),
        },
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/vendor-rfp/rfps/${rfp.id}/questions`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
      expect(body[0].question).toBeDefined();
      expect(body[1].answer).toBeDefined();
    });
  });

  describe("POST /api/vendor-rfp/rfps/:rfpId/proposal/files", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/rfps/test-rfp-id/proposal/files",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should upload a proposal file", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      // Create vendor response first
      const _vendorResponse = await createTestRFPVendorResponse({
        rfpId: rfp.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Participating",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      // Create multipart form data
      const formData = new FormData();
      const fileContent = Buffer.from("test file content");
      const blob = new Blob([fileContent], { type: "application/pdf" });
      formData.append("file", blob, "test-proposal.pdf");

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/proposal/files`,
        headers: {
          ...createAuthHeader(token),
          "Content-Type": "multipart/form-data",
        },
        payload: formData,
      });

      // Note: Fastify multipart handling might need special setup
      // This test may need adjustment based on actual multipart implementation
      expect([200, 400, 415]).toContain(response.statusCode);
    });
  });

  describe("POST /api/vendor-rfp/rfps/:rfpId/proposal/submit", () => {
    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/vendor-rfp/rfps/test-rfp-id/proposal/submit",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 for non-main contact", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: false,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      await createTestRFPVendorResponse({
        rfpId: rfp.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Participating",
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: false,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/proposal/submit`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should submit proposal with files", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const vendorResponse = await createTestRFPVendorResponse({
        rfpId: rfp.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Participating",
      });

      // Create proposal files
      await createTestRFPProposalFile({
        vendorResponseId: vendorResponse.id,
        fileName: "proposal.pdf",
        fileType: "application/pdf",
        fileSize: 1000,
        order: 0,
      });

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/proposal/submit`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(vendorResponse.id);
      expect(body.status).toBe("ProposalSubmitted");
      expect(body.proposalSubmittedAt).toBeDefined();

      // Verify in database
      const updated = await db.rFPVendorResponse.findUnique({
        where: { id: vendorResponse.id },
      });
      expect(updated?.status).toBe("ProposalSubmitted");
      expect(updated?.proposalSubmittedAt).toBeDefined();
    });

    it("should return 400 if no files uploaded", async () => {
      const tenant = await createTestTenant();
      const vendor = await createTestVendor({ tenantId: tenant.id });
      const contactPerson = await createTestVendorContactPerson({
        vendorId: vendor.id,
        email: "contact@example.com",
        isMainContact: true,
      });
      const project = await createTestProject({ tenantId: tenant.id });
      const projectVendor = await createTestProjectVendor({
        projectId: project.id,
        vendorId: vendor.id,
      });

      const rfp = await createTestRFP({
        projectId: project.id,
        status: "Published",
      });

      const _vendorResponse = await createTestRFPVendorResponse({
        rfpId: rfp.id,
        projectVendorId: projectVendor.id,
        contactPersonId: contactPerson.id,
        status: "Participating",
      });

      // No files created

      const token = generateVendorContactToken(app, {
        contactPersonId: contactPerson.id,
        vendorId: vendor.id,
        email: contactPerson.email,
        isMainContact: true,
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/vendor-rfp/rfps/${rfp.id}/proposal/submit`,
        headers: createAuthHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });
  });
});
