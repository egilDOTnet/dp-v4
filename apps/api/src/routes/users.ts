import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { updateProfileSchema } from "@dp/lib";
import { authenticate, requireRole, requireTenant, getUser } from "../middleware/auth";

interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
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

      // Compute name from firstName and lastName for backward compatibility
      const displayName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || user.name || null;

      return reply.send({
        id: user.id,
        email: user.email,
        name: displayName,
        firstName: user.firstName,
        lastName: user.lastName,
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
      try {
        request.log.info("Update profile request received", { body: request.body });
        
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        let body;
        try {
          body = updateProfileSchema.parse(request.body);
          request.log.info("Validation passed", { body });
        } catch (err: any) {
          request.log.error("Validation error", err);
          return reply.status(400).send({ error: `Validation error: ${err.message}` });
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
        // Update user firstName and lastName
        const updateData: { firstName?: string | null; lastName?: string | null } = {};
        if (body.firstName !== undefined) {
          updateData.firstName = typeof body.firstName === 'string' ? body.firstName.trim() || null : null;
        }
        if (body.lastName !== undefined) {
          updateData.lastName = typeof body.lastName === 'string' ? body.lastName.trim() || null : null;
        }
        
        request.log.info("Update data", { updateData });
        
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

        // Compute name from firstName and lastName for backward compatibility
        const displayName = updatedUser.firstName && updatedUser.lastName
          ? `${updatedUser.firstName} ${updatedUser.lastName}`
          : updatedUser.firstName || updatedUser.lastName || updatedUser.name || null;

        request.log.info("Sending response");
        return reply.send({
          id: updatedUser.id,
          email: updatedUser.email,
          name: displayName,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          tenantId: updatedUser.tenantId,
          companyName: updatedUser.tenant?.name,
        });
      } catch (error: any) {
        request.log.error("Error in update profile", error);
        return reply.status(500).send({ error: error.message || "Internal server error" });
      }
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
}

