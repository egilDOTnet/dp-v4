import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";

export default async function templateRoutes(fastify: FastifyInstance) {
  /**
   * Get all available templates
   * Returns both global templates and tenant-specific templates
   */
  fastify.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all templates available to the current user. Includes global templates and templates specific to the user's tenant.",
        tags: ["templates"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                content: { type: "string" },
                isGlobal: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
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
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      const templates = await db.template.findMany({
        where: {
          OR: [
            { isGlobal: true },
            { tenantId: currentUser.tenantId || undefined },
          ],
        },
        select: {
          id: true,
          name: true,
          content: true,
          isGlobal: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
      });

      return reply.send(templates);
    }
  );

  /**
   * Get a single template by ID
   * User must have access (global template or tenant-specific template)
   */
  fastify.get(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get a single template by ID. User must have access (template must be global or belong to user's tenant).",
        tags: ["templates"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Template ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              content: { type: "string" },
              isGlobal: { type: "boolean" },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
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
            description: "Access denied - template not accessible",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Template not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const id = (request.params as { id: string }).id;
      const currentUser = getUser(request);

      const template = await db.template.findUnique({
        where: { id },
      });

      if (!template) {
        return reply.status(404).send({ error: "Template not found" });
      }

      // Check access: must be global or belong to user's tenant
      if (!template.isGlobal && template.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send(template);
    }
  );
}

