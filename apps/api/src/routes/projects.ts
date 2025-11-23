import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { createProjectSchema, addProjectMembersSchema } from "@dp/lib";
import { authenticate, requireTenant, requireRole, getUser } from "../middleware/auth";

// Email notification stub
function notifyUserAddedToProject(userEmail: string, projectName: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(`Email notification: User ${userEmail} added to project ${projectName}`);
  }
  // TODO: Implement actual email service integration
}

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
                    firstName: true,
                    lastName: true,
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
                    firstName: true,
                    lastName: true,
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
          members: "members" in p && p.members ? p.members.map((m: any) => {
            const user = m.user as { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null };
            const displayName = user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || user.lastName || user.name || null;
            return {
              id: user.id,
              email: user.email,
              name: displayName,
              firstName: user.firstName,
              lastName: user.lastName,
            };
          }) : [],
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
        members: project.members.map((m) => {
          const user = m.user as typeof m.user & { firstName: string | null; lastName: string | null };
          const displayName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || user.name || null;
          return {
            id: user.id,
            email: user.email,
            name: displayName,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }),
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
        members: project.members.map((m) => {
          const user = m.user as typeof m.user & { firstName: string | null; lastName: string | null };
          const displayName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || user.name || null;
          return {
            id: user.id,
            email: user.email,
            name: displayName,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }),
      });
    }
  );

  // Add members to project
  fastify.post<{ Params: { id: string }; Body: { memberIds: string[] } }>(
    "/:id/members",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { memberIds: string[] } }>, reply: FastifyReply) => {
      const currentUser = getUser(request);
      const projectId = request.params.id;

      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      const body = addProjectMembersSchema.parse(request.body);

      // Verify project exists and belongs to same tenant
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { members: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      if (project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify all member IDs belong to the same tenant
      const members = await db.user.findMany({
        where: {
          id: { in: body.memberIds },
          tenantId: currentUser.tenantId,
        },
      });

      if (members.length !== body.memberIds.length) {
        return reply.status(400).send({ error: "Some members not found or belong to different tenant" });
      }

      // Get existing member IDs to avoid duplicates
      const existingMemberIds = project.members.map((m) => m.userId);
      const newMemberIds = body.memberIds.filter((id) => !existingMemberIds.includes(id));

      // Add new members
      if (newMemberIds.length > 0) {
        await db.projectMember.createMany({
          data: newMemberIds.map((userId) => ({
            projectId,
            userId,
          })),
        });

        // Send email notifications for newly added members
        const newMembers = members.filter((m) => newMemberIds.includes(m.id));
        for (const member of newMembers) {
          notifyUserAddedToProject(member.email, project.name);
        }
      }

      // Return updated project with all members
      const updatedProject = await db.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!updatedProject) {
        return reply.status(404).send({ error: "Project not found after update" });
      }

      return reply.send({
        id: updatedProject.id,
        name: updatedProject.name,
        type: updatedProject.type,
        startDate: updatedProject.startDate,
        endDate: updatedProject.endDate,
        tenantId: updatedProject.tenantId,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        members: updatedProject.members.map((m) => {
          const user = m.user as typeof m.user & { firstName: string | null; lastName: string | null };
          const displayName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.lastName || user.name || null;
          return {
            id: user.id,
            email: user.email,
            name: displayName,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }),
      });
    }
  );
}

