import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser, requireGlobalAdmin } from "../middleware/auth";
import { Role } from "@prisma/client";

export default async function adminRoutes(fastify: FastifyInstance) {
  /**
   * Get reference check template (Global Admin Only)
   */
  fastify.get(
    "/admin/reference-check-template",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get reference check template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: { description: "Reference check template" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        // Get or create template (single template for now)
        let template = await db.referenceCheckTemplate.findFirst();

        if (!template) {
          // Create default template
          const user = getUser(request);
          template = await db.referenceCheckTemplate.create({
            data: {
              content: "<p>Reference Check Template</p>",
              updatedById: user.userId,
            },
            include: {
              updatedBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
            },
          });
        } else {
          // Include updatedBy
          template = await db.referenceCheckTemplate.findFirst({
            include: {
              updatedBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
            },
          });
        }

        return reply.send({
          id: template!.id,
          content: template!.content,
          updatedById: template!.updatedById,
          createdAt: template!.createdAt.toISOString(),
          updatedAt: template!.updatedAt.toISOString(),
          updatedBy: template!.updatedBy,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/reference-check-template");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update reference check template (Global Admin Only)
   */
  fastify.put<{
    Body: {
      content: string;
    };
  }>(
    "/admin/reference-check-template",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update reference check template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: { type: "string" },
          },
        },
        response: {
          200: { description: "Updated reference check template" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { content } = request.body;

        // Get or create template
        let template = await db.referenceCheckTemplate.findFirst();

        if (!template) {
          template = await db.referenceCheckTemplate.create({
            data: {
              content,
              updatedById: user.userId,
            },
            include: {
              updatedBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
            },
          });
        } else {
          template = await db.referenceCheckTemplate.update({
            where: { id: template.id },
            data: {
              content,
              updatedById: user.userId,
              updatedAt: new Date(),
            },
            include: {
              updatedBy: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
            },
          });
        }

        return reply.send({
          id: template.id,
          content: template.content,
          updatedById: template.updatedById,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          updatedBy: template.updatedBy,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /admin/reference-check-template");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Companies (Tenants) CRUD
  // ============================================

  /**
   * Get all companies (tenants)
   */
  fastify.get(
    "/admin/companies",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all companies (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                organizationNumber: { type: "string", nullable: true },
                emailDomain: { type: "string", nullable: true },
                subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
                subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
                subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
                trialStartedAt: { type: "string", format: "date-time", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                _count: {
                  type: "object",
                  properties: {
                    User: { type: "number" },
                    Project: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const companies = await db.tenant.findMany({
          include: {
            _count: {
              select: {
                User: true,
                Project: true,
              },
            },
          },
          orderBy: { name: "asc" },
        });

        return reply.send(
          companies.map((company) => ({
            id: company.id,
            name: company.name,
            organizationNumber: company.organizationNumber,
            emailDomain: company.emailDomain,
            subscriptionStatus: company.subscriptionStatus,
            subscriptionTier: company.subscriptionTier,
            subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
            trialStartedAt: company.trialStartedAt?.toISOString() ?? null,
            createdAt: company.createdAt.toISOString(),
            updatedAt: company.updatedAt.toISOString(),
            _count: company._count,
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/companies");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get a single company by ID
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/companies/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get a single company by ID (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              organizationNumber: { type: "string", nullable: true },
              emailDomain: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
              subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
              subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
              trialStartedAt: { type: "string", format: "date-time", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              _count: {
                type: "object",
                properties: {
                  User: { type: "number" },
                  Project: { type: "number" },
                },
              },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const company = await db.tenant.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                User: true,
                Project: true,
              },
            },
          },
        });

        if (!company) {
          return reply.status(404).send({ error: "Company not found" });
        }

        return reply.send({
          id: company.id,
          name: company.name,
          organizationNumber: company.organizationNumber,
          emailDomain: company.emailDomain,
          subscriptionStatus: company.subscriptionStatus,
          subscriptionTier: company.subscriptionTier,
          subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
          trialStartedAt: company.trialStartedAt?.toISOString() ?? null,
          createdAt: company.createdAt.toISOString(),
          updatedAt: company.updatedAt.toISOString(),
          _count: company._count,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/companies/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create a new company
   */
  fastify.post<{
    Body: {
      name: string;
      organizationNumber?: string | null;
      emailDomain?: string | null;
      subscriptionStatus?: "Trial" | "Active" | "Expired";
      subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null;
      subscriptionExpiresAt?: string | null;
    };
  }>(
    "/admin/companies",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create a new company (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            organizationNumber: { type: "string", nullable: true },
            emailDomain: { type: "string", nullable: true },
            subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
            subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
            subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              organizationNumber: { type: "string", nullable: true },
              emailDomain: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
              subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
              subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
              trialStartedAt: { type: "string", format: "date-time", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const {
          name,
          organizationNumber,
          emailDomain,
          subscriptionStatus = "Trial",
          subscriptionTier,
          subscriptionExpiresAt,
        } = request.body;

        const now = new Date();
        const createData: any = {
          id: `tenant-${Date.now()}`,
          name,
          organizationNumber: organizationNumber || null,
          emailDomain: emailDomain || null,
          subscriptionStatus,
          subscriptionTier: subscriptionTier || null,
          subscriptionExpiresAt: subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null,
        };

        // Set trialStartedAt if status is Trial
        if (subscriptionStatus === "Trial") {
          createData.trialStartedAt = now;
        }

        const company = await db.tenant.create({
          data: createData,
        });

        return reply.status(201).send({
          id: company.id,
          name: company.name,
          organizationNumber: company.organizationNumber,
          emailDomain: company.emailDomain,
          subscriptionStatus: company.subscriptionStatus,
          subscriptionTier: company.subscriptionTier,
          subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
          trialStartedAt: company.trialStartedAt?.toISOString() ?? null,
          createdAt: company.createdAt.toISOString(),
          updatedAt: company.updatedAt.toISOString(),
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /admin/companies");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update a company
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      name: string;
      organizationNumber?: string | null;
      emailDomain?: string | null;
      subscriptionStatus?: "Trial" | "Active" | "Expired";
      subscriptionTier?: "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null;
      subscriptionExpiresAt?: string | null;
      trialStartedAt?: string | null;
    };
  }>(
    "/admin/companies/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update a company (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            organizationNumber: { type: "string", nullable: true },
            emailDomain: { type: "string", nullable: true },
            subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
            subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
            subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
            trialStartedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              organizationNumber: { type: "string", nullable: true },
              emailDomain: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
              subscriptionTier: { type: "string", enum: ["Projects1", "Projects2", "Projects5", "Unlimited"], nullable: true },
              subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
              trialStartedAt: { type: "string", format: "date-time", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const {
          name,
          organizationNumber,
          emailDomain,
          subscriptionStatus,
          subscriptionTier,
          subscriptionExpiresAt,
          trialStartedAt,
        } = request.body;

        const updateData: any = {
          name,
          updatedAt: new Date(),
        };

        if (organizationNumber !== undefined) updateData.organizationNumber = organizationNumber || null;
        if (emailDomain !== undefined) updateData.emailDomain = emailDomain || null;
        if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
        if (subscriptionTier !== undefined) updateData.subscriptionTier = subscriptionTier || null;
        if (subscriptionExpiresAt !== undefined) {
          updateData.subscriptionExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
        }
        if (trialStartedAt !== undefined) {
          updateData.trialStartedAt = trialStartedAt ? new Date(trialStartedAt) : null;
        }

        const company = await db.tenant.update({
          where: { id },
          data: updateData,
        });

        return reply.send({
          id: company.id,
          name: company.name,
          organizationNumber: company.organizationNumber,
          emailDomain: company.emailDomain,
          subscriptionStatus: company.subscriptionStatus,
          subscriptionTier: company.subscriptionTier,
          subscriptionExpiresAt: company.subscriptionExpiresAt?.toISOString() ?? null,
          trialStartedAt: company.trialStartedAt?.toISOString() ?? null,
          createdAt: company.createdAt.toISOString(),
          updatedAt: company.updatedAt.toISOString(),
        });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Company not found" });
        }
        request.log.error({ err: error }, "Error in PUT /admin/companies/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete a company
   */
  fastify.delete<{ Params: { id: string } }>(
    "/admin/companies/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete a company (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user = getUser(request);

        // Prevent users from deleting their own company/tenant
        if (user.tenantId === id) {
          return reply.status(400).send({
            error: "Cannot delete your own company",
            message: "You cannot delete the company that your account belongs to. Please use a different admin account or transfer your account to another company first.",
          });
        }

        await db.tenant.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Company not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/companies/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Users CRUD
  // ============================================

  /**
   * Get all users
   */
  fastify.get(
    "/admin/users",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all users (Global Admin Only)",
        tags: ["admin"],
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
                tenantId: { type: "string", nullable: true },
                tenant: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const users = await db.user.findMany({
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send(
          users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
            tenant: user.tenant,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/users");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get a single user by ID
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/users/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get a single user by ID (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user = await db.user.findUnique({
          where: { id },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        return reply.send({
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/users/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create a new user
   */
  fastify.post<{
    Body: {
      email: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      role: string;
      tenantId?: string | null;
    };
  }>(
    "/admin/users",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create a new user (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["email", "role"],
          properties: {
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            name: { type: "string" },
            role: { type: "string", enum: ["GlobalAdministrator", "CompanyAdministrator", "User", "Vendor"] },
            tenantId: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { email, firstName, lastName, name, role, tenantId } = request.body;

        // Verify tenant exists if provided
        if (tenantId) {
          const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
          if (!tenant) {
            return reply.status(400).send({ error: "Tenant not found" });
          }
        }

        const user = await db.user.create({
          data: {
            email,
            firstName,
            lastName,
            name,
            role: role as Role,
            tenantId,
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return reply.status(201).send({
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
      } catch (error: any) {
        if (error.code === "P2002") {
          return reply.status(400).send({ error: "Email already exists" });
        }
        request.log.error({ err: error }, "Error in POST /admin/users");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update a user
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      email?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      role?: string;
      tenantId?: string | null;
    };
  }>(
    "/admin/users/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update a user (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            name: { type: "string" },
            role: { type: "string", enum: ["GlobalAdministrator", "CompanyAdministrator", "User", "Vendor"] },
            tenantId: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { email, firstName, lastName, name, role, tenantId } = request.body;

        // Verify tenant exists if provided
        if (tenantId !== undefined && tenantId !== null) {
          const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
          if (!tenant) {
            return reply.status(400).send({ error: "Tenant not found" });
          }
        }

        const updateData: any = {
          updatedAt: new Date(),
        };
        if (email !== undefined) updateData.email = email;
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (name !== undefined) updateData.name = name;
        if (role !== undefined) updateData.role = role as Role;
        if (tenantId !== undefined) updateData.tenantId = tenantId;

        const user = await db.user.update({
          where: { id },
          data: updateData,
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return reply.send({
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "User not found" });
        }
        if (error.code === "P2002") {
          return reply.status(400).send({ error: "Email already exists" });
        }
        request.log.error({ err: error }, "Error in PUT /admin/users/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete a user
   */
  fastify.delete<{ Params: { id: string } }>(
    "/admin/users/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete a user (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user = getUser(request);

        // Prevent users from deleting their own account
        if (user.userId === id) {
          return reply.status(400).send({
            error: "Cannot delete your own account",
            message: "You cannot delete your own account. Please use a different admin account to delete this user.",
          });
        }

        await db.user.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "User not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/users/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Requirement Templates CRUD
  // ============================================

  /**
   * Get all requirement templates
   */
  fastify.get(
    "/admin/requirement-templates",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all requirement templates (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                shortName: { type: "string" },
                description: { type: "string", nullable: true },
                languageCode: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                createdBy: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const templates = await db.requirementTemplate.findMany({
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { shortName: "asc" },
        });

        return reply.send(
          templates.map((template) => ({
            id: template.id,
            shortName: template.shortName,
            description: template.description,
            languageCode: template.languageCode,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString(),
            createdBy: template.createdBy,
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/requirement-templates");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get a single requirement template by ID with hierarchies
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/requirement-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get a requirement template with hierarchies (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const template = await db.requirementTemplate.findUnique({
          where: { id },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            hierarchies: {
              where: { parentId: null }, // Only root hierarchies
              include: {
                children: {
                  include: {
                    requirements: true,
                  },
                },
                requirements: true,
              },
              orderBy: { order: "asc" },
            },
          },
        });

        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        return reply.send({
          id: template.id,
          shortName: template.shortName,
          description: template.description,
          languageCode: template.languageCode,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          createdBy: template.createdBy,
          hierarchies: template.hierarchies,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/requirement-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create a new requirement template
   */
  fastify.post<{
    Body: {
      shortName: string;
      description?: string;
      languageCode: string;
    };
  }>(
    "/admin/requirement-templates",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create a new requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["shortName", "languageCode"],
          properties: {
            shortName: { type: "string" },
            description: { type: "string" },
            languageCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { shortName, description, languageCode } = request.body;

        // Check for existing template with same shortName and languageCode
        const existing = await db.requirementTemplate.findFirst({
          where: {
            shortName,
            languageCode,
          },
        });

        if (existing) {
          return reply.status(400).send({
            error: "A template with this short name and language code already exists",
          });
        }

        const template = await db.requirementTemplate.create({
          data: {
            shortName,
            description,
            languageCode,
            createdById: user.userId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        });

        return reply.status(201).send({
          id: template.id,
          shortName: template.shortName,
          description: template.description,
          languageCode: template.languageCode,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          createdBy: template.createdBy,
        });
      } catch (error: any) {
        if (error.code === "P2002") {
          return reply.status(400).send({
            error: "A template with this short name and language code already exists",
          });
        }
        request.log.error({ err: error }, "Error in POST /admin/requirement-templates");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update a requirement template
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      shortName?: string;
      description?: string;
      languageCode?: string;
    };
  }>(
    "/admin/requirement-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            shortName: { type: "string" },
            description: { type: "string" },
            languageCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { shortName, description, languageCode } = request.body;

        // Get current template to check what we're updating
        const currentTemplate = await db.requirementTemplate.findUnique({
          where: { id },
        });

        if (!currentTemplate) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Determine the final values for shortName and languageCode
        const finalShortName = shortName !== undefined ? shortName : currentTemplate.shortName;
        const finalLanguageCode = languageCode !== undefined ? languageCode : currentTemplate.languageCode;

        // Check for existing template with same shortName and languageCode (excluding current)
        if (shortName !== undefined || languageCode !== undefined) {
          const existing = await db.requirementTemplate.findFirst({
            where: {
              shortName: finalShortName,
              languageCode: finalLanguageCode,
            },
          });

          if (existing && existing.id !== id) {
            return reply.status(400).send({
              error: "A template with this short name and language code already exists",
            });
          }
        }

        const updateData: any = { updatedAt: new Date() };
        if (shortName !== undefined) updateData.shortName = shortName;
        if (description !== undefined) updateData.description = description;
        if (languageCode !== undefined) updateData.languageCode = languageCode;

        const template = await db.requirementTemplate.update({
          where: { id },
          data: updateData,
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        });

        return reply.send({
          id: template.id,
          shortName: template.shortName,
          description: template.description,
          languageCode: template.languageCode,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          createdBy: template.createdBy,
        });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Template not found" });
        }
        if (error.code === "P2002") {
          return reply.status(400).send({
            error: "A template with this short name and language code already exists",
          });
        }
        request.log.error({ err: error }, "Error in PUT /admin/requirement-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete a requirement template
   */
  fastify.delete<{ Params: { id: string } }>(
    "/admin/requirement-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        await db.requirementTemplate.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Template not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/requirement-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Email Templates CRUD
  // ============================================

  /**
   * Get all email templates (global templates only)
   */
  fastify.get(
    "/admin/email-templates",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all email templates (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                content: { type: "string", nullable: true },
                isGlobal: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                languages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      languageCode: { type: "string" },
                      subject: { type: "string", nullable: true },
                      content: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const templates = await db.template.findMany({
          where: { isGlobal: true },
          include: {
            emailTemplateLanguages: true,
          },
          orderBy: { name: "asc" },
        });

        return reply.send(
          templates.map((template) => ({
            id: template.id,
            name: template.name,
            content: template.content,
            isGlobal: template.isGlobal,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString(),
            languages: template.emailTemplateLanguages.map((lang) => ({
              id: lang.id,
              languageCode: lang.languageCode,
              subject: lang.subject,
              content: lang.content,
            })),
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/email-templates");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get a single email template by ID with all language versions
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/email-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get an email template with all language versions (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const template = await db.template.findUnique({
          where: { id },
          include: {
            emailTemplateLanguages: {
              orderBy: { languageCode: "asc" },
            },
          },
        });

        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        if (!template.isGlobal) {
          return reply.status(403).send({ error: "Only global templates can be managed" });
        }

        return reply.send({
          id: template.id,
          name: template.name,
          content: template.content,
          isGlobal: template.isGlobal,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          languages: template.emailTemplateLanguages.map((lang) => ({
            id: lang.id,
            languageCode: lang.languageCode,
            subject: lang.subject,
            content: lang.content,
            createdAt: lang.createdAt.toISOString(),
            updatedAt: lang.updatedAt.toISOString(),
          })),
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/email-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create a new email template
   */
  fastify.post<{
    Body: {
      name: string;
      content?: string;
    };
  }>(
    "/admin/email-templates",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create a new email template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { name, content } = request.body;

        const template = await db.template.create({
          data: {
            id: `email-template-${Date.now()}`,
            name,
            content: content || "",
            isGlobal: true,
          },
        });

        return reply.status(201).send({
          id: template.id,
          name: template.name,
          content: template.content,
          isGlobal: template.isGlobal,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          languages: [],
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /admin/email-templates");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update an email template
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      content?: string;
    };
  }>(
    "/admin/email-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update an email template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { name, content } = request.body;

        const existing = await db.template.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "Template not found" });
        }
        if (!existing.isGlobal) {
          return reply.status(403).send({ error: "Only global templates can be managed" });
        }

        const updateData: any = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name;
        if (content !== undefined) updateData.content = content;

        const template = await db.template.update({
          where: { id },
          data: updateData,
        });

        return reply.send({
          id: template.id,
          name: template.name,
          content: template.content,
          isGlobal: template.isGlobal,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Template not found" });
        }
        request.log.error({ err: error }, "Error in PUT /admin/email-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete an email template
   */
  fastify.delete<{ Params: { id: string } }>(
    "/admin/email-templates/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete an email template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const existing = await db.template.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "Template not found" });
        }
        if (!existing.isGlobal) {
          return reply.status(403).send({ error: "Only global templates can be managed" });
        }

        await db.template.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Template not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/email-templates/:id");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Add or update a language version of an email template
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      languageCode: string;
      subject?: string;
      content: string;
    };
  }>(
    "/admin/email-templates/:id/languages",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Add or update a language version of an email template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["languageCode", "content"],
          properties: {
            languageCode: { type: "string" },
            subject: { type: "string" },
            content: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { languageCode, subject, content } = request.body;

        const template = await db.template.findUnique({ where: { id } });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }
        if (!template.isGlobal) {
          return reply.status(403).send({ error: "Only global templates can be managed" });
        }

        const language = await db.emailTemplateLanguage.upsert({
          where: {
            templateId_languageCode: {
              templateId: id,
              languageCode,
            },
          },
          update: {
            subject,
            content,
            updatedAt: new Date(),
          },
          create: {
            templateId: id,
            languageCode,
            subject,
            content,
          },
        });

        return reply.send({
          id: language.id,
          languageCode: language.languageCode,
          subject: language.subject,
          content: language.content,
          createdAt: language.createdAt.toISOString(),
          updatedAt: language.updatedAt.toISOString(),
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /admin/email-templates/:id/languages");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete a language version of an email template
   */
  fastify.delete<{ Params: { id: string; languageCode: string } }>(
    "/admin/email-templates/:id/languages/:languageCode",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete a language version of an email template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "languageCode"],
          properties: {
            id: { type: "string" },
            languageCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id, languageCode } = request.params;

        const template = await db.template.findUnique({ where: { id } });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }
        if (!template.isGlobal) {
          return reply.status(403).send({ error: "Only global templates can be managed" });
        }

        await db.emailTemplateLanguage.delete({
          where: {
            templateId_languageCode: {
              templateId: id,
              languageCode,
            },
          },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Language version not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/email-templates/:id/languages/:languageCode");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Template Hierarchy and Requirements Management
  // ============================================

  // Helper function to generate template hierarchy number
  async function generateTemplateHierarchyNumber(
    templateId: string,
    parentId: string | null
  ): Promise<string> {
    if (parentId === null) {
      // Level 1 hierarchy - count existing level 1 hierarchies for this template
      const count = await db.requirementHierarchy.count({
        where: {
          templateId,
          isTemplate: true,
          parentId: null,
        },
      });
      return `${count + 1}.`;
    } else {
      // Level 2 hierarchy - get parent number and count both siblings and requirements
      const parent = await db.requirementHierarchy.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new Error("Parent hierarchy not found");
      }
      
      // Count both sub-hierarchies and requirements under the parent
      const siblingHierarchyCount = await db.requirementHierarchy.count({
        where: {
          templateId,
          isTemplate: true,
          parentId,
        },
      });
      
      const requirementCount = await db.requirement.count({
        where: {
          hierarchyId: parentId,
        },
      });
      
      // Remove trailing period from parent number for concatenation
      const parentNumberBase = parent.number.endsWith('.') ? parent.number.slice(0, -1) : parent.number;
      const totalCount = siblingHierarchyCount + requirementCount;
      return `${parentNumberBase}.${totalCount + 1}.`;
    }
  }

  // Helper function to generate requirement number (works for both projects and templates)
  async function generateRequirementNumber(
    hierarchyId: string
  ): Promise<string> {
    const hierarchy = await db.requirementHierarchy.findUnique({
      where: { id: hierarchyId },
    });
    if (!hierarchy) {
      throw new Error("Hierarchy not found");
    }

    // Count both sub-hierarchies and requirements under the parent hierarchy
    const subHierarchyCount = await db.requirementHierarchy.count({
      where: {
        parentId: hierarchyId,
      },
    });
    
    const requirementCount = await db.requirement.count({
      where: { hierarchyId },
    });

    // Remove trailing period from hierarchy number for concatenation
    const hierarchyNumberBase = hierarchy.number.endsWith('.') ? hierarchy.number.slice(0, -1) : hierarchy.number;
    const totalCount = subHierarchyCount + requirementCount;
    return `${hierarchyNumberBase}.${totalCount + 1}.`;
  }

  /**
   * Get all hierarchies for a requirement template
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/requirement-templates/:id/hierarchies",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all hierarchies for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Array of requirement hierarchies",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        const hierarchies = await db.requirementHierarchy.findMany({
          where: {
            templateId,
            isTemplate: true,
          },
          select: {
            id: true,
            templateId: true,
            parentId: true,
            number: true,
            title: true,
            description: true,
            order: true,
            createdAt: true,
            updatedAt: true,
            parent: {
              select: {
                id: true,
                templateId: true,
                parentId: true,
                number: true,
                title: true,
                description: true,
                order: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            children: {
              select: {
                id: true,
                templateId: true,
                parentId: true,
                number: true,
                title: true,
                description: true,
                order: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: { order: "asc" },
            },
            _count: {
              select: { requirements: true },
            },
          },
          orderBy: [
            { parentId: "asc" },
            { order: "asc" },
          ],
        });

        return reply.send(hierarchies);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/requirement-templates/:id/hierarchies");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create hierarchy for a requirement template
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      title: string;
      description?: string | null;
      parentId?: string | null;
    };
  }>(
    "/admin/requirement-templates/:id/hierarchies",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create hierarchy for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["title"],
          properties: {
            title: { type: "string" },
            description: { type: "string", nullable: true },
            parentId: { type: "string", nullable: true },
          },
        },
        response: {
          201: {
            description: "Created hierarchy",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;
        const { title, description, parentId } = request.body;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // If parentId is provided, verify it belongs to this template
        if (parentId) {
          const parent = await db.requirementHierarchy.findUnique({
            where: { id: parentId },
          });
          if (!parent || parent.templateId !== templateId || !parent.isTemplate) {
            return reply.status(400).send({ error: "Invalid parent hierarchy" });
          }
        }

        // Generate number and order
        const number = await generateTemplateHierarchyNumber(templateId, parentId || null);
        const maxOrder = await db.requirementHierarchy.findFirst({
          where: {
            templateId,
            isTemplate: true,
            parentId: parentId || null,
          },
          orderBy: { order: "desc" },
        });
        const order = maxOrder ? maxOrder.order + 1 : 1;

        const hierarchy = await db.requirementHierarchy.create({
          data: {
            templateId,
            isTemplate: true,
            projectId: null,
            parentId: parentId || null,
            number,
            title: title.trim(),
            description: description?.trim() || null,
            order,
          },
          select: {
            id: true,
            templateId: true,
            parentId: true,
            number: true,
            title: true,
            description: true,
            order: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.status(201).send(hierarchy);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /admin/requirement-templates/:id/hierarchies");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update hierarchy for a requirement template
   */
  fastify.put<{
    Params: { id: string; hierarchyId: string };
    Body: {
      title?: string;
      description?: string | null;
    };
  }>(
    "/admin/requirement-templates/:id/hierarchies/:hierarchyId",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update hierarchy for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "hierarchyId"],
          properties: {
            id: { type: "string" },
            hierarchyId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string", nullable: true },
          },
        },
        response: {
          200: {
            description: "Updated hierarchy",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId, hierarchyId } = request.params;
        const { title, description } = request.body;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify hierarchy belongs to this template
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: hierarchyId },
        });
        if (!hierarchy || hierarchy.templateId !== templateId || !hierarchy.isTemplate) {
          return reply.status(404).send({ error: "Hierarchy not found" });
        }

        const updateData: any = { updatedAt: new Date() };
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;

        const updated = await db.requirementHierarchy.update({
          where: { id: hierarchyId },
          data: updateData,
          select: {
            id: true,
            templateId: true,
            parentId: true,
            number: true,
            title: true,
            description: true,
            order: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send(updated);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Hierarchy not found" });
        }
        request.log.error({ err: error }, "Error in PUT /admin/requirement-templates/:id/hierarchies/:hierarchyId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete hierarchy for a requirement template
   */
  fastify.delete<{
    Params: { id: string; hierarchyId: string };
  }>(
    "/admin/requirement-templates/:id/hierarchies/:hierarchyId",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete hierarchy for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "hierarchyId"],
          properties: {
            id: { type: "string" },
            hierarchyId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId, hierarchyId } = request.params;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify hierarchy belongs to this template
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: hierarchyId },
        });
        if (!hierarchy || hierarchy.templateId !== templateId || !hierarchy.isTemplate) {
          return reply.status(404).send({ error: "Hierarchy not found" });
        }

        await db.requirementHierarchy.delete({
          where: { id: hierarchyId },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Hierarchy not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/requirement-templates/:id/hierarchies/:hierarchyId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Reorder hierarchies for a requirement template
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      hierarchyIds: string[];
      parentId?: string | null;
    };
  }>(
    "/admin/requirement-templates/:id/hierarchies/reorder",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Reorder hierarchies for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["hierarchyIds"],
          properties: {
            hierarchyIds: {
              type: "array",
              items: { type: "string" },
            },
            parentId: { type: "string", nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;
        const { hierarchyIds, parentId } = request.body;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Update order for each hierarchy
        for (let i = 0; i < hierarchyIds.length; i++) {
          await db.requirementHierarchy.updateMany({
            where: {
              id: hierarchyIds[i],
              templateId,
              isTemplate: true,
              parentId: parentId || null,
            },
            data: { order: i + 1 },
          });
        }

        return reply.status(204).send();
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /admin/requirement-templates/:id/hierarchies/reorder");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get all requirements for a requirement template
   */
  fastify.get<{ Params: { id: string } }>(
    "/admin/requirement-templates/:id/requirements",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get all requirements for a requirement template (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Array of requirements",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        const requirements = await db.requirement.findMany({
          where: {
            hierarchy: {
              templateId,
              isTemplate: true,
            },
          },
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
          orderBy: [
            { hierarchyId: "asc" },
            { order: "asc" },
          ],
        });

        return reply.send(requirements);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/requirement-templates/:id/requirements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create requirement in template hierarchy
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      hierarchyId: string;
      description: string;
      type?: string;
    };
  }>(
    "/admin/requirement-templates/:id/requirements",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Create requirement in template hierarchy (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["hierarchyId", "description"],
          properties: {
            hierarchyId: { type: "string" },
            description: { type: "string" },
            type: { type: "string" },
          },
        },
        response: {
          201: {
            description: "Created requirement",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;
        const { hierarchyId, description, type } = request.body;
        const user = getUser(request);

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify hierarchy belongs to this template
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: hierarchyId },
        });
        if (!hierarchy || hierarchy.templateId !== templateId || !hierarchy.isTemplate) {
          return reply.status(400).send({ error: "Invalid hierarchy" });
        }

        // Generate number and order
        const number = await generateRequirementNumber(hierarchyId);
        const maxOrder = await db.requirement.findFirst({
          where: { hierarchyId },
          orderBy: { order: "desc" },
        });
        const order = maxOrder ? maxOrder.order + 1 : 1;

        // Validate and set requirement type
        const validTypes = ["Information", "Mandatory", "Important", "Wish"];
        const requirementType = type && validTypes.includes(type)
          ? (type as any)
          : "Information";

        const requirement = await db.requirement.create({
          data: {
            hierarchyId,
            number,
            description: description.trim(),
            type: requirementType,
            status: null, // Templates don't have status
            order,
            createdById: user.userId,
            lastModifiedById: user.userId,
          },
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
        });

        return reply.status(201).send(requirement);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /admin/requirement-templates/:id/requirements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update requirement in template hierarchy
   */
  fastify.put<{
    Params: { id: string; requirementId: string };
    Body: {
      description?: string;
      type?: string;
    };
  }>(
    "/admin/requirement-templates/:id/requirements/:requirementId",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Update requirement in template hierarchy (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "requirementId"],
          properties: {
            id: { type: "string" },
            requirementId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            description: { type: "string" },
            type: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Updated requirement",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId, requirementId } = request.params;
        const { description, type } = request.body;
        const user = getUser(request);

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify requirement belongs to a hierarchy in this template
        const requirement = await db.requirement.findUnique({
          where: { id: requirementId },
          include: {
            hierarchy: true,
          },
        });
        if (!requirement || requirement.hierarchy.templateId !== templateId || !requirement.hierarchy.isTemplate) {
          return reply.status(404).send({ error: "Requirement not found" });
        }

        const updateData: any = {
          updatedAt: new Date(),
          lastModifiedById: user.userId,
        };
        if (description !== undefined) updateData.description = description.trim();
        if (type !== undefined) {
          const validTypes = ["Information", "Mandatory", "Important", "Wish"];
          if (validTypes.includes(type)) {
            updateData.type = type;
          }
        }

        const updated = await db.requirement.update({
          where: { id: requirementId },
          data: updateData,
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
        });

        return reply.send(updated);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Requirement not found" });
        }
        request.log.error({ err: error }, "Error in PUT /admin/requirement-templates/:id/requirements/:requirementId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete requirement from template hierarchy
   */
  fastify.delete<{
    Params: { id: string; requirementId: string };
  }>(
    "/admin/requirement-templates/:id/requirements/:requirementId",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Delete requirement from template hierarchy (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "requirementId"],
          properties: {
            id: { type: "string" },
            requirementId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId, requirementId } = request.params;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify requirement belongs to a hierarchy in this template
        const requirement = await db.requirement.findUnique({
          where: { id: requirementId },
          include: {
            hierarchy: true,
          },
        });
        if (!requirement || requirement.hierarchy.templateId !== templateId || !requirement.hierarchy.isTemplate) {
          return reply.status(404).send({ error: "Requirement not found" });
        }

        await db.requirement.delete({
          where: { id: requirementId },
        });

        return reply.status(204).send();
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Requirement not found" });
        }
        request.log.error({ err: error }, "Error in DELETE /admin/requirement-templates/:id/requirements/:requirementId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Reorder requirement in template hierarchy
   */
  fastify.put<{
    Params: { id: string; requirementId: string };
    Body: {
      requirementIds: string[];
      hierarchyId: string;
    };
  }>(
    "/admin/requirement-templates/:id/requirements/:requirementId/reorder",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Reorder requirement in template hierarchy (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "requirementId"],
          properties: {
            id: { type: "string" },
            requirementId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["requirementIds", "hierarchyId"],
          properties: {
            requirementIds: {
              type: "array",
              items: { type: "string" },
            },
            hierarchyId: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id: templateId } = request.params;
        const { requirementIds, hierarchyId } = request.body;

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Verify hierarchy belongs to this template
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: hierarchyId },
        });
        if (!hierarchy || hierarchy.templateId !== templateId || !hierarchy.isTemplate) {
          return reply.status(400).send({ error: "Invalid hierarchy" });
        }

        // Update order for each requirement
        for (let i = 0; i < requirementIds.length; i++) {
          await db.requirement.updateMany({
            where: {
              id: requirementIds[i],
              hierarchyId,
            },
            data: { order: i + 1 },
          });
        }

        return reply.status(204).send();
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /admin/requirement-templates/:id/requirements/:requirementId/reorder");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Import requirements for a requirement template (non-destructive)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      requirements: Array<{
        level1: string;
        level2?: string;
        requirement: string;
        type?: string;
      }>;
    };
  }>(
    "/admin/requirement-templates/:id/import/requirements",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Import requirements for a requirement template (non-destructive, Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["requirements"],
          properties: {
            requirements: {
              type: "array",
              items: {
                type: "object",
                required: ["level1", "requirement"],
                properties: {
                  level1: { type: "string" },
                  level2: { type: "string" },
                  requirement: { type: "string" },
                  type: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              count: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const templateId = request.params.id;
        const user = getUser(request);

        // Verify template exists
        const template = await db.requirementTemplate.findUnique({
          where: { id: templateId },
        });
        if (!template) {
          return reply.status(404).send({ error: "Template not found" });
        }

        // Validate request body
        if (!request.body || !Array.isArray(request.body.requirements)) {
          return reply.status(400).send({ error: "Invalid request body: requirements array is required" });
        }

        // Track created hierarchies to avoid duplicates
        const level1Hierarchies = new Map<string, string>(); // level1 title -> hierarchy id
        const level2Hierarchies = new Map<string, string>(); // "level1|level2" -> hierarchy id

        let count = 0;

        for (const reqData of request.body.requirements) {
          if (!reqData.level1 || !reqData.level1.trim() || !reqData.requirement || !reqData.requirement.trim()) {
            continue; // Skip invalid entries
          }

          const level1Title = reqData.level1.trim();
          const level2Title = reqData.level2?.trim() || "";
          const requirementDesc = reqData.requirement.trim();

          // Get or create level 1 hierarchy
          let level1HierarchyId = level1Hierarchies.get(level1Title);
          if (!level1HierarchyId) {
            // Check if it already exists
            const existing = await db.requirementHierarchy.findFirst({
              where: {
                templateId,
                isTemplate: true,
                parentId: null,
                title: level1Title,
              },
            });

            if (existing) {
              level1HierarchyId = existing.id;
            } else {
              // Create new level 1 hierarchy
              const number = await generateTemplateHierarchyNumber(templateId, null);
              const maxOrder = await db.requirementHierarchy.findFirst({
                where: { templateId, isTemplate: true, parentId: null },
                orderBy: { order: "desc" },
              });
              const order = maxOrder ? maxOrder.order + 1 : 1;

              const newHierarchy = await db.requirementHierarchy.create({
                data: {
                  templateId,
                  isTemplate: true,
                  projectId: null,
                  parentId: null,
                  number,
                  title: level1Title,
                  order,
                },
              });
              level1HierarchyId = newHierarchy.id;
            }
            level1Hierarchies.set(level1Title, level1HierarchyId);
          }

          // Get or create level 2 hierarchy if needed
          let targetHierarchyId = level1HierarchyId;
          if (level2Title) {
            const level2Key = `${level1Title}|${level2Title}`;
            let level2HierarchyId = level2Hierarchies.get(level2Key);
            if (!level2HierarchyId) {
              // Check if it already exists
              const existing = await db.requirementHierarchy.findFirst({
                where: {
                  templateId,
                  isTemplate: true,
                  parentId: level1HierarchyId,
                  title: level2Title,
                },
              });

              if (existing) {
                level2HierarchyId = existing.id;
              } else {
                // Create new level 2 hierarchy
                const number = await generateTemplateHierarchyNumber(templateId, level1HierarchyId);
                const maxOrder = await db.requirementHierarchy.findFirst({
                  where: { templateId, isTemplate: true, parentId: level1HierarchyId },
                  orderBy: { order: "desc" },
                });
                const order = maxOrder ? maxOrder.order + 1 : 1;

                const newHierarchy = await db.requirementHierarchy.create({
                  data: {
                    templateId,
                    isTemplate: true,
                    projectId: null,
                    parentId: level1HierarchyId,
                    number,
                    title: level2Title,
                    order,
                  },
                });
                level2HierarchyId = newHierarchy.id;
              }
              level2Hierarchies.set(level2Key, level2HierarchyId);
            }
            targetHierarchyId = level2HierarchyId;
          }

          // Check if requirement already exists (non-destructive)
          const existingRequirement = await db.requirement.findFirst({
            where: {
              hierarchyId: targetHierarchyId,
              description: requirementDesc,
            },
          });

          if (existingRequirement) {
            continue; // Skip if requirement already exists
          }

          // Create requirement
          const hierarchy = await db.requirementHierarchy.findUnique({
            where: { id: targetHierarchyId },
          });
          if (!hierarchy) {
            continue; // Skip if hierarchy not found
          }

          const requirementNumber = await generateRequirementNumber(targetHierarchyId);
          const maxOrder = await db.requirement.findFirst({
            where: { hierarchyId: targetHierarchyId },
            orderBy: { order: "desc" },
          });
          const order = maxOrder ? maxOrder.order + 1 : 1;

          // Validate and set requirement type
          const validTypes = ["Information", "Mandatory", "Important", "Wish"];
          const requirementType = reqData.type && validTypes.includes(reqData.type)
            ? (reqData.type as any)
            : "Information";

          await db.requirement.create({
            data: {
              hierarchyId: targetHierarchyId,
              number: requirementNumber,
              description: requirementDesc,
              type: requirementType,
              status: null, // Templates don't have status
              order,
              createdById: user.userId,
              lastModifiedById: user.userId,
            },
          });

          count++;
        }

        return reply.status(200).send({ count });
      } catch (error: any) {
        request.log.error({ err: error }, "Error importing template requirements");
        return reply.status(500).send({
          error: "Failed to import requirements",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // ============================================
  // Dashboard Stats
  // ============================================

  /**
   * Get dashboard stats (counts for widgets)
   */
  fastify.get(
    "/admin/stats",
    {
      preHandler: [authenticate, requireGlobalAdmin()],
      schema: {
        description: "Get admin dashboard stats (Global Admin Only)",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              companies: { type: "number" },
              users: { type: "number" },
              requirementTemplates: { type: "number" },
              emailTemplates: { type: "number" },
              projects: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const [companies, users, requirementTemplates, emailTemplates, projects] = await Promise.all([
          db.tenant.count(),
          db.user.count(),
          db.requirementTemplate.count(),
          db.template.count({ where: { isGlobal: true } }),
          db.project.count(),
        ]);

        return reply.send({
          companies,
          users,
          requirementTemplates,
          emailTemplates,
          projects,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /admin/stats");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );
}

