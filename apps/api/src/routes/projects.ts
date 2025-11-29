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

// Phase names in English
const PHASE_NAMES = [
  "Overall customer requirements",
  "Map suppliers",
  "Conduct RFI",
  "Detailed customer requirements",
  "Develop request",
  "Supplier follow-up",
  "Evaluation of offers",
  "Negotiations",
  "Decision basis",
];

// Default tasks for each phase
const DEFAULT_TASKS: Record<number, string[]> = {
  1: [
    "Identify key stakeholders",
    "Conduct initial stakeholder interviews",
    "Document high-level business objectives",
    "Define project scope and boundaries",
    "Identify compliance and regulatory requirements",
    "Document current state assessment",
    "Identify pain points and improvement areas",
    "Define success criteria",
    "Create requirements gathering plan",
    "Review industry best practices",
    "Document functional requirements overview",
    "Document non-functional requirements overview",
    "Identify integration requirements",
    "Define security requirements",
    "Document scalability requirements",
  ],
  2: [
    "Research potential suppliers",
    "Create supplier database",
    "Categorize suppliers by capability",
    "Assess supplier market presence",
    "Review supplier financial stability",
    "Check supplier references",
    "Evaluate supplier technical capabilities",
    "Assess supplier geographic coverage",
    "Review supplier certifications",
    "Document supplier contact information",
    "Create supplier evaluation criteria",
    "Prioritize supplier list",
    "Identify preferred suppliers",
    "Document supplier mapping results",
  ],
  3: [
    "Prepare RFI document template",
    "Define RFI scope and objectives",
    "List information requirements",
    "Create supplier response format",
    "Distribute RFI to suppliers",
    "Set RFI submission deadline",
    "Answer supplier questions",
    "Collect RFI responses",
    "Review RFI responses",
    "Evaluate supplier capabilities",
    "Identify qualified suppliers",
    "Document RFI findings",
    "Create RFI summary report",
    "Share RFI results with stakeholders",
  ],
  4: [
    "Conduct detailed requirements workshops",
    "Document functional requirements in detail",
    "Document non-functional requirements in detail",
    "Define user stories and use cases",
    "Document data requirements",
    "Define reporting requirements",
    "Document workflow requirements",
    "Define user interface requirements",
    "Document API and integration requirements",
    "Define performance requirements",
    "Document security and compliance requirements",
    "Create requirements traceability matrix",
    "Validate requirements with stakeholders",
    "Get requirements approval",
    "Document change management requirements",
  ],
  5: [
    "Prepare RFP/RFQ document",
    "Define evaluation criteria",
    "Create pricing structure template",
    "Define submission requirements",
    "Prepare technical specifications",
    "Create commercial terms template",
    "Define timeline and milestones",
    "Prepare supplier briefing materials",
    "Schedule supplier briefing session",
    "Distribute request to suppliers",
    "Set submission deadline",
    "Answer supplier questions",
    "Provide clarifications",
    "Monitor submission progress",
    "Collect submissions",
  ],
  6: [
    "Acknowledge receipt of submissions",
    "Verify submission completeness",
    "Schedule supplier presentations",
    "Conduct supplier presentations",
    "Organize site visits if needed",
    "Request additional information",
    "Clarify technical questions",
    "Clarify commercial questions",
    "Document supplier responses",
    "Follow up on missing information",
    "Update supplier status",
    "Maintain communication log",
    "Schedule follow-up meetings",
  ],
  7: [
    "Review all submissions",
    "Evaluate technical proposals",
    "Evaluate commercial proposals",
    "Score proposals against criteria",
    "Conduct technical evaluation",
    "Conduct commercial evaluation",
    "Assess risk factors",
    "Compare supplier proposals",
    "Identify top candidates",
    "Document evaluation results",
    "Create evaluation summary",
    "Present findings to stakeholders",
    "Get evaluation approval",
    "Prepare shortlist",
  ],
  8: [
    "Prepare negotiation strategy",
    "Identify negotiation priorities",
    "Schedule negotiation meetings",
    "Conduct commercial negotiations",
    "Negotiate contract terms",
    "Negotiate service levels",
    "Negotiate pricing and payment terms",
    "Document negotiation outcomes",
    "Resolve open issues",
    "Finalize contract terms",
    "Get internal approvals",
    "Prepare contract documents",
    "Review contract with legal team",
  ],
  9: [
    "Compile decision documentation",
    "Prepare executive summary",
    "Document recommendation rationale",
    "Prepare cost-benefit analysis",
    "Document risk assessment",
    "Prepare implementation timeline",
    "Document resource requirements",
    "Prepare presentation materials",
    "Schedule decision meeting",
    "Present recommendation to decision makers",
    "Address questions and concerns",
    "Get decision approval",
    "Document final decision",
    "Communicate decision to stakeholders",
  ],
};

async function initializeProjectPhases(projectId: string) {
  const phases = [];
  
  for (let i = 0; i < PHASE_NAMES.length; i++) {
    const phase = await db.phase.create({
      data: {
        projectId,
        name: PHASE_NAMES[i],
        order: i + 1,
        Task: {
          create: DEFAULT_TASKS[i + 1].map((taskName, taskIndex) => ({
            name: taskName,
            order: taskIndex + 1,
          })),
        },
      },
      include: {
        Task: true,
      },
    });
    phases.push(phase);
  }
  
  return phases;
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
              Project: {
                include: {
                  Tenant: true,
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
            ProjectMember: {
              include: {
                User: {
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
            ProjectMember: {
              include: {
                User: {
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
          members: "ProjectMember" in p && p.ProjectMember ? p.ProjectMember.map((m: any) => {
            const user = m.User as { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null };
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
          ProjectMember: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          Tenant: true,
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
        members: project.ProjectMember.map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
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
          ProjectMember: {
            create: body.memberIds?.map((userId) => ({
              userId,
            })) || [],
          },
        },
        include: {
          ProjectMember: {
            include: {
              User: {
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

      // Initialize phases and tasks for the new project
      await initializeProjectPhases(project.id);

      return reply.status(201).send({
        id: project.id,
        name: project.name,
        type: project.type,
        startDate: project.startDate,
        endDate: project.endDate,
        tenantId: project.tenantId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        members: project.ProjectMember.map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
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
        include: { ProjectMember: true },
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
      const existingMemberIds = project.ProjectMember.map((m) => m.userId);
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
        members: updatedProject.ProjectMember.map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
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

  // Remove members from project
  fastify.delete<{ Params: { id: string }; Body: { memberIds: string[] } }>(
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

      const body = request.body;
      if (!body.memberIds || !Array.isArray(body.memberIds) || body.memberIds.length === 0) {
        return reply.status(400).send({ error: "memberIds array is required" });
      }

      // Verify project exists and belongs to same tenant
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      if (project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Get current project members with their user roles
      const currentMembers = await db.projectMember.findMany({
        where: { projectId },
        include: {
          user: {
            select: {
              id: true,
              role: true,
            },
          },
        },
      });

      // Check if any of the members being removed are admins
      const membersToRemove = currentMembers.filter((m) => body.memberIds.includes(m.userId));
      const adminMembersToRemove = membersToRemove.filter(
        (m) => m.user.role === "CompanyAdministrator" || m.user.role === "GlobalAdministrator"
      );

      // Count remaining admin members after removal
      const remainingAdminMembers = currentMembers.filter(
        (m) =>
          !body.memberIds.includes(m.userId) &&
          (m.user.role === "CompanyAdministrator" || m.user.role === "GlobalAdministrator")
      );

      // Prevent removal if it would leave no admin members
      if (adminMembersToRemove.length > 0 && remainingAdminMembers.length === 0) {
        return reply.status(400).send({
          error: "Cannot remove the last company administrator from the project. A project must have at least one administrator.",
        });
      }

      // Remove members
      await db.projectMember.deleteMany({
        where: {
          projectId,
          userId: { in: body.memberIds },
        },
      });

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
        members: updatedProject.ProjectMember.map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
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

  // Get all phases for a project with task counts and status
  fastify.get(
    "/:id/phases",
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const projectId = request.params.id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project exists and user has access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Get all phases with tasks
      const phases = await db.phase.findMany({
        where: { projectId },
        include: {
          Task: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      });

      // Calculate status for each phase
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const phasesWithStatus = phases.map((phase) => {
        const tasks = phase.Task;
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.actualCompletionDate !== null).length;
        
        let status: "not_started" | "ongoing" | "delayed" | "completed" = "not_started";
        
        // Check for delayed tasks first (plannedCompletionDate < today AND not completed)
        const hasDelayedTask = tasks.some((task) => {
          if (task.actualCompletionDate !== null) return false; // Completed tasks are not delayed
          if (!task.plannedCompletionDate) return false;
          
          const plannedDate = new Date(task.plannedCompletionDate);
          const plannedDateOnly = new Date(plannedDate.getFullYear(), plannedDate.getMonth(), plannedDate.getDate());
          return plannedDateOnly < today;
        });
        
        if (hasDelayedTask) {
          status = "delayed";
        } else if (completedTasks === totalTasks && totalTasks > 0) {
          status = "completed";
        } else if (completedTasks > 0) {
          status = "ongoing";
        } else {
          status = "not_started";
        }

        return {
          id: phase.id,
          projectId: phase.projectId,
          name: phase.name,
          order: phase.order,
          status,
          taskCount: totalTasks,
          completedTaskCount: completedTasks,
          createdAt: phase.createdAt,
          updatedAt: phase.updatedAt,
        };
      });

      return reply.send(phasesWithStatus);
    }
  );

  // Get tasks for a specific phase
  fastify.get(
    "/:id/phases/:phaseId/tasks",
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string; phaseId: string } }>, reply: FastifyReply) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project exists and user has access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify phase belongs to project
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
      });

      if (!phase || phase.projectId !== projectId) {
        return reply.status(404).send({ error: "Phase not found" });
      }

      // Get tasks for the phase
      try {
        // First, try to fetch tasks with owner relation
        let tasks;
        try {
          tasks = await db.task.findMany({
            where: { phaseId },
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { order: "asc" },
          });
        } catch (includeError: any) {
          // If include fails, fetch without owner and get owners separately
          request.log.warn("Failed to include owner, fetching separately:", includeError.message);
          tasks = await db.task.findMany({
            where: { phaseId },
            orderBy: { order: "asc" },
          });
          
          // Fetch owners separately if any tasks have ownerId
          const ownerIds = tasks.filter(t => t.ownerId).map(t => t.ownerId).filter((id): id is string => id !== null);
          const owners = ownerIds.length > 0 
            ? await db.user.findMany({
                where: { id: { in: ownerIds } },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              })
            : [];
          
          const ownerMap = new Map(owners.map(o => [o.id, o]));
          
          // Attach owners to tasks
          tasks = tasks.map((task: any) => ({
            ...task,
            owner: task.ownerId ? ownerMap.get(task.ownerId) || null : null,
          }));
        }

        return reply.send(
          tasks.map((task: any) => {
            // Handle owner relation - it might be undefined if relation doesn't exist yet
            let ownerData = null;
            if (task.owner) {
              ownerData = {
                id: task.owner.id,
                email: task.owner.email,
                name: task.owner.name,
                firstName: task.owner.firstName,
                lastName: task.owner.lastName,
              };
            }

            return {
              id: task.id,
              phaseId: task.phaseId,
              name: task.name,
              description: task.description,
              ownerId: task.ownerId,
              owner: ownerData,
              startDate: task.startDate,
              plannedCompletionDate: task.plannedCompletionDate,
              actualCompletionDate: task.actualCompletionDate,
              order: task.order,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            };
          })
        );
      } catch (error: any) {
        request.log.error("Error fetching tasks:", error);
        request.log.error("Error stack:", error.stack);
        return reply.status(500).send({
          error: "Failed to fetch tasks",
          message: error.message,
        });
      }
    }
  );

  // Create a task
  fastify.post<{
    Params: { id: string; phaseId: string };
    Body: {
      name: string;
      description?: string;
      ownerId?: string;
      order?: number;
    };
  }>(
    "/:id/phases/:phaseId/tasks",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; phaseId: string };
        Body: {
          name: string;
          description?: string;
          ownerId?: string;
          order?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project exists and user has access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify phase belongs to project
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
      });

      if (!phase || phase.projectId !== projectId) {
        return reply.status(404).send({ error: "Phase not found" });
      }

      // Calculate order if not provided
      let order = request.body.order;
      if (order === undefined) {
        const maxOrderTask = await db.task.findFirst({
          where: { phaseId },
          orderBy: { order: "desc" },
        });
        order = maxOrderTask ? maxOrderTask.order + 1 : 1;
      }

      // Verify owner belongs to same tenant if provided
      if (request.body.ownerId) {
        const owner = await db.user.findUnique({
          where: { id: request.body.ownerId },
        });
        if (!owner || owner.tenantId !== project.tenantId) {
          return reply.status(400).send({ error: "Invalid owner" });
        }
      }

      // Create task
      const task = await db.task.create({
        data: {
          phaseId,
          name: request.body.name,
          description: request.body.description || null,
          ownerId: request.body.ownerId || null,
          order,
        },
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return reply.status(201).send({
        id: task.id,
        phaseId: task.phaseId,
        name: task.name,
        description: task.description,
        ownerId: task.ownerId,
        owner: task.owner
          ? {
              id: task.owner.id,
              email: task.owner.email,
              name: task.owner.name,
              firstName: task.owner.firstName,
              lastName: task.owner.lastName,
            }
          : null,
        startDate: task.startDate,
        plannedCompletionDate: task.plannedCompletionDate,
        actualCompletionDate: task.actualCompletionDate,
        order: task.order,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    }
  );

  // Update a task
  fastify.put<{
    Params: { id: string; phaseId: string; taskId: string };
    Body: {
      name?: string;
      description?: string | null;
      ownerId?: string | null;
      startDate?: string | null;
      plannedCompletionDate?: string | null;
      actualCompletionDate?: string | null;
      order?: number;
    };
  }>(
    "/:id/phases/:phaseId/tasks/:taskId",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; phaseId: string; taskId: string };
        Body: {
          name?: string;
          description?: string | null;
          ownerId?: string | null;
          startDate?: string | null;
          plannedCompletionDate?: string | null;
          actualCompletionDate?: string | null;
          order?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      const taskId = request.params.taskId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project exists and user has access
      const project = await db.project.findUnique({
        where: { id: projectId },
        include: { ProjectMember: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      const user = await db.user.findUnique({
        where: { id: getUser(request).userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify phase belongs to project
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
      });

      if (!phase || phase.projectId !== projectId) {
        return reply.status(404).send({ error: "Phase not found" });
      }

      // Verify task belongs to phase
      const task = await db.task.findUnique({
        where: { id: taskId },
      });

      if (!task || task.phaseId !== phaseId) {
        return reply.status(404).send({ error: "Task not found" });
      }

      // Verify owner belongs to same tenant if provided
      if (request.body.ownerId !== undefined) {
        if (request.body.ownerId) {
          const owner = await db.user.findUnique({
            where: { id: request.body.ownerId },
          });
          if (!owner || owner.tenantId !== project.tenantId) {
            return reply.status(400).send({ error: "Invalid owner" });
          }
        }
      }

      // Validate order if provided
      if (request.body.order !== undefined) {
        if (typeof request.body.order !== "number" || request.body.order < 1) {
          return reply.status(400).send({ error: "Order must be a positive number" });
        }
        // Get total task count in phase to validate upper bound
        const taskCount = await db.task.count({
          where: { phaseId },
        });
        if (request.body.order > taskCount) {
          return reply.status(400).send({ error: `Order cannot exceed ${taskCount}` });
        }
      }

      // Update task
      const updateData: any = {};
      
      if (request.body.name !== undefined) {
        updateData.name = request.body.name;
      }
      if (request.body.description !== undefined) {
        updateData.description = request.body.description === null || request.body.description === "" ? null : request.body.description;
      }
      if (request.body.ownerId !== undefined) {
        // Set ownerId directly - null or empty string means no owner
        updateData.ownerId = request.body.ownerId === null || request.body.ownerId === "" ? null : request.body.ownerId;
      }
      if (request.body.startDate !== undefined) {
        if (request.body.startDate === null || request.body.startDate === "") {
          updateData.startDate = null;
        } else if (request.body.startDate) {
          updateData.startDate = new Date(request.body.startDate);
        }
      }
      if (request.body.plannedCompletionDate !== undefined) {
        if (request.body.plannedCompletionDate === null || request.body.plannedCompletionDate === "") {
          updateData.plannedCompletionDate = null;
        } else if (request.body.plannedCompletionDate) {
          updateData.plannedCompletionDate = new Date(request.body.plannedCompletionDate);
        }
      }
      if (request.body.actualCompletionDate !== undefined) {
        if (request.body.actualCompletionDate === null || request.body.actualCompletionDate === "") {
          updateData.actualCompletionDate = null;
        } else if (request.body.actualCompletionDate) {
          updateData.actualCompletionDate = new Date(request.body.actualCompletionDate);
        }
      }
      if (request.body.order !== undefined) {
        updateData.order = request.body.order;
      }

      try {
        const updatedTask = await db.task.update({
          where: { id: taskId },
          data: updateData,
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        return reply.send({
          id: updatedTask.id,
          phaseId: updatedTask.phaseId,
          name: updatedTask.name,
          description: updatedTask.description,
          ownerId: updatedTask.ownerId,
          owner: updatedTask.owner
            ? {
                id: updatedTask.owner.id,
                email: updatedTask.owner.email,
                name: updatedTask.owner.name,
                firstName: updatedTask.owner.firstName,
                lastName: updatedTask.owner.lastName,
              }
            : null,
          startDate: updatedTask.startDate,
          plannedCompletionDate: updatedTask.plannedCompletionDate,
          actualCompletionDate: updatedTask.actualCompletionDate,
          order: updatedTask.order,
          createdAt: updatedTask.createdAt,
          updatedAt: updatedTask.updatedAt,
        });
      } catch (error: any) {
        request.log.error("Error updating task:", error);
        return reply.status(500).send({
          error: "Failed to update task",
          message: error.message,
        });
      }
    }
  );

  // Update project
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      type?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    };
  }>(
    "/:id",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          name?: string;
          type?: string | null;
          startDate?: string | null;
          endDate?: string | null;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and belongs to same tenant
      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      if (project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Update project
      const updatedProject = await db.project.update({
        where: { id: projectId },
        data: {
          name: request.body.name,
          type: request.body.type === null ? null : request.body.type,
          startDate: request.body.startDate === null ? null : request.body.startDate ? new Date(request.body.startDate) : undefined,
          endDate: request.body.endDate === null ? null : request.body.endDate ? new Date(request.body.endDate) : undefined,
        },
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

      return reply.send({
        id: updatedProject.id,
        name: updatedProject.name,
        type: updatedProject.type,
        startDate: updatedProject.startDate,
        endDate: updatedProject.endDate,
        tenantId: updatedProject.tenantId,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
        members: updatedProject.ProjectMember.map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
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

  // Delete project
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const projectId = request.params.id;
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and belongs to same tenant
      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return reply.status(404).send({ error: "Project not found" });
      }

      if (project.tenantId !== currentUser.tenantId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Delete project (cascade will handle phases and tasks)
      await db.project.delete({
        where: { id: projectId },
      });

      return reply.status(204).send();
    }
  );
}

