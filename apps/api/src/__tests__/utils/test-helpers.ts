import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import authRoutes from "../../routes/auth";
import userRoutes from "../../routes/users";
import projectRoutes from "../../routes/projects";
import templateRoutes from "../../routes/templates";
import requirementRoutes from "../../routes/requirements";
import vendorRoutes from "../../routes/vendors";
import rfiRoutes from "../../routes/rfi";
import vendorRFIRoutes from "../../routes/vendor-rfi";
import rfpRoutes from "../../routes/rfp";
import vendorRFPRoutes from "../../routes/vendor-rfp";
import notificationRoutes from "../../routes/notifications";
import { errorHandler } from "../../middleware/error-handler";
import { JWTPayload, Role } from "@dp/lib";

/**
 * Create a test Fastify instance with all routes registered
 * This mimics the production app setup but optimized for testing
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Set error handler
  app.setErrorHandler(errorHandler);

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "test-jwt-secret-key-for-testing-only",
  });

  // Register routes (same as production)
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(projectRoutes, { prefix: "/api/projects" });
  await app.register(templateRoutes, { prefix: "/api/templates" });
  await app.register(requirementRoutes, { prefix: "/api/projects" });
  await app.register(vendorRoutes, { prefix: "/api/vendors" });
  await app.register(rfiRoutes, { prefix: "/api/projects" });
  await app.register(vendorRFIRoutes, { prefix: "/api" });
  await app.register(rfpRoutes, { prefix: "/api/projects" });
  await app.register(vendorRFPRoutes, { prefix: "/api" });
  await app.register(notificationRoutes, { prefix: "/api/notifications" });

  return app;
}

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(
  app: FastifyInstance,
  payload: Partial<JWTPayload> & { userId: string; email: string }
): string {
  const fullPayload: JWTPayload = {
    userId: payload.userId,
    email: payload.email,
    tenantId: payload.tenantId ?? null,
    role: (payload.role as Role) ?? Role.User,
  };

  return app.jwt.sign(fullPayload);
}

/**
 * Create an authenticated request header
 */
export function createAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Test data factories
 */
export const testData = {
  user: {
    email: (index = 0) => `test-user-${index}@example.com`,
    firstName: (index = 0) => `Test${index}`,
    lastName: (index = 0) => `User${index}`,
    name: (index = 0) => `Test${index} User${index}`,
  },
  tenant: {
    name: (index = 0) => `Test Company ${index}`,
  },
  project: {
    name: (index = 0) => `Test Project ${index}`,
  },
};



