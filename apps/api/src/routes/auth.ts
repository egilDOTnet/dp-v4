import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import { db } from "@dp/db";
import { loginSchema, magicLinkSchema, setPasswordSchema } from "@dp/lib";
import { authenticate, getUser } from "../middleware/auth";

interface LoginBody {
  email: string;
  password?: string;
}

interface MagicLinkBody {
  email: string;
}

interface SetPasswordBody {
  token: string;
  password: string;
}

// Store magic links in memory (in production, use Redis or database)
const magicLinks = new Map<string, { email: string; expiresAt: number }>();

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post<{ Body: LoginBody }>(
    "/login",
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const body = loginSchema.parse(request.body);
      const { email, password } = body;

      const user = await db.user.findUnique({
        where: { email },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // If user has no password, they need to use magic link
      if (!user.passwordHash) {
        return reply.status(400).send({
          error: "Password not set. Please use magic link to set your password.",
        });
      }

      if (!password) {
        return reply.status(400).send({ error: "Password required" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: "Invalid password" });
      }

      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyName: user.tenant?.name,
        },
      });
    }
  );

  // Request magic link
  fastify.post<{ Body: MagicLinkBody }>(
    "/magic-link",
    async (request: FastifyRequest<{ Body: MagicLinkBody }>, reply: FastifyReply) => {
      const body = magicLinkSchema.parse(request.body);
      const { email } = body;

      const user = await db.user.findUnique({
        where: { email },
      });

      // In dev mode, we'll create the user if they don't exist
      const isDev = process.env.NODE_ENV === "development";

      if (!user && !isDev) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Generate magic link token
      const token = fastify.jwt.sign({ email, type: "magic-link" } as any, { expiresIn: "1h" });
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

      magicLinks.set(token, { email, expiresAt });

      // In dev mode, return the link in the response
      if (isDev) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const magicLink = `${baseUrl}/magic-link?token=${token}`;
        return reply.send({
          message: "Magic link generated (dev mode)",
          magicLink,
          token,
        });
      }

      // In production, send email here
      return reply.send({ message: "Magic link sent to your email" });
    }
  );

  // Verify magic link and set password
  fastify.get(
    "/verify-magic-link",
    async (request: FastifyRequest<{ Querystring: { token: string } }>, reply: FastifyReply) => {
      const { token } = request.query;

      if (!token) {
        return reply.status(400).send({ error: "Token required" });
      }

      const magicLink = magicLinks.get(token);
      if (!magicLink || magicLink.expiresAt < Date.now()) {
        return reply.status(400).send({ error: "Invalid or expired token" });
      }

      try {
        const decoded = fastify.jwt.verify(token) as { email: string; type: string };
        if (decoded.type !== "magic-link") {
          return reply.status(400).send({ error: "Invalid token type" });
        }

        // Return success - frontend will handle password setup
        return reply.send({
          email: decoded.email,
          token,
        });
      } catch (err) {
        return reply.status(400).send({ error: "Invalid token" });
      }
    }
  );

  // Set password from magic link
  fastify.post<{ Body: SetPasswordBody }>(
    "/set-password",
    async (request: FastifyRequest<{ Body: SetPasswordBody }>, reply: FastifyReply) => {
      const body = setPasswordSchema.parse(request.body);
      const { token, password } = body;

      const magicLink = magicLinks.get(token);
      if (!magicLink || magicLink.expiresAt < Date.now()) {
        return reply.status(400).send({ error: "Invalid or expired token" });
      }

      try {
        const decoded = fastify.jwt.verify(token) as { email: string; type: string };
        if (decoded.type !== "magic-link") {
          return reply.status(400).send({ error: "Invalid token type" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Find or create user
        let user = await db.user.findUnique({
          where: { email: decoded.email },
          include: { tenant: true },
        });

        if (!user) {
          // Create new user with a new tenant
          const tenant = await db.tenant.create({
            data: {
              name: `${decoded.email.split("@")[0]} Company`,
            },
          });

          user = await db.user.create({
            data: {
              email: decoded.email,
              passwordHash,
              tenantId: tenant.id,
              role: "CompanyAdministrator", // First user is company admin
            },
            include: { tenant: true },
          });
        } else {
          // Update existing user
          user = await db.user.update({
            where: { id: user.id },
            data: { passwordHash },
            include: { tenant: true },
          });
        }

        // Clean up magic link
        magicLinks.delete(token);

        // Generate auth token
        const authToken = fastify.jwt.sign({
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        });

        return reply.send({
          token: authToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            companyName: user.tenant?.name,
          },
        });
      } catch (err) {
        return reply.status(400).send({ error: "Invalid token" });
      }
    }
  );

  // Get current user
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        companyName: user.tenant?.name,
      });
    }
  );

  // Logout
  fastify.post(
    "/logout",
    { preHandler: [authenticate] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // In a stateless JWT system, logout is handled client-side
      // In production, you might want to maintain a token blacklist
      return reply.send({ message: "Logged out" });
    }
  );
}

