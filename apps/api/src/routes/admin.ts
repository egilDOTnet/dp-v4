import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser, requireRole } from "../middleware/auth";

export default async function adminRoutes(fastify: FastifyInstance) {
  /**
   * Get reference check template (Global Admin Only)
   */
  fastify.get(
    "/admin/reference-check-template",
    {
      preHandler: [authenticate, requireRole(["GlobalAdministrator"])],
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
      preHandler: [authenticate, requireRole(["GlobalAdministrator"])],
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
}

