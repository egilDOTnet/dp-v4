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
  fastify.post<{ Body: { name: string } }>(
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
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { name } = request.body;
        const company = await db.tenant.create({
          data: {
            id: `tenant-${Date.now()}`,
            name,
          },
        });

        return reply.status(201).send({
          id: company.id,
          name: company.name,
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
  fastify.put<{ Params: { id: string }; Body: { name: string } }>(
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
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { name } = request.body;

        const company = await db.tenant.update({
          where: { id },
          data: { name, updatedAt: new Date() },
        });

        return reply.send({
          id: company.id,
          name: company.name,
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
      languageCode?: string;
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
          required: ["shortName"],
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
          return reply.status(400).send({ error: "Template shortName already exists" });
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
          return reply.status(400).send({ error: "Template shortName already exists" });
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

