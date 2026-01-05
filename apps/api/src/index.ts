import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import templateRoutes from "./routes/templates";
import requirementRoutes from "./routes/requirements";
import vendorRoutes from "./routes/vendors";
import rfiRoutes from "./routes/rfi";
import vendorRFIRoutes from "./routes/vendor-rfi";
import vendorRFPRoutes from "./routes/vendor-rfp";
import rfpRoutes from "./routes/rfp";
import notificationRoutes from "./routes/notifications";
import evaluationRoutes from "./routes/evaluation";
import adminRoutes from "./routes/admin";
import companyRoutes from "./routes/company";
import { errorHandler } from "./middleware/error-handler";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";

const fastify = Fastify({
  logger: true,
  bodyLimit: 15 * 1024 * 1024, // 15MB - increased to support base64 image data in company settings
});

// Set error handler
fastify.setErrorHandler(errorHandler);

// Start server
const start = async () => {
  try {
    // Register plugins
    // In development, allow local network access (for testing on mobile devices)
    const isDevelopment = process.env.NODE_ENV !== "production";
    const allowedOrigins = isDevelopment
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          // Allow any .local domain (e.g., egilDOTstudio.local:3000)
          /^http:\/\/.*\.local:\d+$/,
          // Allow local IP addresses (e.g., 192.168.x.x:3000)
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
          /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/,
        ]
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ];

    await fastify.register(cors, {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    });

    // Register Swagger for API documentation
    await fastify.register(swagger, swaggerOptions);
    await fastify.register(swaggerUi, swaggerUiOptions);

    // Health check
    fastify.get("/health", async () => {
      return { status: "ok" };
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: "/api/auth" });
    await fastify.register(userRoutes, { prefix: "/api/users" });
    await fastify.register(projectRoutes, { prefix: "/api/projects" });
    await fastify.register(templateRoutes, { prefix: "/api/templates" });
    await fastify.register(requirementRoutes, { prefix: "/api/projects" });
    await fastify.register(vendorRoutes, { prefix: "/api/vendors" });
    await fastify.register(rfiRoutes, { prefix: "/api/projects" });
    await fastify.register(vendorRFIRoutes, { prefix: "/api" });
    await fastify.register(vendorRFPRoutes, { prefix: "/api" });
    await fastify.register(rfpRoutes, { prefix: "/api/projects" });
    await fastify.register(notificationRoutes, { prefix: "/api/notifications" });
    await fastify.register(evaluationRoutes, { prefix: "/api/projects" });
    await fastify.register(adminRoutes, { prefix: "/api" });
    await fastify.register(companyRoutes, { prefix: "/api/company" });

    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);

    // Start background scheduler for RFI/RFP publishing
    const { startScheduler } = await import("./services/scheduler");
    startScheduler(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

