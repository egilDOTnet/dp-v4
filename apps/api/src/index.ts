import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
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
import rfpRoutes from "./routes/rfp";
import notificationRoutes from "./routes/notifications";
import { errorHandler } from "./middleware/error-handler";
import { swaggerOptions, swaggerUiOptions } from "./config/swagger";

const fastify = Fastify({
  logger: true,
});

// Set error handler
fastify.setErrorHandler(errorHandler);

// Start server
const start = async () => {
  try {
    // Register plugins
    await fastify.register(cors, {
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
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
    await fastify.register(rfpRoutes, { prefix: "/api/projects" });
    await fastify.register(notificationRoutes, { prefix: "/api/notifications" });

    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

