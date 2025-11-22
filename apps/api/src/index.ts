import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import projectRoutes from "./routes/projects";
import templateRoutes from "./routes/templates";
import { errorHandler } from "./middleware/error-handler";

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
      origin: process.env.NEXT_PUBLIC_API_URL
        ? [process.env.NEXT_PUBLIC_API_URL, "http://localhost:3000"]
        : ["http://localhost:3000"],
      credentials: true,
    });

    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    });

    // Health check
    fastify.get("/health", async () => {
      return { status: "ok" };
    });

    // Register routes
    await fastify.register(authRoutes, { prefix: "/api/auth" });
    await fastify.register(userRoutes, { prefix: "/api/users" });
    await fastify.register(projectRoutes, { prefix: "/api/projects" });
    await fastify.register(templateRoutes, { prefix: "/api/templates" });

    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

