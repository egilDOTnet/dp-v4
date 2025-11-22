import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { createProjectSchema } from "@dp/lib";
import { authenticate, requireTenant, requireRole, getUser } from "../middleware/auth";

interface CreateProjectBody {
  name: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  memberIds?: string[];
}

export default async function projectRoutes(fastify: FastifyInstance) {
  // Get all projects for current user
  fastify.get(
    "/",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: {
          projectMembers: {
            include: {
              project: {
                include: {
                  tenant: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Company admins see all company projects, regular users see only their projects
      let projects;
      if (
        user.role === "CompanyAdministrator" ||
        user.role === "GlobalAdministrator"
      ) {
        if (!user.tenantId) {
          return reply.send([]);
        }
        projects = await db.project.findMany({
          where: { tenantId: user.tenantId },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      } else {
        const projectIds = user.projectMembers.map((pm) => pm.projectId);
        projects = await db.project.findMany({
          where: { id: { in: projectIds } },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }

      return reply.send(
        projects.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          startDate: p.startDate,
          endDate: p.endDate,
          tenantId: p.tenantId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          members: "members" in p && p.members ? p.members.map((m: any) => ({
            id: m.user.id,
            email: m.user.email,
            name: m.user.name,
          })) : [],
        }))
      );
    }
  );

  // Get single project
  fastify.get(
    "/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const id = (request.params as { id: string }).id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const project = await db.project.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          tenant: true,
        },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Check access: user must be member or company admin
      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: {
          projectMembers: true,
        },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({
        id: project.id,
        name: project.name,
        type: project.type,
        startDate: project.startDate,
        endDate: project.endDate,
        tenantId: project.tenantId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        members: project.members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
        })),
      });
    }
  );

  // Create project
  fastify.post<{ Body: CreateProjectBody }>(
    "/",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
    },
    async (request: FastifyRequest<{ Body: CreateProjectBody }>, reply: FastifyReply) => {
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      const body = createProjectSchema.parse(request.body);

      // Verify all member IDs belong to the same tenant
      if (body.memberIds && body.memberIds.length > 0) {
        const members = await db.user.findMany({
          where: {
            id: { in: body.memberIds },
            tenantId: currentUser.tenantId,
          },
        });

        if (members.length !== body.memberIds.length) {
          return reply.status(400).send({ error: "Some members not found or belong to different tenant" });
        }
      }

      const project = await db.project.create({
        data: {
          name: body.name,
          type: body.type,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          tenantId: currentUser.tenantId,
          members: {
            create: body.memberIds?.map((userId) => ({
              userId,
            })) || [],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return reply.status(201).send({
        id: project.id,
        name: project.name,
        type: project.type,
        startDate: project.startDate,
        endDate: project.endDate,
        tenantId: project.tenantId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        members: project.members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
        })),
      });
    }
  );
}

