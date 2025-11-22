import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";

export default async function templateRoutes(fastify: FastifyInstance) {
  // Get all templates (global + tenant-specific)
  fastify.get(
    "/",
    { preHandler: [authenticate] },
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

  // Get single template
  fastify.get(
    "/:id",
    { preHandler: [authenticate] },
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

