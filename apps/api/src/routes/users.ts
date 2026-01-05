import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { updateProfileSchema, createUserSchema } from "@dp/lib";
import { authenticate, requireRole, requireTenant, getUser } from "../middleware/auth";
import { formatUserResponse } from "../utils/user-utils";

interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  profileImageData?: string | null;
  profileImageFileType?: "image/png" | "image/jpeg" | "image/gif" | null;
  profileColor?: string | null;
}

export default async function userRoutes(fastify: FastifyInstance) {
  /**
   * Get current user's profile information
   * Returns user details including name, email, role, and company information
   */
  fastify.get(
    "/profile",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get current authenticated user's profile information including name, email, role, and company details.",
        tags: ["users"],
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
              profileImageData: { type: "string", nullable: true },
              profileImageFileType: { type: "string", nullable: true },
              profileColor: { type: "string", nullable: true },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
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
          profileImageData: (user as any).profileImageData,
          profileImageFileType: (user as any).profileImageFileType,
          profileColor: (user as any).profileColor,
        })
      );
    }
  );

  /**
   * Update current user's profile
   * Users can update their name. Only company admins can update company name.
   */
  fastify.put<{ Body: UpdateProfileBody }>(
    "/profile",
    {
      preHandler: [
        authenticate,
        requireTenant,
        async (request, reply) => {
          const currentUser = getUser(request);
          const user = await db.user.findUnique({
            where: { id: currentUser.userId },
            include: { tenant: true },
          });
          if (!user) {
            return reply.status(404).send({ error: "User not found" });
          }
          // Only company admins can edit company name
          if (
            request.body.companyName &&
            user.role !== "CompanyAdministrator" &&
            user.role !== "GlobalAdministrator"
          ) {
            return reply.status(403).send({ error: "Only company admins can edit company name" });
          }
        },
      ],
      schema: {
        description: "Update current user's profile. Users can update their name. Only CompanyAdministrator or GlobalAdministrator roles can update company name.",
        tags: ["users"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            firstName: {
              type: "string",
              nullable: true,
              description: "User's first name",
            },
            lastName: {
              type: "string",
              nullable: true,
              description: "User's last name",
            },
            companyName: {
              type: "string",
              nullable: true,
              description: "Company name (only editable by company admins)",
            },
            profileImageData: {
              type: "string",
              nullable: true,
              description: "Base64 encoded profile image (256x256)",
            },
            profileImageFileType: {
              type: "string",
              nullable: true,
              enum: ["image/png", "image/jpeg", "image/gif"],
              description: "Profile image mime type",
            },
            profileColor: {
              type: "string",
              nullable: true,
              description: "Hex color code from 16-color palette for avatar background",
            },
          },
        },
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
              profileImageData: { type: "string", nullable: true },
              profileImageFileType: { type: "string", nullable: true },
              profileColor: { type: "string", nullable: true },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Forbidden - insufficient permissions",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "User not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      try {
        request.log.info({ body: request.body }, "Update profile request received");
        
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        let body;
        try {
          body = updateProfileSchema.parse(request.body);
          request.log.info({ body }, "Validation passed");
        } catch (err: unknown) {
          request.log.error({ err: err as Error }, "Validation error");
          const errorMessage = err instanceof Error ? err.message : "Validation error";
          return reply.status(400).send({ error: `Validation error: ${errorMessage}` });
        }

        request.log.info("Fetching user");
        const user = await db.user.findUnique({
          where: { id: getUser(request).userId },
          include: { tenant: true },
        });

        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        request.log.info("Preparing update data");
        // Prepare update data for user fields
        const updateData: {
          firstName?: string | null;
          lastName?: string | null;
          profileImageData?: string | null;
          profileImageFileType?: string | null;
          profileColor?: string | null;
        } = {};
        
        if (body.firstName !== undefined) {
          updateData.firstName = typeof body.firstName === 'string' ? body.firstName.trim() || null : null;
        }
        if (body.lastName !== undefined) {
          updateData.lastName = typeof body.lastName === 'string' ? body.lastName.trim() || null : null;
        }
        
        // Handle profile image data
        if (body.profileImageData !== undefined) {
          // Validate base64 data size (max ~100KB for 256x256 image)
          if (body.profileImageData !== null && body.profileImageData.trim() !== "") {
            // Extract base64 part (remove data:image/...;base64, prefix)
            const base64Match = body.profileImageData.match(/^data:image\/(png|jpeg|gif);base64,(.+)$/);
            if (!base64Match) {
              return reply.status(400).send({ error: "Invalid image data format. Expected data URL with base64 encoded image." });
            }
            const base64Data = base64Match[2];
            const base64Size = base64Data.length * (3 / 4);
            if (base64Size > 100 * 1024) {
              return reply.status(400).send({ error: "Profile image too large (max 100KB)" });
            }
            updateData.profileImageData = body.profileImageData;
            // Ensure file type is set if image data is provided
            if (body.profileImageFileType === undefined && base64Match[1]) {
              updateData.profileImageFileType = `image/${base64Match[1]}` as "image/png" | "image/jpeg" | "image/gif";
            }
          } else {
            // Setting to null or empty string means delete
            updateData.profileImageData = null;
            updateData.profileImageFileType = null;
          }
        }
        
        // profileImageFileType is handled above when profileImageData is set
        if (body.profileImageFileType !== undefined && body.profileImageData === undefined) {
          updateData.profileImageFileType = body.profileImageFileType;
        }
        
        if (body.profileColor !== undefined) {
          updateData.profileColor = body.profileColor;
        }
        
        request.log.info({ updateData }, "Update data");
        
        if (Object.keys(updateData).length > 0) {
          request.log.info("Updating user");
          await db.user.update({
            where: { id: user.id },
            data: updateData,
          });
          request.log.info("User updated");
        }

        // Update company name (only for admins)
        if (body.companyName && user.tenantId) {
          if (
            user.role === "CompanyAdministrator" ||
            user.role === "GlobalAdministrator"
          ) {
            request.log.info("Updating company name");
            await db.tenant.update({
              where: { id: user.tenantId },
              data: { name: body.companyName },
            });
          }
        }

        request.log.info("Fetching updated user");
        const updatedUser = await db.user.findUnique({
          where: { id: user.id },
          include: { tenant: true },
        });

        if (!updatedUser) {
          return reply.status(404).send({ error: "User not found after update" });
        }

        request.log.info("Sending response");
        return reply.send(
          formatUserResponse({
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            name: updatedUser.name,
            role: updatedUser.role,
            tenantId: updatedUser.tenantId,
            companyName: updatedUser.tenant?.name,
            profileImageData: (updatedUser as any).profileImageData,
            profileImageFileType: (updatedUser as any).profileImageFileType,
            profileColor: (updatedUser as any).profileColor,
          })
        );
      } catch (error: any) {
        request.log.error("Error in update profile", error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
    }
  );

  /**
   * Get all users in the current user's company
   * Requires CompanyAdministrator or GlobalAdministrator role
   */
  fastify.get(
    "/company",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Get all users in the current user's company/tenant. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["users"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string", nullable: true },
                firstName: { type: "string", nullable: true },
                lastName: { type: "string", nullable: true },
                role: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Forbidden - requires admin role or tenant",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      const users = await db.user.findMany({
        where: { tenantId: currentUser.tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send(users);
    }
  );

  /**
   * Look up a user by email address
   * Requires CompanyAdministrator or GlobalAdministrator role
   * Returns user details if found, null if not found
   */
  fastify.get<{ Querystring: { email: string } }>(
    "/lookup",
    {
      preHandler: [
        authenticate,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Look up a user by email address. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["users"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address to look up",
            },
          },
        },
        response: {
          200: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string", nullable: true },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              role: { type: "string" },
              tenantId: { type: "string", nullable: true },
            },
            description: "User found, or null if not found",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid email format",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Forbidden - requires admin role",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { email: string } }>, reply: FastifyReply) => {
      const { email } = request.query;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Email is required" });
      }

      const user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          role: true,
          tenantId: true,
        },
      });

      if (!user) {
        return reply.send(null);
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
        })
      );
    }
  );

  /**
   * Create a new user in the current company
   * Requires CompanyAdministrator or GlobalAdministrator role
   * New user will need to set password via magic link
   */
  fastify.post<{ Body: { email: string; firstName: string; lastName: string } }>(
    "/",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Create a new user in the current company/tenant. Requires CompanyAdministrator or GlobalAdministrator role. User will need to set password via magic link.",
        tags: ["users"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["email", "firstName", "lastName"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "User email address (must be unique)",
            },
            firstName: {
              type: "string",
              description: "User's first name",
            },
            lastName: {
              type: "string",
              description: "User's last name",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              name: { type: "string", nullable: true },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              role: { type: "string" },
              tenantId: { type: "string", nullable: true },
              profileImageData: { type: "string", nullable: true },
              profileImageFileType: { type: "string", nullable: true },
              profileColor: { type: "string", nullable: true },
            },
            description: "User created successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "User with this email already exists or validation error",
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Forbidden - requires admin role or tenant",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { email: string; firstName: string; lastName: string } }>, reply: FastifyReply) => {
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      const body = createUserSchema.parse(request.body);

      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: "User with this email already exists" });
      }

      // Create user in same tenant
      const newUser = await db.user.create({
        data: {
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          tenantId: currentUser.tenantId,
          role: "User", // Default role
        },
      });

      return reply.status(201).send(
        formatUserResponse({
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          name: newUser.name,
          role: newUser.role,
          tenantId: newUser.tenantId,
        })
      );
    }
  );
}

