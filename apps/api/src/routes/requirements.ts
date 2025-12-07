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
    return `${count + 1}.`;
  } else {
    // Level 2 hierarchy - get parent number and count both siblings and requirements
    const parent = await db.requirementHierarchy.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new Error("Parent hierarchy not found");
    }
    
    // Count both sub-hierarchies and requirements under the parent
    const siblingHierarchyCount = await db.requirementHierarchy.count({
      where: {
        projectId,
        parentId,
      },
    });
    
    const requirementCount = await db.requirement.count({
      where: {
        hierarchyId: parentId,
      },
    });
    
    // Remove trailing period from parent number for concatenation
    const parentNumberBase = parent.number.endsWith('.') ? parent.number.slice(0, -1) : parent.number;
    const totalCount = siblingHierarchyCount + requirementCount;
    return `${parentNumberBase}.${totalCount + 1}.`;
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

  // Count both sub-hierarchies and requirements under the parent hierarchy
  const subHierarchyCount = await db.requirementHierarchy.count({
    where: {
      parentId: hierarchyId,
    },
  });
  
  const requirementCount = await db.requirement.count({
    where: { hierarchyId },
  });

  // Remove trailing period from hierarchy number for concatenation
  const hierarchyNumberBase = hierarchy.number.endsWith('.') ? hierarchy.number.slice(0, -1) : hierarchy.number;
  const totalCount = subHierarchyCount + requirementCount;
  return `${hierarchyNumberBase}.${totalCount + 1}.`;
}

// Helper function to renumber all items (requirements and sub-hierarchies) in a hierarchy
async function renumberItemsInHierarchy(hierarchyId: string) {
  const hierarchy = await db.requirementHierarchy.findUnique({
    where: { id: hierarchyId },
    include: {
      children: {
        orderBy: { order: "asc" },
      },
      requirements: {
        orderBy: { order: "asc" },
      },
    },
  });
  if (!hierarchy) return;

  // Remove trailing period from hierarchy number for concatenation
  const hierarchyNumberBase = hierarchy.number.endsWith('.') ? hierarchy.number.slice(0, -1) : hierarchy.number;

  // Combine children and requirements, sorted by order
  const allItems: Array<{ id: string; order: number; type: 'hierarchy' | 'requirement' }> = [
    ...hierarchy.children.map((h) => ({ id: h.id, order: h.order, type: 'hierarchy' as const })),
    ...hierarchy.requirements.map((r) => ({ id: r.id, order: r.order, type: 'requirement' as const })),
  ].sort((a, b) => a.order - b.order);

  // Renumber all items (both number and order)
  for (let i = 0; i < allItems.length; i++) {
    const newNumber = `${hierarchyNumberBase}.${i + 1}.`;
    const newOrder = i + 1;
    
    if (allItems[i].type === 'hierarchy') {
      const child = hierarchy.children.find((c) => c.id === allItems[i].id);
      if (child && (child.number !== newNumber || child.order !== newOrder)) {
        await db.requirementHierarchy.update({
          where: { id: allItems[i].id },
          data: { number: newNumber, order: newOrder },
        });
      }
    } else {
      const requirement = hierarchy.requirements.find((r) => r.id === allItems[i].id);
      if (requirement && (requirement.number !== newNumber || requirement.order !== newOrder)) {
        await db.requirement.update({
          where: { id: allItems[i].id },
          data: { number: newNumber, order: newOrder },
        });
      }
    }
  }
}

// Helper function to create requirement history entry
async function createRequirementHistory(
  requirementId: string,
  description: string,
  type: string,
  status: string | null,
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

      // Get max order considering both sub-hierarchies and requirements
      let maxOrder = 0;
      if (body.parentId) {
        // For sub-hierarchies, check both sub-hierarchies and requirements
        const maxHierarchyOrder = await db.requirementHierarchy.findFirst({
          where: {
            projectId,
            parentId: body.parentId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        const maxRequirementOrder = await db.requirement.findFirst({
          where: {
            hierarchyId: body.parentId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        maxOrder = Math.max(
          maxHierarchyOrder?.order || 0,
          maxRequirementOrder?.order || 0
        );
      } else {
        // For level 1 hierarchies, just check other level 1 hierarchies
        const maxHierarchyOrder = await db.requirementHierarchy.findFirst({
          where: {
            projectId,
            parentId: null,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        maxOrder = maxHierarchyOrder?.order || 0;
      }

      const number = await generateHierarchyNumber(projectId, body.parentId || null);

      const hierarchy = await db.requirementHierarchy.create({
        data: {
          projectId,
          parentId: body.parentId || null,
          title: body.title,
          description: body.description || null,
          number,
          order: (maxOrder || 0) + 1,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      // If this is a sub-hierarchy, renumber all items in the parent
      if (body.parentId) {
        await renumberItemsInHierarchy(body.parentId);
        // Reload hierarchy with updated number
        const updatedHierarchy = await db.requirementHierarchy.findUnique({
          where: { id: hierarchy.id },
          include: {
            parent: true,
            children: true,
          },
        });
        return reply.status(201).send(updatedHierarchy || hierarchy);
      }

      // If this is a level 1 hierarchy, renumber all level 1 hierarchies based on order
      const allLevel1Hierarchies = await db.requirementHierarchy.findMany({
        where: {
          projectId,
          parentId: null,
        },
        orderBy: { order: "asc" },
      });

      for (let i = 0; i < allLevel1Hierarchies.length; i++) {
        const newNumber = `${i + 1}.`;
        if (allLevel1Hierarchies[i].number !== newNumber) {
          await db.requirementHierarchy.update({
            where: { id: allLevel1Hierarchies[i].id },
            data: { number: newNumber },
          });
        }
      }

      // Reload hierarchy with updated number
      const updatedHierarchy = await db.requirementHierarchy.findUnique({
        where: { id: hierarchy.id },
        include: {
          parent: true,
          children: true,
        },
      });

      return reply.status(201).send(updatedHierarchy || hierarchy);
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

      const parentId = hierarchy.parentId;
      
      await db.requirementHierarchy.delete({
        where: { id },
      });

      // Renumber remaining items if this was a sub-hierarchy
      if (parentId) {
        await renumberItemsInHierarchy(parentId);
      }

      return reply.status(204).send();
    }
  );

  // Bulk reorder hierarchies (for drag-and-drop)
  fastify.put(
    "/:projectId/requirements/hierarchies/reorder",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        hierarchyIds: string[];
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

      // Verify all hierarchies belong to project and have the correct parentId
      const hierarchies = await db.requirementHierarchy.findMany({
        where: {
          id: { in: body.hierarchyIds },
          projectId,
          parentId: body.parentId === undefined ? undefined : (body.parentId || null),
        },
      });

      if (hierarchies.length !== body.hierarchyIds.length) {
        return reply.status(400).send({ error: "Invalid hierarchy IDs" });
      }

      // Update order for all hierarchies
      const updatePromises = body.hierarchyIds.map((hierarchyId, index) =>
        db.requirementHierarchy.update({
          where: { id: hierarchyId },
          data: {
            order: index + 1,
          },
        })
      );

      await Promise.all(updatePromises);

      // Regenerate numbers for all reordered hierarchies
      // For level 1 hierarchies, regenerate all numbers
      if (!body.parentId) {
        const level1Hierarchies = await db.requirementHierarchy.findMany({
          where: {
            projectId,
            parentId: null,
          },
          orderBy: { order: "asc" },
        });

        for (let i = 0; i < level1Hierarchies.length; i++) {
          const newNumber = `${i + 1}.`;
          if (level1Hierarchies[i].number !== newNumber) {
            await db.requirementHierarchy.update({
              where: { id: level1Hierarchies[i].id },
              data: { number: newNumber },
            });
          }
        }
      } else {
        // For level 2 hierarchies, renumber items in the parent
        await renumberItemsInHierarchy(body.parentId);
      }

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
        status?: string | null;
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

      // Get max order considering both requirements and sub-hierarchies
      const maxRequirementOrder = await db.requirement.findFirst({
        where: { hierarchyId: body.hierarchyId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const maxHierarchyOrder = await db.requirementHierarchy.findFirst({
        where: {
          parentId: body.hierarchyId,
        },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      const maxOrder = Math.max(
        maxRequirementOrder?.order || 0,
        maxHierarchyOrder?.order || 0
      );

      const number = await generateRequirementNumber(body.hierarchyId);

      const requirement = await db.requirement.create({
        data: {
          hierarchyId: body.hierarchyId,
          number,
          description: body.description,
          type: body.type as any,
          status: (body.status || null) as any,
          order: (maxOrder || 0) + 1,
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

      // Renumber all items in the hierarchy (requirements and sub-hierarchies)
      await renumberItemsInHierarchy(body.hierarchyId);
      
      // Reload requirement with updated number
      const updatedRequirement = await db.requirement.findUnique({
        where: { id: requirement.id },
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

      return reply.status(201).send(updatedRequirement || requirement);
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
        status?: string | null;
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

      // Normalize empty string to null for status
      const normalizedStatus = body.status !== undefined 
        ? (body.status === "" || body.status === null ? null : body.status)
        : undefined;

      // Validate: if status is currently non-null, prevent changing back to null
      if (
        normalizedStatus !== undefined &&
        requirement.status !== null &&
        normalizedStatus === null
      ) {
        return reply.status(400).send({
          error: "Cannot change status from a set value back to blank. Status must remain set once assigned.",
        });
      }

      // Check if anything changed
      const hasChanges =
        (body.description !== undefined && body.description !== requirement.description) ||
        (body.type !== undefined && body.type !== requirement.type) ||
        (normalizedStatus !== undefined && normalizedStatus !== requirement.status);

      const updateData: {
        description?: string;
        type?: any;
        status?: any;
        lastModifiedById: string;
      } = {
        lastModifiedById: currentUser.userId,
      };

      if (body.description !== undefined) {
        updateData.description = body.description;
      }
      if (body.type !== undefined) {
        updateData.type = body.type as any;
      }
      if (normalizedStatus !== undefined) {
        updateData.status = normalizedStatus as any;
      }

      const updated = await db.requirement.update({
        where: { id },
        data: updateData,
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
      await renumberItemsInHierarchy(hierarchyId);

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

      // Renumber items in both hierarchies
      await renumberItemsInHierarchy(oldHierarchyId);
      await renumberItemsInHierarchy(body.hierarchyId);

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

      // Renumber all items (requirements and sub-hierarchies)
      await renumberItemsInHierarchy(body.hierarchyId);

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

  // Get requirement comments
  fastify.get(
    "/:projectId/requirements/:requirementId/comments",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, requirementId } = request.params as { projectId: string; requirementId: string };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id: requirementId },
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

      const comments = await db.requirementComment.findMany({
        where: { requirementId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return reply.send(comments);
    }
  );

  // Create requirement comment
  fastify.post(
    "/:projectId/requirements/:requirementId/comments",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, requirementId } = request.params as { projectId: string; requirementId: string };
      const body = request.body as {
        content: string;
      };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id: requirementId },
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

      const comment = await db.requirementComment.create({
        data: {
          requirementId,
          userId: currentUser.userId,
          content: body.content,
        },
        include: {
          user: {
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

      return reply.status(201).send(comment);
    }
  );

  // Update requirement comment
  fastify.put(
    "/:projectId/requirements/:requirementId/comments/:commentId",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, requirementId, commentId } = request.params as { 
        projectId: string; 
        requirementId: string; 
        commentId: string;
      };
      const body = request.body as {
        content?: string;
        isResolved?: boolean;
      };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id: requirementId },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      const comment = await db.requirementComment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.requirementId !== requirementId) {
        return reply.status(404).send({ error: "Comment not found" });
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

      // Only allow comment owner to update content
      if (body.content !== undefined && comment.userId !== currentUser.userId) {
        return reply.status(403).send({ error: "You can only edit your own comments" });
      }

      // Only allow admins to update isResolved status
      const isAdmin = currentUser.role === "CompanyAdministrator" || currentUser.role === "GlobalAdministrator";
      if (body.isResolved !== undefined && !isAdmin) {
        return reply.status(403).send({ error: "Only administrators can resolve comments" });
      }

      const updateData: { content?: string; isResolved?: boolean } = {};
      if (body.content !== undefined) {
        updateData.content = body.content;
      }
      if (body.isResolved !== undefined) {
        updateData.isResolved = body.isResolved;
      }

      const updated = await db.requirementComment.update({
        where: { id: commentId },
        data: updateData,
        include: {
          user: {
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

      return reply.send(updated);
    }
  );

  // Delete requirement comment
  fastify.delete(
    "/:projectId/requirements/:requirementId/comments/:commentId",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, requirementId, commentId } = request.params as { 
        projectId: string; 
        requirementId: string; 
        commentId: string;
      };
      const currentUser = getUser(request);

      const requirement = await db.requirement.findUnique({
        where: { id: requirementId },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      const comment = await db.requirementComment.findUnique({
        where: { id: commentId },
      });

      if (!comment || comment.requirementId !== requirementId) {
        return reply.status(404).send({ error: "Comment not found" });
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

      // Only allow comment owner or admin to delete
      const isAdmin = currentUser.role === "CompanyAdministrator" || currentUser.role === "GlobalAdministrator";
      if (comment.userId !== currentUser.userId && !isAdmin) {
        return reply.status(403).send({ error: "You can only delete your own comments" });
      }

      await db.requirementComment.delete({
        where: { id: commentId },
      });

      return reply.status(204).send();
    }
  );
}



