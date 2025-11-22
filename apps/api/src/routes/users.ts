import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { updateProfileSchema } from "@dp/lib";
import { authenticate, requireRole, requireTenant, getUser } from "../middleware/auth";

interface UpdateProfileBody {
  name?: string;
  companyName?: string;
}

export default async function userRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get(
    "/profile",
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

  // Update profile
  fastify.put<{ Body: UpdateProfileBody }>(
    "/profile",
    {
      preHandler: [
        authenticate,
        requireTenant,
        async (request, reply) => {
          if (!request.user) return;
          const user = await db.user.findUnique({
            where: { id: request.user.userId },
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
    },
    async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const body = updateProfileSchema.parse(request.body);

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { tenant: true },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Update user name
      if (body.name) {
        await db.user.update({
          where: { id: user.id },
          data: { name: body.name },
        });
      }

      // Update company name (only for admins)
      if (body.companyName && user.tenantId) {
        if (
          user.role === "CompanyAdministrator" ||
          user.role === "GlobalAdministrator"
        ) {
          await db.tenant.update({
            where: { id: user.tenantId },
            data: { name: body.companyName },
          });
        }
      }

      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
        include: { tenant: true },
      });

      return reply.send({
        id: updatedUser!.id,
        email: updatedUser!.email,
        name: updatedUser!.name,
        role: updatedUser!.role,
        tenantId: updatedUser!.tenantId,
        companyName: updatedUser!.tenant?.name,
      });
    }
  );

  // Get company users (for company admins)
  fastify.get(
    "/company",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
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
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send(users);
    }
  );
}

