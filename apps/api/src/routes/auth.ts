import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import { db } from "@dp/db";
import { loginSchema, magicLinkSchema, setPasswordSchema } from "@dp/lib";
import { authenticate, getUser } from "../middleware/auth";
import { formatUserResponse } from "../utils/user-utils";

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

// Helper function to derive name from email
// Example: "john.moltz@example.com" -> { firstName: "John", lastName: "Moltz", name: "John Moltz" }
// Example: "john@example.com" -> { firstName: "John", lastName: null, name: "John" }
function deriveNameFromEmail(email: string): { firstName: string; lastName: string | null; name: string } {
  const localPart = email.split("@")[0];
  
  // If there's a dot, split into first and last name
  const dotIndex = localPart.indexOf(".");
  if (dotIndex !== -1) {
    const firstName = localPart.substring(0, dotIndex);
    const lastName = localPart.substring(dotIndex + 1);
    
    // Capitalize first letter of each part
    const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    const capitalizedLastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
    
    return {
      firstName: capitalizedFirstName,
      lastName: capitalizedLastName,
      name: `${capitalizedFirstName} ${capitalizedLastName}`,
    };
  }
  
  // No dot, just capitalize the first letter
  const capitalized = localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
  return {
    firstName: capitalized,
    lastName: null,
    name: capitalized,
  };
}

// Store magic links in memory (in production, use Redis or database)
const magicLinks = new Map<string, { email: string; expiresAt: number }>();

export default async function authRoutes(fastify: FastifyInstance) {
  /**
   * Check if a user exists and has a password set
   * Used to determine if user should use password login or magic link
   */
  fastify.post<{ Body: { email: string } }>(
    "/check-user",
    {
      schema: {
        description: "Check if a user exists and has a password set. Used to determine authentication method.",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              exists: {
                type: "boolean",
                description: "Whether the user exists in the system",
              },
              hasPassword: {
                type: "boolean",
                description: "Whether the user has a password set",
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      const { email } = request.body;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Email required" });
      }

      const user = await db.user.findUnique({
        where: { email },
      });

      return reply.send({
        exists: !!user,
        hasPassword: !!user?.passwordHash,
      });
    }
  );

  /**
   * Authenticate user with email and password
   * Returns JWT token and user information
   */
  fastify.post<{ Body: LoginBody }>(
    "/login",
    {
      schema: {
        description: "Authenticate user with email and password. Returns JWT token for subsequent API requests.",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            password: {
              type: "string",
              description: "User password (required if user has password set)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "JWT authentication token",
              },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string", nullable: true },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  role: { type: "string" },
                  tenantId: { type: "string", nullable: true },
                  companyName: { type: "string", nullable: true },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Password not set or password required",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid password",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "User not found",
          },
        },
      },
    },
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
        user: formatUserResponse({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyName: user.tenant?.name,
        }),
      });
    }
  );

  /**
   * Request a magic link for passwordless authentication
   * In development mode, returns the link directly. In production, sends email.
   */
  fastify.post<{ Body: MagicLinkBody }>(
    "/magic-link",
    {
      schema: {
        description: "Request a magic link for passwordless authentication. In dev mode, returns link in response. In production, sends email.",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              magicLink: { type: "string", nullable: true, description: "Only in development mode" },
              token: { type: "string", nullable: true, description: "Only in development mode" },
              userExists: { type: "boolean", nullable: true, description: "Only in development mode" },
              hasPassword: { type: "boolean", nullable: true, description: "Only in development mode" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "User not found (production mode only)",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: MagicLinkBody }>, reply: FastifyReply) => {
      try {
        const body = magicLinkSchema.parse(request.body);
        const { email } = body;

        const user = await db.user.findUnique({
          where: { email },
        });

        // Check if we're in production mode (explicit check)
        // Default to dev mode if NODE_ENV is not set or is "development"
        const isProduction = process.env.NODE_ENV === "production";
        const isDev = !isProduction;

        // Debug logging
        if (!user) {
          fastify.log.info(`Magic link requested for non-existent user: ${email}, NODE_ENV: ${process.env.NODE_ENV || "undefined"}, isDev: ${isDev}`);
        }

        // In production, only allow magic link for existing users
        // In dev mode, always allow magic link generation (for both existing and new users)
        if (!user && isProduction) {
          return reply.status(404).send({ error: "User not found" });
        }

        // Generate magic link token
        const token = fastify.jwt.sign({ email, type: "magic-link" } as any, { expiresIn: "1h" });
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

        magicLinks.set(token, { email, expiresAt });

        // In dev mode, always return the link in the response and log to console
        if (isDev) {
          const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
          const magicLink = `${baseUrl}/magic-link?token=${token}`;
          
          // Log to console in dev mode (server-side console)
          console.log(`\n🔗 Magic Link for ${email}:`);
          console.log(magicLink);
          console.log(`\nToken: ${token}\n`);
          
          return reply.send({
            message: user ? "Magic link generated (dev mode)" : "Magic link generated for new user (dev mode)",
            magicLink,
            token,
            userExists: !!user,
            hasPassword: !!user?.passwordHash,
          });
        }

        // In production, send email here
        return reply.send({ message: "Magic link sent to your email" });
      } catch (err) {
        // In dev mode, still try to generate magic link even if there's an error
        const isProduction = process.env.NODE_ENV === "production";
        const isDev = !isProduction;
        if (isDev && request.body && (request.body as any).email) {
          const email = (request.body as any).email;
          const token = fastify.jwt.sign({ email, type: "magic-link" } as any, { expiresIn: "1h" });
          const expiresAt = Date.now() + 60 * 60 * 1000;
          magicLinks.set(token, { email, expiresAt });
          
          const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
          const magicLink = `${baseUrl}/magic-link?token=${token}`;
          
          console.log(`\n🔗 Magic Link for ${email} (error recovery):`);
          console.log(magicLink);
          
          return reply.send({
            message: "Magic link generated (dev mode)",
            magicLink,
            token,
            userExists: false,
            hasPassword: false,
          });
        }
        throw err;
      }
    }
  );

  /**
   * Verify magic link token validity
   * Returns email and token if valid, used before password setup
   */
  fastify.get(
    "/verify-magic-link",
    {
      schema: {
        description: "Verify that a magic link token is valid and not expired. Returns email for password setup.",
        tags: ["auth"],
        querystring: {
          type: "object",
          required: ["token"],
          properties: {
            token: {
              type: "string",
              description: "Magic link token from email or dev response",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              email: { type: "string" },
              token: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid or expired token",
          },
        },
      },
    },
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
      } catch {
        return reply.status(400).send({ error: "Invalid token" });
      }
    }
  );

  /**
   * Set password using magic link token
   * Creates new user if doesn't exist, or updates existing user's password
   * Returns JWT token for immediate authentication
   */
  fastify.post<{ Body: SetPasswordBody }>(
    "/set-password",
    {
      schema: {
        description: "Set or update user password using magic link token. Creates new user if email doesn't exist. Returns JWT token.",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: {
              type: "string",
              description: "Magic link token from /api/auth/verify-magic-link",
            },
            password: {
              type: "string",
              minLength: 8,
              description: "New password (minimum 8 characters)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "JWT authentication token",
              },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string", nullable: true },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  role: { type: "string" },
                  tenantId: { type: "string", nullable: true },
                  companyName: { type: "string", nullable: true },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid or expired token",
          },
        },
      },
    },
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
          } as any);

          // Derive name from email
          const nameData = deriveNameFromEmail(decoded.email);

          user = await db.user.create({
            data: {
              email: decoded.email,
              name: nameData.name,
              firstName: nameData.firstName,
              lastName: nameData.lastName,
              passwordHash,
              tenantId: tenant.id,
              role: "CompanyAdministrator", // First user is company admin
            } as any,
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
        if (!user) {
          return reply.status(400).send({ error: "Invalid token" });
        }
        const authToken = fastify.jwt.sign({
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        });

        if (!user) {
          return reply.status(400).send({ error: "Invalid token" });
        }

        return reply.send({
          token: authToken,
          user: formatUserResponse({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            companyName: user.tenant?.name,
          }),
        });
      } catch {
        return reply.status(400).send({ error: "Invalid token" });
      }
    }
  );

  /**
   * Get current authenticated user information
   * Requires valid JWT token
   */
  fastify.get(
    "/me",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get current authenticated user's information. Requires valid JWT token.",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string", nullable: true },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              role: { type: "string" },
              tenantId: { type: "string", nullable: true },
              companyName: { type: "string", nullable: true },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized - invalid or missing token",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "User not found",
          },
        },
      },
    },
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

      return reply.send(
        formatUserResponse({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          companyName: user.tenant?.name,
        })
      );
    }
  );

  /**
   * Logout current user
   * In stateless JWT system, logout is handled client-side
   * This endpoint exists for consistency and future token blacklist support
   */
  fastify.post(
    "/logout",
    {
      preHandler: [authenticate],
      schema: {
        description: "Logout current user. In stateless JWT system, logout is primarily client-side. Token blacklist may be implemented in production.",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized - invalid or missing token",
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // In a stateless JWT system, logout is handled client-side
      // In production, you might want to maintain a token blacklist
      return reply.send({ message: "Logged out" });
    }
  );
}

