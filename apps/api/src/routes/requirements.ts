import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";

// Helper function to generate hierarchy number
async function generateHierarchyNumber(
  projectId: string,
  parentId: string | null
): Promise<string> {
  if (parentId === null) {
    // Level 1 hierarchy - count existing level 1 hierarchies
    const count = await db.requirementHierarchy.count({
      where: {
        projectId,
        parentId: null,
      },
    });
    return String(count + 1);
  } else {
    // Level 2 hierarchy - get parent number and count siblings
    const parent = await db.requirementHierarchy.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new Error("Parent hierarchy not found");
    }
    const siblingCount = await db.requirementHierarchy.count({
      where: {
        projectId,
        parentId,
      },
    });
    return `${parent.number}.${siblingCount + 1}`;
  }
}

// Helper function to generate requirement number
async function generateRequirementNumber(
  hierarchyId: string
): Promise<string> {
  const hierarchy = await db.requirementHierarchy.findUnique({
    where: { id: hierarchyId },
  });
  if (!hierarchy) {
    throw new Error("Hierarchy not found");
  }

  const requirementCount = await db.requirement.count({
    where: { hierarchyId },
  });

  return `${hierarchy.number}.${requirementCount + 1}`;
}

// Helper function to renumber requirements in a hierarchy
async function renumberRequirementsInHierarchy(hierarchyId: string) {
  const requirements = await db.requirement.findMany({
    where: { hierarchyId },
    orderBy: { order: "asc" },
  });

  const hierarchy = await db.requirementHierarchy.findUnique({
    where: { id: hierarchyId },
  });
  if (!hierarchy) return;

  for (let i = 0; i < requirements.length; i++) {
    const newNumber = `${hierarchy.number}.${i + 1}`;
    if (requirements[i].number !== newNumber) {
      await db.requirement.update({
        where: { id: requirements[i].id },
        data: { number: newNumber },
      });
    }
  }
}

// Helper function to create requirement history entry
async function createRequirementHistory(
  requirementId: string,
  description: string,
  type: string,
  status: string,
  modifiedById: string
) {
  await db.requirementHistory.create({
    data: {
      requirementId,
      description,
      type: type as any,
      status: status as any,
      modifiedById,
    },
  });
}

export default async function requirementRoutes(fastify: FastifyInstance) {
  // Get all hierarchies for a project
  fastify.get(
    "/:projectId/requirements/hierarchies",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const currentUser = getUser(request);

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      // Check if user is a project member
      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const hierarchies = await db.requirementHierarchy.findMany({
        where: { projectId },
        include: {
          parent: true,
          children: {
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
    }
  );

  // Create hierarchy level
  fastify.post(
    "/:projectId/requirements/hierarchies",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        title: string;
        description?: string;
        parentId?: string | null;
      };
      const currentUser = getUser(request);

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Validate parent if provided
      if (body.parentId) {
        const parent = await db.requirementHierarchy.findUnique({
          where: { id: body.parentId },
        });
        if (!parent || parent.projectId !== projectId) {
          return reply.status(400).send({ error: "Invalid parent hierarchy" });
        }
        // Check if parent already has a parent (max 2 levels)
        if (parent.parentId !== null) {
          return reply.status(400).send({ error: "Maximum hierarchy depth is 2 levels" });
        }
      }

      // Get max order for siblings
      const maxOrder = await db.requirementHierarchy.findFirst({
        where: {
          projectId,
          parentId: body.parentId || null,
        },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const number = await generateHierarchyNumber(projectId, body.parentId || null);

      const hierarchy = await db.requirementHierarchy.create({
        data: {
          projectId,
          parentId: body.parentId || null,
          title: body.title,
          description: body.description || null,
          number,
          order: (maxOrder?.order || 0) + 1,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      return reply.status(201).send(hierarchy);
    }
  );

  // Update hierarchy level
  fastify.put(
    "/:projectId/requirements/hierarchies/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const body = request.body as {
        title?: string;
        description?: string | null;
      };
      const currentUser = getUser(request);

      const hierarchy = await db.requirementHierarchy.findUnique({
        where: { id },
      });

      if (!hierarchy || hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Hierarchy not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const updated = await db.requirementHierarchy.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      return reply.send(updated);
    }
  );

  // Delete hierarchy level
  fastify.delete(
    "/:projectId/requirements/hierarchies/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const currentUser = getUser(request);

      const hierarchy = await db.requirementHierarchy.findUnique({
        where: { id },
        include: {
          requirements: true,
          children: true,
        },
      });

      if (!hierarchy || hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Hierarchy not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Check if hierarchy has requirements or children
      if (hierarchy.requirements.length > 0 || hierarchy.children.length > 0) {
        return reply.status(400).send({
          error: "Cannot delete hierarchy with requirements or child hierarchies",
        });
      }

      await db.requirementHierarchy.delete({
        where: { id },
      });

      return reply.status(204).send();
    }
  );

  // Get all requirements for a project
  fastify.get(
    "/:projectId/requirements",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const currentUser = getUser(request);

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const requirements = await db.requirement.findMany({
        where: {
          hierarchy: {
            projectId,
          },
        },
        include: {
          hierarchy: {
            include: {
              parent: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
          lastModifiedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
        },
        orderBy: [
          { hierarchyId: "asc" },
          { order: "asc" },
        ],
      });

      return reply.send(requirements);
    }
  );

  // Create requirement
  fastify.post(
    "/:projectId/requirements",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        hierarchyId: string;
        description: string;
        type: string;
        status: string;
      };
      const currentUser = getUser(request);

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify hierarchy belongs to project
      const hierarchy = await db.requirementHierarchy.findUnique({
        where: { id: body.hierarchyId },
      });

      if (!hierarchy || hierarchy.projectId !== projectId) {
        return reply.status(400).send({ error: "Invalid hierarchy" });
      }

      // Get max order for requirements in this hierarchy
      const maxOrder = await db.requirement.findFirst({
        where: { hierarchyId: body.hierarchyId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const number = await generateRequirementNumber(body.hierarchyId);

      const requirement = await db.requirement.create({
        data: {
          hierarchyId: body.hierarchyId,
          number,
          description: body.description,
          type: body.type as any,
          status: body.status as any,
          order: (maxOrder?.order || 0) + 1,
          createdById: currentUser.userId,
          lastModifiedById: currentUser.userId,
        },
        include: {
          hierarchy: {
            include: {
              parent: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
          lastModifiedBy: {
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

      // Create history entry
      await createRequirementHistory(
        requirement.id,
        requirement.description,
        requirement.type,
        requirement.status,
        currentUser.userId
      );

      return reply.status(201).send(requirement);
    }
  );

  // Update requirement
  fastify.put(
    "/:projectId/requirements/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const body = request.body as {
        description?: string;
        type?: string;
        status?: string;
      };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Check if anything changed
      const hasChanges =
        (body.description !== undefined && body.description !== requirement.description) ||
        (body.type !== undefined && body.type !== requirement.type) ||
        (body.status !== undefined && body.status !== requirement.status);

      const updated = await db.requirement.update({
        where: { id },
        data: {
          description: body.description,
          type: body.type as any,
          status: body.status as any,
          lastModifiedById: currentUser.userId,
        },
        include: {
          hierarchy: {
            include: {
              parent: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
          lastModifiedBy: {
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

      // Create history entry if changed
      if (hasChanges) {
        await createRequirementHistory(
          id,
          updated.description,
          updated.type,
          updated.status,
          currentUser.userId
        );
      }

      return reply.send(updated);
    }
  );

  // Delete requirement
  fastify.delete(
    "/:projectId/requirements/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const hierarchyId = requirement.hierarchyId;

      await db.requirement.delete({
        where: { id },
      });

      // Renumber remaining requirements
      await renumberRequirementsInHierarchy(hierarchyId);

      return reply.status(204).send();
    }
  );

  // Move requirement to different hierarchy
  fastify.put(
    "/:projectId/requirements/:id/move",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const body = request.body as {
        hierarchyId: string;
        order?: number;
      };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify new hierarchy belongs to project
      const newHierarchy = await db.requirementHierarchy.findUnique({
        where: { id: body.hierarchyId },
      });

      if (!newHierarchy || newHierarchy.projectId !== projectId) {
        return reply.status(400).send({ error: "Invalid hierarchy" });
      }

      const oldHierarchyId = requirement.hierarchyId;

      // If order is provided, use it; otherwise append to end
      let newOrder = body.order;
      if (newOrder === undefined) {
        const maxOrder = await db.requirement.findFirst({
          where: { hierarchyId: body.hierarchyId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        newOrder = (maxOrder?.order || 0) + 1;
      }

      // Update requirement
      const updated = await db.requirement.update({
        where: { id },
        data: {
          hierarchyId: body.hierarchyId,
          order: newOrder,
          lastModifiedById: currentUser.userId,
        },
        include: {
          hierarchy: {
            include: {
              parent: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
          lastModifiedBy: {
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

      // Renumber requirements in both hierarchies
      await renumberRequirementsInHierarchy(oldHierarchyId);
      await renumberRequirementsInHierarchy(body.hierarchyId);

      // Create history entry
      await createRequirementHistory(
        id,
        updated.description,
        updated.type,
        updated.status,
        currentUser.userId
      );

      return reply.send(updated);
    }
  );

  // Bulk reorder requirements (for drag-and-drop)
  fastify.put(
    "/:projectId/requirements/reorder",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        requirementIds: string[];
        hierarchyId: string;
      };
      const currentUser = getUser(request);

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify hierarchy belongs to project
      const hierarchy = await db.requirementHierarchy.findUnique({
        where: { id: body.hierarchyId },
      });

      if (!hierarchy || hierarchy.projectId !== projectId) {
        return reply.status(400).send({ error: "Invalid hierarchy" });
      }

      // Update order for all requirements
      const updatePromises = body.requirementIds.map((reqId, index) =>
        db.requirement.update({
          where: { id: reqId },
          data: {
            order: index + 1,
            lastModifiedById: currentUser.userId,
          },
        })
      );

      await Promise.all(updatePromises);

      // Renumber requirements
      await renumberRequirementsInHierarchy(body.hierarchyId);

      return reply.status(204).send();
    }
  );

  // Get requirement history
  fastify.get(
    "/:projectId/requirements/:id/history",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const isMember = project.ProjectMember.some(
        (pm) => pm.userId === currentUser.userId
      );
      if (!isMember && project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const history = await db.requirementHistory.findMany({
        where: { requirementId: id },
        include: {
          modifiedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send(history);
    }
  );
}



