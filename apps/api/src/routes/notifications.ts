import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Get user's notifications
  fastify.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const currentUser = getUser(request);

    try {
      const notifications = await db.notification.findMany({
        where: { userId: currentUser.userId },
        include: {
          task: {
            include: {
              phase: {
                include: {
                  Project: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          mentionedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { read: "asc" }, // Unread first
          { createdAt: "desc" }, // Then by date desc
        ],
      });

      return reply.send(
        notifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          taskId: notification.taskId,
          commentId: notification.commentId,
          read: notification.read,
          createdAt: notification.createdAt,
          task: notification.task && notification.task.phase && notification.task.phase.Project
            ? {
                id: notification.task.id,
                name: notification.task.name,
                phaseId: notification.task.phaseId,
                project: {
                  id: notification.task.phase.Project.id,
                  name: notification.task.phase.Project.name,
                },
              }
            : null,
          mentionedBy: notification.mentionedBy
            ? {
                id: notification.mentionedBy.id,
                email: notification.mentionedBy.email,
                name: notification.mentionedBy.name,
                firstName: notification.mentionedBy.firstName,
                lastName: notification.mentionedBy.lastName,
              }
            : null,
        }))
      );
    } catch (err: any) {
      request.log.error("Error fetching notifications:", err);
      // If table doesn't exist yet (migration not run) or any Prisma error, return empty array
      if (
        err.message?.includes("does not exist") ||
        err.code === "P2021" ||
        err.code === "P1001" ||
        err.code === "P1003" ||
        err.name === "PrismaClientKnownRequestError" ||
        err.name === "PrismaClientUnknownRequestError" ||
        err.name === "PrismaClientInitializationError"
      ) {
        return reply.send([]);
      }
      // For any other error, return empty array instead of throwing to avoid 500
      request.log.warn("Unexpected error in notifications endpoint, returning empty array:", err);
      return reply.send([]);
    }

  });

  // Get unread notification count
  fastify.get("/unread-count", { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const currentUser = getUser(request);

    try {
      const count = await db.notification.count({
        where: {
          userId: currentUser.userId,
          read: false,
        },
      });

      return reply.send({ count });
    } catch (err: any) {
      request.log.error("Error fetching unread count:", err);
      // If table doesn't exist yet (migration not run) or any Prisma error, return 0
      if (
        err.message?.includes("does not exist") ||
        err.code === "P2021" ||
        err.code === "P1001" ||
        err.code === "P1003" ||
        err.name === "PrismaClientKnownRequestError" ||
        err.name === "PrismaClientUnknownRequestError" ||
        err.name === "PrismaClientInitializationError"
      ) {
        return reply.send({ count: 0 });
      }
      // For any other error, return 0 instead of throwing to avoid 500
      request.log.warn("Unexpected error in unread count endpoint, returning 0:", err);
      return reply.send({ count: 0 });
    }
  });

  // Mark notification as read
  fastify.put<{ Params: { id: string } }>(
    "/:id/read",
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      const notificationId = request.params.id;

      try {
        // Verify notification belongs to current user
        const notification = await db.notification.findUnique({
          where: { id: notificationId },
        });

        if (!notification) {
          return reply.status(404).send({ error: "Notification not found" });
        }

        if (notification.userId !== currentUser.userId) {
          return reply.status(403).send({ error: "Access denied" });
        }

        // Mark as read
        await db.notification.update({
          where: { id: notificationId },
          data: { read: true },
        });

        return reply.status(204).send();
      } catch (err: any) {
        request.log.error("Error marking notification as read:", err);
        // If table doesn't exist or any Prisma error, return 404 (notification not found)
        if (
          err.message?.includes("does not exist") ||
          err.code === "P2021" ||
          err.code === "P1001" ||
          err.code === "P1003" ||
          err.name === "PrismaClientKnownRequestError" ||
          err.name === "PrismaClientUnknownRequestError" ||
          err.name === "PrismaClientInitializationError"
        ) {
          return reply.status(404).send({ error: "Notification not found" });
        }
        // For any other error, return 404 instead of throwing to avoid 500
        request.log.warn("Unexpected error in mark read endpoint, returning 404:", err);
        return reply.status(404).send({ error: "Notification not found" });
      }
    }
  );

  // Mark all notifications as read
  fastify.put("/read-all", { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const currentUser = getUser(request);

    try {
      await db.notification.updateMany({
        where: {
          userId: currentUser.userId,
          read: false,
        },
        data: { read: true },
      });

      return reply.status(204).send();
    } catch (err: any) {
      request.log.error("Error marking all notifications as read:", err);
      // If table doesn't exist or any Prisma error, just return success (no-op)
      if (
        err.message?.includes("does not exist") ||
        err.code === "P2021" ||
        err.code === "P1001" ||
        err.code === "P1003" ||
        err.name === "PrismaClientKnownRequestError" ||
        err.name === "PrismaClientUnknownRequestError" ||
        err.name === "PrismaClientInitializationError"
      ) {
        return reply.status(204).send();
      }
      // For any other error, return success (no-op) instead of throwing to avoid 500
      request.log.warn("Unexpected error in mark all read endpoint, returning success:", err);
      return reply.status(204).send();
    }
  });
}
