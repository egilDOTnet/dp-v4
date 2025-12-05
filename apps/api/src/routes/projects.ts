import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { createProjectSchema, addProjectMembersSchema } from "@dp/lib";
import { authenticate, requireTenant, requireRole, getUser } from "../middleware/auth";

interface BrregEntity {
  organisasjonsnummer: string;
  navn: string;
}

// Helper function to lookup organization number in brreg.no and validate name
async function validateBrregOrganizationNumber(
  organizationNumber: string,
  providedName: string
): Promise<{ valid: boolean; brregName?: string; error?: string; notFound?: boolean }> {
  try {
    // Clean organization number - only digits
    const cleanOrgNumber = organizationNumber.replace(/\D/g, "");
    
    // Must be exactly 9 digits
    if (cleanOrgNumber.length !== 9) {
      return { valid: false, error: "Organization number must be exactly 9 digits" };
    }

    const detailsUrl = `https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrgNumber}`;
    const response = await fetch(detailsUrl);

    if (response.status === 404) {
      // Not found in brreg - should be removed/saved as empty
      return { valid: false, notFound: true, error: "Organization number not found in brreg.no" };
    }

    if (!response.ok) {
      return { valid: false, error: "Failed to verify organization number with brreg.no" };
    }

    const entity = await response.json() as BrregEntity;
    const brregName = entity.navn.trim();

    // If found in brreg, the name must match exactly
    if (providedName.trim() !== brregName) {
      return {
        valid: false,
        brregName,
        error: `Organization number found in brreg.no, but name must match. Expected: "${brregName}"`,
      };
    }

    return { valid: true, brregName };
  } catch {
    return { valid: false, error: "Error verifying organization number with brreg.no" };
  }
}

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
      } as any,
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
        members: (project.ProjectMember || []).map((m) => {
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
            create: (body.memberIds?.map((userId) => ({
              userId,
            })) || []) as any,
          },
        } as any,
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
        members: (project.ProjectMember || []).map((m) => {
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
          })) as any,
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
          User: {
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
        (m) => m.User.role === "CompanyAdministrator" || m.User.role === "GlobalAdministrator"
      );

      // Count remaining admin members after removal
      const remainingAdminMembers = currentMembers.filter(
        (m) =>
          !body.memberIds.includes(m.userId) &&
          (m.User.role === "CompanyAdministrator" || m.User.role === "GlobalAdministrator")
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
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/phases",
    { preHandler: [authenticate] },
    async (request, reply) => {
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
  fastify.get<{
    Params: { id: string; phaseId: string };
  }>(
    "/:id/phases/:phaseId/tasks",
    { preHandler: [authenticate] },
    async (request, reply) => {
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

  // Get all vendors for a project
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/vendors",
    { preHandler: [authenticate] },
    async (request, reply) => {
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

      // Get all vendors for this project with contacts
      try {
        // Verify the model exists (helps catch Prisma client regeneration issues)
        if (!db.projectVendor) {
          request.log.error("Prisma client missing projectVendor model. Please restart the API server after running 'pnpm prisma generate'");
          return reply.status(500).send({
            error: "Database models not available",
            message: "The Prisma client is missing the vendor models. Please restart the API server after running 'pnpm prisma generate' in the packages/db directory.",
          });
        }

        const projectVendors = await db.projectVendor.findMany({
          where: { projectId },
          include: {
            vendor: {
              include: {
                VendorContactPerson: {
                  orderBy: [
                    { isMainContact: "desc" },
                    { createdAt: "asc" },
                  ],
                },
              },
            },
          },
          orderBy: {
            vendor: {
              name: "asc",
            },
          },
        });

        return reply.send(
          projectVendors.map((pv) => {
            const contacts = pv.vendor?.VendorContactPerson
              ? pv.vendor.VendorContactPerson.map((contact) => ({
                  id: contact.id,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  isMainContact: contact.isMainContact,
                  createdAt: contact.createdAt,
                  updatedAt: contact.updatedAt,
                }))
              : [];

            return {
              id: pv.id,
              projectId: pv.projectId,
              vendorId: pv.vendorId,
              status: pv.status,
              createdAt: pv.createdAt,
              updatedAt: pv.updatedAt,
              vendor: {
                id: pv.vendor.id,
                name: pv.vendor.name,
                organizationNumber: pv.vendor.organizationNumber,
                emailDomain: pv.vendor.emailDomain,
                additionalData: pv.vendor.additionalData || null,
                contacts,
              },
            };
          })
        );
      } catch (error: any) {
        request.log.error("Error fetching vendors:", error);
        return reply.status(500).send({
          error: "Failed to fetch vendors",
          message: error.message,
        });
      }
    }
  );

  // Add/link vendor to project
  fastify.post<{
    Params: { id: string };
    Body: {
      vendorId?: string;
      name: string;
      organizationNumber?: string;
      emailDomain?: string;
      additionalData?: any;
      status?: string;
    };
  }>(
    "/:id/vendors",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          vendorId?: string;
          name: string;
          organizationNumber?: string;
          emailDomain?: string;
          additionalData?: any;
          status?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      let vendor;

      // Check if linking existing vendor or creating new one
      if (request.body.vendorId) {
        // Link existing vendor
        vendor = await db.vendor.findUnique({
          where: { id: request.body.vendorId },
        });

        if (!vendor || vendor.tenantId !== currentUser.tenantId) {
          return reply.status(404).send({ error: "Vendor not found" });
        }
      } else {
        // Create new vendor
        if (!request.body.name) {
          return reply.status(400).send({ error: "Vendor name is required" });
        }

        // Clean and validate organization number format if provided
        let cleanOrgNumber: string | null = null;
        if (request.body.organizationNumber) {
          cleanOrgNumber = request.body.organizationNumber.replace(/\D/g, "");
          if (cleanOrgNumber.length !== 9) {
            return reply.status(400).send({ error: "Invalid organization number format. Must be exactly 9 digits." });
          }

          // If organization number is provided, validate with brreg.no
          const brregValidation = await validateBrregOrganizationNumber(
            cleanOrgNumber,
            request.body.name
          );

          if (!brregValidation.valid) {
            // If not found in brreg, return error - don't save invalid org number
            if (brregValidation.notFound) {
              return reply.status(400).send({
                error: "Organization number not found in brreg.no. Please enter a valid Norwegian organization number or remove it.",
              });
            } else {
              return reply.status(400).send({
                error: brregValidation.error || "Invalid organization number",
                brregName: brregValidation.brregName,
              });
            }
          }
        }

        // Check if vendor with same organization number already exists
        if (cleanOrgNumber) {
          const existingVendor = await db.vendor.findFirst({
            where: {
              tenantId: currentUser.tenantId,
              organizationNumber: cleanOrgNumber,
            },
          });

          if (existingVendor) {
            vendor = existingVendor;
          }
        }

        if (!vendor) {
          vendor = await db.vendor.create({
            data: {
              tenantId: currentUser.tenantId,
              name: request.body.name,
              organizationNumber: cleanOrgNumber || null,
              emailDomain: request.body.emailDomain || null,
              additionalData: request.body.additionalData || null,
            },
          });
        }
      }

      // Check if a vendor with the same name (case-insensitive) already exists in this project
      // (excluding the current vendor to avoid false positives)
      const existingProjectVendors = await db.projectVendor.findMany({
        where: {
          projectId,
          vendor: {
            id: { not: vendor.id }, // Exclude the current vendor
          },
        },
        include: {
          vendor: {
            select: {
              name: true,
            },
          },
        },
      });

      // Case-insensitive name comparison
      const vendorNameLower = vendor.name.toLowerCase().trim();
      const existingVendorWithSameName = existingProjectVendors.find(
        (pv) => pv.vendor.name.toLowerCase().trim() === vendorNameLower
      );

      if (existingVendorWithSameName) {
        return reply.status(400).send({
          error: `A vendor with the name "${existingVendorWithSameName.vendor.name}" is already linked to this project (case-insensitive match)`,
        });
      }

      // Check if a vendor with the same organization number already exists in this project
      // (excluding the current vendor to avoid false positives)
      if (vendor.organizationNumber) {
        const existingProjectVendorWithOrgNumber = await db.projectVendor.findFirst({
          where: {
            projectId,
            vendor: {
              organizationNumber: vendor.organizationNumber,
              id: { not: vendor.id }, // Exclude the current vendor
            },
          },
          include: {
            vendor: {
              select: {
                name: true,
                organizationNumber: true,
              },
            },
          },
        });

        if (existingProjectVendorWithOrgNumber) {
          return reply.status(400).send({
            error: `A vendor with organization number ${vendor.organizationNumber} (${existingProjectVendorWithOrgNumber.vendor.name}) is already linked to this project`,
          });
        }
      }

      // Check if vendor is already linked to project
      const existingLink = await db.projectVendor.findUnique({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId: vendor.id,
          },
        },
      });

      if (existingLink) {
        return reply.status(400).send({ error: "Vendor already linked to this project" });
      }

      // Create project-vendor link
      const projectVendor = await db.projectVendor.create({
        data: {
          projectId,
          vendorId: vendor.id,
          status: (request.body.status as any) || "Pending",
        },
        include: {
          vendor: {
            include: {
              VendorContactPerson: true,
            },
          },
        },
      });

      return reply.status(201).send({
        id: projectVendor.id,
        projectId: projectVendor.projectId,
        vendorId: projectVendor.vendorId,
        status: projectVendor.status,
        createdAt: projectVendor.createdAt,
        updatedAt: projectVendor.updatedAt,
        vendor: {
          id: projectVendor.vendor.id,
          name: projectVendor.vendor.name,
          organizationNumber: projectVendor.vendor.organizationNumber,
          emailDomain: projectVendor.vendor.emailDomain,
          additionalData: projectVendor.vendor.additionalData,
          contacts: projectVendor.vendor.VendorContactPerson.map((contact) => ({
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            isMainContact: contact.isMainContact,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          })),
        },
      });
    }
  );

  // Update vendor details
  fastify.put<{
    Params: { id: string; vendorId: string };
    Body: {
      name?: string;
      organizationNumber?: string;
      emailDomain?: string;
      additionalData?: any;
    };
  }>(
    "/:id/vendors/:vendorId/details",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; vendorId: string };
        Body: {
          name?: string;
          organizationNumber?: string;
          emailDomain?: string;
          additionalData?: any;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify vendor exists and is linked to project
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
      });

      if (!vendor || vendor.tenantId !== currentUser.tenantId) {
        return reply.status(404).send({ error: "Vendor not found" });
      }

      const projectVendor = await db.projectVendor.findUnique({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
      });

      if (!projectVendor) {
        return reply.status(404).send({ error: "Vendor not linked to this project" });
      }

      // Prepare update data
      const updateData: {
        name?: string;
        organizationNumber?: string | null;
        emailDomain?: string | null;
        additionalData?: any;
      } = {};

      // Validate and set name if provided
      if (request.body.name !== undefined) {
        if (!request.body.name.trim()) {
          return reply.status(400).send({ error: "Vendor name cannot be empty" });
        }
        updateData.name = request.body.name.trim();
      }

      // Clean and validate organization number format if provided
      if (request.body.organizationNumber !== undefined) {
        let cleanOrgNumber: string | null = null;
        if (request.body.organizationNumber) {
          cleanOrgNumber = request.body.organizationNumber.replace(/\D/g, "");
          if (cleanOrgNumber.length !== 9) {
            return reply.status(400).send({ error: "Invalid organization number format. Must be exactly 9 digits." });
          }

          // If organization number is provided, validate with brreg.no
          const nameToValidate = updateData.name || vendor.name;
          const brregValidation = await validateBrregOrganizationNumber(
            cleanOrgNumber,
            nameToValidate
          );

          if (!brregValidation.valid) {
            // If not found in brreg, return error - don't save invalid org number
            if (brregValidation.notFound) {
              return reply.status(400).send({
                error: "Organization number not found in brreg.no. Please enter a valid Norwegian organization number or remove it.",
              });
            } else {
              return reply.status(400).send({
                error: brregValidation.error || "Invalid organization number",
                brregName: brregValidation.brregName,
              });
            }
          }
        }

        updateData.organizationNumber = cleanOrgNumber;
      }

      if (request.body.emailDomain !== undefined) {
        updateData.emailDomain = request.body.emailDomain || null;
      }

      if (request.body.additionalData !== undefined) {
        updateData.additionalData = request.body.additionalData;
      }

      // Check for duplicate name in project (case-insensitive, excluding current vendor)
      const nameToCheck = (updateData.name || vendor.name).toLowerCase().trim();
      const existingProjectVendors = await db.projectVendor.findMany({
        where: {
          projectId,
          vendor: {
            id: { not: vendorId },
          },
        },
        include: {
          vendor: {
            select: {
              name: true,
            },
          },
        },
      });

      // Case-insensitive name comparison
      const existingVendorWithSameName = existingProjectVendors.find(
        (pv) => pv.vendor.name.toLowerCase().trim() === nameToCheck
      );

      if (existingVendorWithSameName) {
        return reply.status(400).send({
          error: `A vendor with the name "${existingVendorWithSameName.vendor.name}" is already linked to this project (case-insensitive match)`,
        });
      }

      // Check for duplicate organization number in project (excluding current vendor)
      const orgNumberToCheck = updateData.organizationNumber !== undefined ? updateData.organizationNumber : vendor.organizationNumber;
      if (orgNumberToCheck) {
        const existingProjectVendorWithOrgNumber = await db.projectVendor.findFirst({
          where: {
            projectId,
            vendor: {
              organizationNumber: orgNumberToCheck,
              id: { not: vendorId },
            },
          },
          include: {
            vendor: {
              select: {
                name: true,
                organizationNumber: true,
              },
            },
          },
        });

        if (existingProjectVendorWithOrgNumber) {
          return reply.status(400).send({
            error: `A vendor with organization number ${orgNumberToCheck} (${existingProjectVendorWithOrgNumber.vendor.name}) is already linked to this project`,
          });
        }
      }

      // Update vendor
      await db.vendor.update({
        where: { id: vendorId },
        data: updateData,
        include: {
          VendorContactPerson: true,
        },
      });

      // Return updated project-vendor with vendor details
      const updatedProjectVendor = await db.projectVendor.findUnique({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
        include: {
          vendor: {
            include: {
              VendorContactPerson: true,
            },
          },
        },
      });

      return reply.send({
        id: updatedProjectVendor!.id,
        projectId: updatedProjectVendor!.projectId,
        vendorId: updatedProjectVendor!.vendorId,
        status: updatedProjectVendor!.status,
        createdAt: updatedProjectVendor!.createdAt,
        updatedAt: updatedProjectVendor!.updatedAt,
        vendor: {
          id: updatedProjectVendor!.vendor.id,
          name: updatedProjectVendor!.vendor.name,
          organizationNumber: updatedProjectVendor!.vendor.organizationNumber,
          emailDomain: updatedProjectVendor!.vendor.emailDomain,
          additionalData: updatedProjectVendor!.vendor.additionalData,
          contacts: updatedProjectVendor!.vendor.VendorContactPerson.map((contact) => ({
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            isMainContact: contact.isMainContact,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          })),
        },
      });
    }
  );

  // Update project-vendor relationship (mainly status)
  fastify.put<{
    Params: { id: string; vendorId: string };
    Body: {
      status: string;
    };
  }>(
    "/:id/vendors/:vendorId",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; vendorId: string };
        Body: {
          status: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Update the project-vendor relationship
      const projectVendor = await db.projectVendor.update({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
        data: {
          status: request.body.status as any,
        },
        include: {
          vendor: {
            include: {
              VendorContactPerson: true,
            },
          },
        },
      });

      return reply.send({
        id: projectVendor.id,
        projectId: projectVendor.projectId,
        vendorId: projectVendor.vendorId,
        status: projectVendor.status,
        createdAt: projectVendor.createdAt,
        updatedAt: projectVendor.updatedAt,
        vendor: {
          id: projectVendor.vendor.id,
          name: projectVendor.vendor.name,
          organizationNumber: projectVendor.vendor.organizationNumber,
          emailDomain: projectVendor.vendor.emailDomain,
          additionalData: projectVendor.vendor.additionalData,
          contacts: projectVendor.vendor.VendorContactPerson.map((contact) => ({
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            isMainContact: contact.isMainContact,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          })),
        },
      });
    }
  );

  // Remove vendor from project
  fastify.delete<{ Params: { id: string; vendorId: string } }>(
    "/:id/vendors/:vendorId",
    { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string; vendorId: string } }>, reply: FastifyReply) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Delete the project-vendor link (vendor itself remains for other projects)
      await db.projectVendor.delete({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
      });

      return reply.status(204).send();
    }
  );

  // Add contact person to vendor
  fastify.post<{
    Params: { id: string; vendorId: string };
    Body: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    };
  }>(
    "/:id/vendors/:vendorId/contacts",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; vendorId: string };
        Body: {
          firstName: string;
          lastName: string;
          email: string;
          isMainContact?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify vendor exists and is linked to project
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
        include: {
          VendorContactPerson: true,
        },
      });

      if (!vendor || vendor.tenantId !== currentUser.tenantId) {
        return reply.status(404).send({ error: "Vendor not found" });
      }

      const projectVendor = await db.projectVendor.findUnique({
        where: {
          projectId_vendorId: {
            projectId,
            vendorId,
          },
        },
      });

      if (!projectVendor) {
        return reply.status(404).send({ error: "Vendor not linked to this project" });
      }

      // Check if this is the first contact
      const isFirstContact = vendor.VendorContactPerson.length === 0;
      const shouldBeMainContact = request.body.isMainContact ?? isFirstContact;

      // If setting as main contact, unset other main contacts
      if (shouldBeMainContact) {
        await db.vendorContactPerson.updateMany({
          where: {
            vendorId,
            isMainContact: true,
          },
          data: {
            isMainContact: false,
          },
        });
      }

      // Create contact person
      const contact = await db.vendorContactPerson.create({
        data: {
          vendorId,
          firstName: request.body.firstName,
          lastName: request.body.lastName,
          email: request.body.email,
          isMainContact: shouldBeMainContact,
        },
      });

      return reply.status(201).send({
        id: contact.id,
        vendorId: contact.vendorId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        isMainContact: contact.isMainContact,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      });
    }
  );

  // Update contact person
  fastify.put<{
    Params: { id: string; vendorId: string; contactId: string };
    Body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      isMainContact?: boolean;
    };
  }>(
    "/:id/vendors/:vendorId/contacts/:contactId",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{
        Params: { id: string; vendorId: string; contactId: string };
        Body: {
          firstName?: string;
          lastName?: string;
          email?: string;
          isMainContact?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      const contactId = request.params.contactId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify contact exists
      const existingContact = await db.vendorContactPerson.findUnique({
        where: { id: contactId },
      });

      if (!existingContact || existingContact.vendorId !== vendorId) {
        return reply.status(404).send({ error: "Contact not found" });
      }

      // If setting as main contact, unset other main contacts
      if (request.body.isMainContact === true) {
        await db.vendorContactPerson.updateMany({
          where: {
            vendorId,
            isMainContact: true,
            id: { not: contactId },
          },
          data: {
            isMainContact: false,
          },
        });
      }

      // Update contact person
      const contact = await db.vendorContactPerson.update({
        where: { id: contactId },
        data: {
          firstName: request.body.firstName,
          lastName: request.body.lastName,
          email: request.body.email,
          isMainContact: request.body.isMainContact,
        },
      });

      return reply.send({
        id: contact.id,
        vendorId: contact.vendorId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        isMainContact: contact.isMainContact,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      });
    }
  );

  // Delete contact person
  fastify.delete<{ Params: { id: string; vendorId: string; contactId: string } }>(
    "/:id/vendors/:vendorId/contacts/:contactId",
    { preHandler: [authenticate] },
    async (
      request: FastifyRequest<{ Params: { id: string; vendorId: string; contactId: string } }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const vendorId = request.params.vendorId;
      const contactId = request.params.contactId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project exists and user has access
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

      const user = await db.user.findUnique({
        where: { id: currentUser.userId },
        include: { projectMembers: true },
      });

      const isMember = user?.projectMembers.some((pm) => pm.projectId === project.id);
      const isAdmin =
        (user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator") &&
        user?.tenantId === project.tenantId;

      if (!isMember && !isAdmin) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Verify contact exists
      const existingContact = await db.vendorContactPerson.findUnique({
        where: { id: contactId },
      });

      if (!existingContact || existingContact.vendorId !== vendorId) {
        return reply.status(404).send({ error: "Contact not found" });
      }

      // Delete contact person
      await db.vendorContactPerson.delete({
        where: { id: contactId },
      });

      // If the deleted contact was the main contact, set the next contact as main if any exist
      if (existingContact.isMainContact) {
        const nextContact = await db.vendorContactPerson.findFirst({
          where: { vendorId },
          orderBy: { createdAt: "asc" },
        });

        if (nextContact) {
          await db.vendorContactPerson.update({
            where: { id: nextContact.id },
            data: { isMainContact: true },
          });
        }
      }

      return reply.status(204).send();
    }
  );
}

