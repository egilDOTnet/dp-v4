import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/project-access";

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
        // Recursively renumber all requirements within this sub-hierarchy
        await renumberRequirementsInHierarchy(allItems[i].id, newNumber);
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

// Helper function to recursively renumber all requirements within a hierarchy
async function renumberRequirementsInHierarchy(hierarchyId: string, hierarchyNumber: string) {
  const requirements = await db.requirement.findMany({
    where: { hierarchyId },
    orderBy: { order: "asc" },
  });

  // Remove trailing period from hierarchy number for concatenation
  const hierarchyNumberBase = hierarchyNumber.endsWith('.') ? hierarchyNumber.slice(0, -1) : hierarchyNumber;

  // Renumber all requirements
  for (let i = 0; i < requirements.length; i++) {
    const newNumber = `${hierarchyNumberBase}.${i + 1}.`;
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
  /**
   * Get all hierarchies for a project
   * User must be a project member or company admin
   * Returns hierarchies with parent, children, and requirement counts
   */
  fastify.get(
    "/:projectId/requirements/hierarchies",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all requirement hierarchies for a project. User must be a project member or company administrator. Returns hierarchies with parent relationships, children, and requirement counts, ordered by parent and order.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            description: "Array of requirement hierarchies",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string };

        // Verify project access using middleware
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        request.log.info({ projectId }, "Fetching requirement hierarchies");
        
        // TEMPORARY TEST: Return hardcoded data to verify response works
        // const testData = [
        //   { id: "test1", title: "Test Hierarchy 1", projectId, order: 1 },
        //   { id: "test2", title: "Test Hierarchy 2", projectId, order: 2 }
        // ];
        // request.log.info({ testData }, "Returning test data");
        // return reply.send(testData);

        const hierarchies = await db.requirementHierarchy.findMany({
          where: { projectId },
          select: {
            id: true,
            projectId: true,
            parentId: true,
            number: true,
            title: true,
            description: true,
            order: true,
            createdAt: true,
            updatedAt: true,
            parent: {
              select: {
                id: true,
                projectId: true,
                parentId: true,
                number: true,
                title: true,
                description: true,
                order: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            children: {
              select: {
                id: true,
                projectId: true,
                parentId: true,
                number: true,
                title: true,
                description: true,
                order: true,
                createdAt: true,
                updatedAt: true,
              },
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

        request.log.info({ count: hierarchies.length, projectId, sample: hierarchies[0] }, "Found requirement hierarchies");

        if (hierarchies.length === 0) {
          request.log.warn({ projectId }, "No hierarchies found for project");
          return reply.send([]);
        }

        // Return Prisma results directly - using select ensures clean objects
        request.log.info({ 
          sendingCount: hierarchies.length,
          firstItemKeys: hierarchies[0] ? Object.keys(hierarchies[0]) : [],
          firstItemId: hierarchies[0]?.id,
          firstItemTitle: hierarchies[0]?.title
        }, "Sending hierarchies response");
        
        return reply.send(hierarchies);
      } catch (error: any) {
        request.log.error({ err: error, projectId: request.params }, "Error fetching requirement hierarchies");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "Failed to fetch hierarchies",
        });
      }
    }
  );

  /**
   * Create a hierarchy level
   * User must be a project member or company admin
   * Supports 2-level hierarchy (parent and sub-hierarchy)
   * Auto-generates hierarchy numbers and handles renumbering
   */
  fastify.post(
    "/:projectId/requirements/hierarchies",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a requirement hierarchy level. User must be a project member or company administrator. Supports 2-level hierarchy structure. Hierarchy numbers are auto-generated and existing items are renumbered as needed.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["title"],
          properties: {
            title: {
              type: "string",
              description: "Hierarchy title",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Hierarchy description",
            },
            parentId: {
              type: "string",
              nullable: true,
              description: "Parent hierarchy ID (for level 2 hierarchies, null for level 1)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Created hierarchy with auto-generated number",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid parent hierarchy",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        title: string;
        description?: string;
        parentId?: string | null;
      };

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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
        // Recursively renumber all children of this level 1 hierarchy
        await renumberItemsInHierarchy(allLevel1Hierarchies[i].id);
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

  /**
   * Update hierarchy level
   * User must be a project member or company admin
   * Updates title and description
   */
  fastify.put(
    "/:projectId/requirements/hierarchies/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a requirement hierarchy level. User must be a project member or company administrator. Updates title and description.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Hierarchy ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            title: {
              type: "string",
              nullable: true,
              description: "Hierarchy title",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Hierarchy description",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Updated hierarchy",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or hierarchy not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };
      const body = request.body as {
        title?: string;
        description?: string | null;
      };

      const hierarchy = await db.requirementHierarchy.findUnique({
        where: { id },
      });

      if (!hierarchy || hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Hierarchy not found" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Delete hierarchy level
   * User must be a project member or company admin
   * Cannot delete if hierarchy has requirements or children
   * Handles renumbering of remaining items
   */
  fastify.delete(
    "/:projectId/requirements/hierarchies/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a requirement hierarchy level. User must be a project member or company administrator. Cannot delete if the hierarchy has requirements or child hierarchies. Remaining items are renumbered after deletion.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Hierarchy ID",
            },
          },
        },
        response: {
          204: {
            description: "Hierarchy deleted successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Cannot delete hierarchy with requirements or children",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or hierarchy not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };

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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Bulk reorder hierarchies (for drag-and-drop)
   * User must be a project member or company admin
   * Updates order and regenerates numbers for all affected hierarchies
   */
  fastify.put(
    "/:projectId/requirements/hierarchies/reorder",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk reorder requirement hierarchies (for drag-and-drop). User must be a project member or company administrator. Updates order for all specified hierarchies and regenerates numbers accordingly.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["hierarchyIds"],
          properties: {
            hierarchyIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of hierarchy IDs in the desired order",
            },
            parentId: {
              type: "string",
              nullable: true,
              description: "Parent hierarchy ID (for level 2 hierarchies, null for level 1)",
            },
          },
        },
        response: {
          204: {
            description: "Hierarchies reordered successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid hierarchy IDs",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        hierarchyIds: string[];
        parentId?: string | null;
      };

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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
          // Recursively renumber all children of this level 1 hierarchy
          await renumberItemsInHierarchy(level1Hierarchies[i].id);
        }
      } else {
        // For level 2 hierarchies, renumber items in the parent
        await renumberItemsInHierarchy(body.parentId);
      }

      return reply.status(204).send();
    }
  );

  /**
   * Get all requirements for a project
   * User must be a project member or company admin
   * Returns requirements with hierarchy information
   */
  fastify.get(
    "/:projectId/requirements",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all requirements for a project. User must be a project member or company administrator. Returns requirements with their hierarchy information.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            description: "Array of requirements",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string };

        // Verify project access using middleware
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        request.log.info({ projectId }, "Fetching requirements");

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

        request.log.info({ count: requirements.length, projectId, sample: requirements[0] }, "Found requirements");

        if (requirements.length === 0) {
          request.log.warn({ projectId }, "No requirements found for project");
          return reply.send([]);
        }

        // Return Prisma results directly - using select ensures clean objects
        request.log.info({ 
          sendingCount: requirements.length,
          firstItemKeys: requirements[0] ? Object.keys(requirements[0]) : [],
          firstItemId: requirements[0]?.id,
          firstItemDescription: requirements[0]?.description?.substring(0, 50)
        }, "Sending requirements response");
        
        return reply.send(requirements);
      } catch (error: any) {
        request.log.error({ err: error, projectId: request.params }, "Error fetching requirements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "Failed to fetch requirements",
        });
      }
    }
  );

  /**
   * Create requirement
   * User must be a project member or company admin
   * Auto-generates requirement number and handles renumbering
   */
  fastify.post(
    "/:projectId/requirements",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a requirement. User must be a project member or company administrator. Requirement numbers are auto-generated and existing items are renumbered as needed.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["hierarchyId", "description", "type"],
          properties: {
            hierarchyId: {
              type: "string",
              description: "Hierarchy ID to attach requirement to",
            },
            description: {
              type: "string",
              description: "Requirement description",
            },
            type: {
              type: "string",
              description: "Requirement type",
            },
            status: {
              type: "string",
              nullable: true,
              description: "Requirement status (optional)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Created requirement with auto-generated number",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid hierarchy",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        hierarchyId: string;
        description: string;
        type: string;
        status?: string | null;
      };
      const currentUser = getUser(request);

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  /**
   * Update requirement
   * User must be a project member or company admin
   * Creates history entry for changes
   */
  fastify.put(
    "/:projectId/requirements/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a requirement. User must be a project member or company administrator. Creates a history entry for any changes made.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Requirement ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            description: {
              type: "string",
              nullable: true,
              description: "Requirement description",
            },
            type: {
              type: "string",
              nullable: true,
              description: "Requirement type",
            },
            status: {
              type: "string",
              nullable: true,
              description: "Requirement status (cannot change from non-null to null)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Updated requirement",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or requirement not found",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Delete requirement
   * User must be a project member or company admin
   * Handles renumbering of remaining items
   */
  fastify.delete(
    "/:projectId/requirements/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a requirement. User must be a project member or company administrator. Remaining items in the hierarchy are renumbered after deletion.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Requirement ID",
            },
          },
        },
        response: {
          204: {
            description: "Requirement deleted successfully",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or requirement not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

      const hierarchyId = requirement.hierarchyId;

      await db.requirement.delete({
        where: { id },
      });

      // Renumber remaining requirements
      await renumberItemsInHierarchy(hierarchyId);

      return reply.status(204).send();
    }
  );

  /**
   * Move requirement to different hierarchy
   * User must be a project member or company admin
   * Handles renumbering in both old and new hierarchies
   */
  fastify.put(
    "/:projectId/requirements/:id/move",
    {
      preHandler: [authenticate],
      schema: {
        description: "Move a requirement to a different hierarchy. User must be a project member or company administrator. Handles renumbering in both the old and new hierarchies.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Requirement ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["hierarchyId"],
          properties: {
            hierarchyId: {
              type: "string",
              description: "New hierarchy ID to move requirement to",
            },
            order: {
              type: "number",
              nullable: true,
              description: "Order position in new hierarchy (defaults to end)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Moved requirement with updated number",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid hierarchy",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or requirement not found",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Bulk reorder requirements (for drag-and-drop)
   * User must be a project member or company admin
   * Updates order and regenerates numbers
   */
  fastify.put(
    "/:projectId/requirements/reorder",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk reorder requirements (for drag-and-drop). User must be a project member or company administrator. Updates order for all specified requirements and regenerates numbers accordingly.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["requirementIds", "hierarchyId"],
          properties: {
            requirementIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of requirement IDs in the desired order",
            },
            hierarchyId: {
              type: "string",
              description: "Hierarchy ID containing the requirements",
            },
          },
        },
        response: {
          204: {
            description: "Requirements reordered successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid requirement IDs or hierarchy",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        requirementIds: string[];
        hierarchyId: string;
      };
      const currentUser = getUser(request);

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Get requirement history
   * User must be a project member or company admin
   * Returns change history with modifier information
   */
  fastify.get(
    "/:projectId/requirements/:id/history",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get change history for a requirement. User must be a project member or company administrator. Returns history entries with information about who made the changes.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId", "id"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
            id: {
              type: "string",
              description: "Requirement ID",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              description: "Requirement history entry with modifier information",
            },
            description: "Array of requirement history entries",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or requirement not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, id } = request.params as { projectId: string; id: string };

      const requirement = await db.requirement.findUnique({
        where: { id },
        include: {
          hierarchy: true,
        },
      });

      if (!requirement || requirement.hierarchy.projectId !== projectId) {
        return reply.status(404).send({ error: "Requirement not found" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Bulk update requirements
   * User must be a project member or company admin
   * Updates multiple requirements and handles renumbering if moved
   */
  fastify.put(
    "/:projectId/requirements/bulk-update",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk update multiple requirements. User must be a project member or company administrator. Can update type, status, or move requirements to a different hierarchy. Handles renumbering if requirements are moved.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["requirementIds"],
          properties: {
            requirementIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of requirement IDs to update",
            },
            type: {
              type: "string",
              nullable: true,
              description: "New type for all requirements",
            },
            status: {
              type: "string",
              nullable: true,
              description: "New status for all requirements",
            },
            hierarchyId: {
              type: "string",
              nullable: true,
              description: "New hierarchy ID to move all requirements to",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              description: "Updated requirement with full relations",
            },
            description: "Array of updated requirements",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid requirement/hierarchy IDs",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        requirementIds: string[];
        type?: string;
        status?: string | null;
        hierarchyId?: string;
      };
      const currentUser = getUser(request);

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

      // Verify all requirements belong to project
      const requirements = await db.requirement.findMany({
        where: {
          id: { in: body.requirementIds },
          hierarchy: {
            projectId,
          },
        },
        include: {
          hierarchy: true,
        },
      });

      if (requirements.length !== body.requirementIds.length) {
        return reply.status(400).send({ error: "Invalid requirement IDs" });
      }

      // Validate hierarchyId if provided
      let newHierarchyId: string | undefined;
      if (body.hierarchyId !== undefined) {
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: body.hierarchyId },
        });

        if (!hierarchy || hierarchy.projectId !== projectId) {
          return reply.status(400).send({ error: "Invalid hierarchy" });
        }
        newHierarchyId = body.hierarchyId;
      }

      // Normalize empty string to null for status
      const normalizedStatus = body.status !== undefined 
        ? (body.status === "" || body.status === null ? null : body.status)
        : undefined;

      // Prepare update data
      const updateData: {
        type?: any;
        status?: any;
        hierarchyId?: string;
        lastModifiedById: string;
      } = {
        lastModifiedById: currentUser.userId,
      };

      if (body.type !== undefined) {
        updateData.type = body.type as any;
      }
      if (normalizedStatus !== undefined) {
        updateData.status = normalizedStatus as any;
      }
      if (newHierarchyId !== undefined) {
        updateData.hierarchyId = newHierarchyId;
      }

      // Track old hierarchy IDs for renumbering
      const oldHierarchyIds = new Set<string>();
      requirements.forEach((req) => {
        oldHierarchyIds.add(req.hierarchyId);
      });

      // If moving to new hierarchy, calculate starting order
      let nextOrder = 1;
      if (newHierarchyId) {
        const maxOrder = await db.requirement.findFirst({
          where: { hierarchyId: newHierarchyId },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        nextOrder = (maxOrder?.order || 0) + 1;
      }

      // Update all requirements sequentially to maintain order
      const updatedRequirements = [];
      for (let index = 0; index < body.requirementIds.length; index++) {
        const reqId = body.requirementIds[index];
        const requirement = requirements.find((r) => r.id === reqId);
        if (!requirement) continue;

        // Prepare update data for this requirement
        const reqUpdateData: {
          type?: any;
          status?: any;
          hierarchyId?: string;
          order?: number;
          lastModifiedById: string;
        } = {
          lastModifiedById: currentUser.userId,
        };

        if (body.type !== undefined) {
          reqUpdateData.type = body.type as any;
        }
        if (normalizedStatus !== undefined) {
          reqUpdateData.status = normalizedStatus as any;
        }
        if (newHierarchyId && newHierarchyId !== requirement.hierarchyId) {
          reqUpdateData.hierarchyId = newHierarchyId;
          reqUpdateData.order = nextOrder + index;
        }

        const updated = await db.requirement.update({
          where: { id: reqId },
          data: reqUpdateData,
        });

        // Create history entry if changed
        const hasChanges =
          (body.type !== undefined && body.type !== requirement.type) ||
          (normalizedStatus !== undefined && normalizedStatus !== requirement.status) ||
          (newHierarchyId !== undefined && newHierarchyId !== requirement.hierarchyId);

        if (hasChanges) {
          await createRequirementHistory(
            reqId,
            updated.description,
            updated.type,
            updated.status,
            currentUser.userId
          );
        }

        updatedRequirements.push(updated);
      }

      // Renumber items in affected hierarchies
      const allHierarchyIds = new Set([...oldHierarchyIds]);
      if (newHierarchyId) {
        allHierarchyIds.add(newHierarchyId);
      }

      for (const hierarchyId of allHierarchyIds) {
        await renumberItemsInHierarchy(hierarchyId);
      }

      // Return updated requirements with full relations
      const finalRequirements = await db.requirement.findMany({
        where: {
          id: { in: body.requirementIds },
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

      return reply.send(finalRequirements);
    }
  );

  /**
   * Bulk delete requirements
   * User must be a project member or company admin
   * Deletes multiple requirements and handles renumbering
   */
  fastify.delete(
    "/:projectId/requirements/bulk-delete",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk delete multiple requirements. User must be a project member or company administrator. Deletes all specified requirements and renumbers remaining items in affected hierarchies.",
        tags: ["requirements"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["requirementIds"],
          properties: {
            requirementIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of requirement IDs to delete",
            },
          },
        },
        response: {
          204: {
            description: "Requirements deleted successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid requirement IDs",
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
            description: "Access denied - not a project member",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project not found",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        requirementIds: string[];
      };

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

      // Verify all requirements belong to project and get their hierarchy IDs
      const requirements = await db.requirement.findMany({
        where: {
          id: { in: body.requirementIds },
          hierarchy: {
            projectId,
          },
        },
        include: {
          hierarchy: true,
        },
      });

      if (requirements.length !== body.requirementIds.length) {
        return reply.status(400).send({ error: "Invalid requirement IDs" });
      }

      // Track hierarchy IDs for renumbering
      const hierarchyIds = new Set<string>();
      requirements.forEach((req) => {
        hierarchyIds.add(req.hierarchyId);
      });

      // Delete all requirements
      await db.requirement.deleteMany({
        where: {
          id: { in: body.requirementIds },
        },
      });

      // Renumber items in affected hierarchies
      for (const hierarchyId of hierarchyIds) {
        await renumberItemsInHierarchy(hierarchyId);
      }

      return reply.status(204).send();
    }
  );
}



