import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db, RequirementStatus, VendorStatus } from "@dp/db";
import { createProjectSchema, addProjectMembersSchema } from "@dp/lib";
import { authenticate, requireTenant, requireRole, getUser } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/project-access";
import { computeDisplayName } from "../utils/user-utils";
import { createId } from "@paralleldrive/cuid2";

// Helper functions for requirement hierarchy (duplicated from requirements.ts for import functionality)
async function generateHierarchyNumber(
  projectId: string,
  parentId: string | null
): Promise<string> {
  if (parentId === null) {
    const count = await db.requirementHierarchy.count({
      where: {
        projectId,
        parentId: null,
      },
    });
    return `${count + 1}.`;
  } else {
    const parent = await db.requirementHierarchy.findUnique({
      where: { id: parentId },
    });
    if (!parent) {
      throw new Error("Parent hierarchy not found");
    }
    
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
    
    const parentNumberBase = parent.number.endsWith('.') ? parent.number.slice(0, -1) : parent.number;
    const totalCount = siblingHierarchyCount + requirementCount;
    return `${parentNumberBase}.${totalCount + 1}.`;
  }
}

async function generateRequirementNumber(
  hierarchyId: string
): Promise<string> {
  const hierarchy = await db.requirementHierarchy.findUnique({
    where: { id: hierarchyId },
  });
  if (!hierarchy) {
    throw new Error("Hierarchy not found");
  }

  const subHierarchyCount = await db.requirementHierarchy.count({
    where: {
      parentId: hierarchyId,
    },
  });
  
  const requirementCount = await db.requirement.count({
    where: { hierarchyId },
  });

  const hierarchyNumberBase = hierarchy.number.endsWith('.') ? hierarchy.number.slice(0, -1) : hierarchy.number;
  const totalCount = subHierarchyCount + requirementCount;
  return `${hierarchyNumberBase}.${totalCount + 1}.`;
}

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
        id: createId(),
        projectId,
        name: PHASE_NAMES[i],
        order: i + 1,
        updatedAt: new Date(),
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
  /**
   * Get all projects accessible to the current user
   * Company admins see all company projects, regular users see only their assigned projects
   */
  fastify.get(
    "/",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all projects accessible to the current user. Company administrators see all company projects, regular users see only projects they are members of.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                type: { type: "string", nullable: true },
                startDate: { type: "string", format: "date-time", nullable: true },
                endDate: { type: "string", format: "date-time", nullable: true },
                logoData: { type: "string", nullable: true },
                logoFileName: { type: "string", nullable: true },
                logoFileType: { type: "string", nullable: true },
                logoShape: { type: "string", nullable: true },
                logoPlacement: { type: "string", nullable: true },
                logoBorder: { type: "string", nullable: true },
                bannerData: { type: "string", nullable: true },
                bannerFileName: { type: "string", nullable: true },
                bannerFileType: { type: "string", nullable: true },
                tenantId: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                members: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      name: { type: "string", nullable: true },
                      firstName: { type: "string", nullable: true },
                      lastName: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Unauthorized",
          },
        },
      },
    },
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
          logoData: p.logoData,
          logoFileName: p.logoFileName,
          logoFileType: p.logoFileType,
          logoShape: p.logoShape,
          logoPlacement: p.logoPlacement,
          logoBorder: p.logoBorder,
          bannerData: p.bannerData,
          bannerFileName: p.bannerFileName,
          bannerFileType: p.bannerFileType,
          tenantId: p.tenantId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          members: "ProjectMember" in p && p.ProjectMember ? p.ProjectMember.map((m: any) => {
            const user = m.User as { id: string; email: string; name: string | null; firstName: string | null; lastName: string | null };
            return {
              id: user.id,
              email: user.email,
              name: computeDisplayName(user),
              firstName: user.firstName,
              lastName: user.lastName,
            };
          }) : [],
        }))
      );
    }
  );

  /**
   * Get a single project by ID
   * User must be a project member or company admin
   */
  fastify.get(
    "/:id",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get a single project by ID. User must be a project member or a company administrator.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              logoData: { type: "string", nullable: true },
              logoFileName: { type: "string", nullable: true },
              logoFileType: { type: "string", nullable: true },
              logoShape: { type: "string", nullable: true },
              logoPlacement: { type: "string", nullable: true },
              logoBorder: { type: "string", nullable: true },
              bannerData: { type: "string", nullable: true },
              bannerFileName: { type: "string", nullable: true },
              bannerFileType: { type: "string", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
              },
            },
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
      const id = (request.params as { id: string }).id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;
      
      // Fetch project with needed includes after access verification
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
                  firstName: true,
                  lastName: true,
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

      return reply.send({
        id: project.id,
        name: project.name,
        type: project.type,
        startDate: project.startDate,
        endDate: project.endDate,
        logoData: project.logoData,
        logoFileName: project.logoFileName,
        logoFileType: project.logoFileType,
        logoShape: project.logoShape,
        logoPlacement: project.logoPlacement,
        logoBorder: project.logoBorder,
        bannerData: project.bannerData,
        bannerFileName: project.bannerFileName,
        bannerFileType: project.bannerFileType,
        tenantId: project.tenantId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        members: (project.ProjectMember || []).map((m) => {
          const user = m.User as typeof m.User & { firstName: string | null; lastName: string | null };
          return {
            id: user.id,
            email: user.email,
            name: computeDisplayName(user),
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }),
      });
    }
  );

  /**
   * Create a new project
   * Requires CompanyAdministrator or GlobalAdministrator role
   * Automatically initializes phases and default tasks
   */
  fastify.post<{ Body: CreateProjectBody }>(
    "/",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Create a new project. Requires CompanyAdministrator or GlobalAdministrator role. Automatically initializes 9 phases with default tasks.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "Project name",
            },
            type: {
              type: "string",
              nullable: true,
              description: "Project type (e.g., 'Software', 'Hardware')",
            },
            startDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "Project start date (ISO 8601 date)",
            },
            endDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "Project end date (ISO 8601 date)",
            },
            memberIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of user IDs to add as project members",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
              },
            },
            description: "Project created successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid member IDs",
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
            description: "Forbidden - requires admin role or tenant",
          },
        },
      },
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
          id: createId(),
          name: body.name,
          type: body.type,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          tenantId: currentUser.tenantId,
          updatedAt: new Date(),
          ProjectMember: {
            create: (body.memberIds?.map((userId) => ({
              id: createId(),
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
          return {
            id: user.id,
            email: user.email,
            name: computeDisplayName(user),
            firstName: user.firstName,
            lastName: user.lastName,
          };
        }),
      });
    }
  );

  /**
   * Add members to a project
   * Requires CompanyAdministrator or GlobalAdministrator role
   * Sends email notifications to newly added members
   */
  fastify.post<{ Params: { id: string }; Body: { memberIds: string[] } }>(
    "/:id/members",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Add members to a project. Requires CompanyAdministrator or GlobalAdministrator role. Automatically sends email notifications to newly added members.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["memberIds"],
          properties: {
            memberIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of user IDs to add as project members",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
              },
            },
            description: "Project with updated members list",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid member IDs",
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
            description: "Forbidden - requires admin role or tenant",
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
            id: createId(),
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

  /**
   * Remove members from a project
   * Requires CompanyAdministrator or GlobalAdministrator role
   * Prevents removal if it would leave no admin members
   */
  fastify.delete<{ Params: { id: string }; Body: { memberIds: string[] } }>(
    "/:id/members",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Remove members from a project. Requires CompanyAdministrator or GlobalAdministrator role. Prevents removal if it would leave the project with no administrators.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["memberIds"],
          properties: {
            memberIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of user IDs to remove from the project",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
              },
            },
            description: "Project with updated members list",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or cannot remove last administrator",
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
            description: "Forbidden - requires admin role or tenant",
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

  /**
   * Get all phases for a project with task counts and status
   * User must be a project member or company admin
   * Calculates phase status based on task completion and delays
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/phases",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all phases for a project with task counts and calculated status. User must be a project member or company administrator. Phase status is calculated based on task completion and delays.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                projectId: { type: "string" },
                name: { type: "string" },
                order: { type: "number" },
                status: {
                  type: "string",
                  enum: ["not_started", "ongoing", "delayed", "completed"],
                  description: "Phase status calculated from tasks",
                },
                taskCount: { type: "number", description: "Total number of tasks in phase" },
                completedTaskCount: { type: "number", description: "Number of completed tasks" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            description: "Array of phases with status and task counts",
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
    async (request, reply) => {
      const projectId = request.params.id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Get tasks for a specific phase
   * User must be a project member or company admin
   * Returns tasks ordered by order field
   */
  fastify.get<{
    Params: { id: string; phaseId: string };
  }>(
    "/:id/phases/:phaseId/tasks",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all tasks for a specific phase. User must be a project member or company administrator. Tasks are returned ordered by their order field.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                phaseId: { type: "string" },
                name: { type: "string" },
                description: { type: "string", nullable: true },
                ownerId: { type: "string", nullable: true },
                owner: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
                startDate: { type: "string", format: "date-time", nullable: true },
                plannedCompletionDate: { type: "string", format: "date-time", nullable: true },
                actualCompletionDate: { type: "string", format: "date-time", nullable: true },
                order: { type: "number" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            description: "Array of tasks for the phase",
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
            description: "Project or phase not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  /**
   * Create a task in a phase
   * User must be a project member or company admin
   * Order is auto-calculated if not provided
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a new task in a phase. User must be a project member or company administrator. Order is automatically calculated if not provided.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: {
              type: "string",
              description: "Task name",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Task description",
            },
            ownerId: {
              type: "string",
              nullable: true,
              description: "User ID of task owner (must belong to same tenant)",
            },
            order: {
              type: "number",
              nullable: true,
              description: "Task order (auto-calculated if not provided)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              phaseId: { type: "string" },
              name: { type: "string" },
              description: { type: "string", nullable: true },
              ownerId: { type: "string", nullable: true },
              owner: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string", nullable: true },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                },
              },
              startDate: { type: "string", format: "date-time", nullable: true },
              plannedCompletionDate: { type: "string", format: "date-time", nullable: true },
              actualCompletionDate: { type: "string", format: "date-time", nullable: true },
              order: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Task created successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid owner",
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
            description: "Project or phase not found",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      const project = (request as any).project;

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

  /**
   * Update a task
   * User must be a project member or company admin
   * All fields are optional - only provided fields are updated
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a task. User must be a project member or company administrator. All fields are optional - only provided fields are updated.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId", "taskId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            name: {
              type: "string",
              nullable: true,
              description: "Task name",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Task description (null to clear)",
            },
            ownerId: {
              type: "string",
              nullable: true,
              description: "User ID of task owner (null to remove owner)",
            },
            startDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Task start date (ISO 8601, null to clear)",
            },
            plannedCompletionDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Planned completion date (ISO 8601, null to clear)",
            },
            actualCompletionDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Actual completion date (ISO 8601, null to clear)",
            },
            order: {
              type: "number",
              nullable: true,
              description: "Task order (must be between 1 and total task count)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              phaseId: { type: "string" },
              name: { type: "string" },
              description: { type: "string", nullable: true },
              ownerId: { type: "string", nullable: true },
              owner: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string", nullable: true },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                },
              },
              startDate: { type: "string", format: "date-time", nullable: true },
              plannedCompletionDate: { type: "string", format: "date-time", nullable: true },
              actualCompletionDate: { type: "string", format: "date-time", nullable: true },
              order: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Updated task",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error or invalid owner/order",
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
            description: "Project, phase, or task not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      const project = (request as any).project;

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

  /**
   * Delete a task
   * User must be a project member or company admin
   * Cascades to delete related comments
   */
  fastify.delete<{
    Params: { id: string; phaseId: string; taskId: string };
  }>(
    "/:id/phases/:phaseId/tasks/:taskId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete a task. User must be a project member or company administrator. Related comments are automatically deleted (cascade).",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId", "taskId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
        },
        response: {
          204: {
            description: "Task deleted successfully",
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
            description: "Project, phase, or task not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error",
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string; phaseId: string; taskId: string };
      }>,
      reply: FastifyReply
    ) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      const taskId = request.params.taskId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

      try {
        // Delete the task (cascade will handle related records like comments)
        await db.task.delete({
          where: { id: taskId },
        });

        return reply.status(204).send();
      } catch (error: any) {
        request.log.error("Error deleting task:", error);
        return reply.status(500).send({
          error: "Failed to delete task",
          message: error.message,
        });
      }
    }
  );

  // Helper function to extract @-mentions from HTML content
  function extractMentions(html: string): string[] {
    const mentions: string[] = [];
    // Match spans with data-mention="true" and extract data-user-id
    // More flexible regex that handles attributes in any order
    const mentionRegex = /<span[^>]*data-mention=["']true["'][^>]*data-user-id=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = mentionRegex.exec(html)) !== null) {
      const userId = match[1];
      if (userId && !mentions.includes(userId)) {
        mentions.push(userId);
      }
    }
    return mentions;
  }

  /**
   * Get comments for a task
   * User must be a project member or company admin
   * Returns comments ordered by creation date
   */
  fastify.get<{
    Params: { id: string; phaseId: string; taskId: string };
  }>(
    "/:id/phases/:phaseId/tasks/:taskId/comments",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all comments for a task. User must be a project member or company administrator. Comments are returned ordered by creation date.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId", "taskId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string", description: "Comment content (HTML)" },
                createdBy: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            description: "Array of comments for the task",
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
            description: "Project, phase, or task not found",
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      const taskId = request.params.taskId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

      try {
        // Get comments
        const comments = await db.taskComment.findMany({
          where: { taskId },
          include: {
            createdBy: {
              select: {
                id: true,
                email: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        return reply.send(
          comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            createdBy: {
              id: comment.createdBy.id,
              email: comment.createdBy.email,
              name: comment.createdBy.name,
              firstName: comment.createdBy.firstName,
              lastName: comment.createdBy.lastName,
            },
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          }))
        );
      } catch (err: any) {
        request.log.error("Error fetching comments:", err);
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
        request.log.warn("Unexpected error in comments endpoint, returning empty array:", err);
        return reply.send([]);
      }
    }
  );

  /**
   * Create a comment for a task
   * User must be a project member or company admin
   * Supports @-mentions and notification options
   */
  fastify.post<{
    Params: { id: string; phaseId: string; taskId: string };
    Body: {
      content: string;
      notifyOption: "task_owner" | "task_owner_mentions" | "all_members" | "none";
    };
  }>(
    "/:id/phases/:phaseId/tasks/:taskId/comments",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a comment for a task. User must be a project member or company administrator. Supports @-mentions in HTML content and configurable notification options.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "phaseId", "taskId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            phaseId: {
              type: "string",
              description: "Phase ID",
            },
            taskId: {
              type: "string",
              description: "Task ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["content", "notifyOption"],
          properties: {
            content: {
              type: "string",
              description: "Comment content (HTML, supports @-mentions)",
            },
            notifyOption: {
              type: "string",
              enum: ["task_owner", "task_owner_mentions", "all_members", "none"],
              description: "Notification option: task_owner (notify owner), task_owner_mentions (notify owner and @-mentioned users), all_members (notify all project members), none (no notifications)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string" },
              createdBy: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string", nullable: true },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                },
              },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Comment created successfully",
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
            description: "Project, phase, or task not found",
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      const phaseId = request.params.phaseId;
      const taskId = request.params.taskId;
      const currentUser = getUser(request);
      
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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
        include: {
          owner: true,
        },
      });

      if (!task || task.phaseId !== phaseId) {
        return reply.status(404).send({ error: "Task not found" });
      }

      // Validate body
      if (!request.body.content || typeof request.body.content !== "string") {
        return reply.status(400).send({ error: "Content is required" });
      }

      if (
        !request.body.notifyOption ||
        !["task_owner", "task_owner_mentions", "all_members", "none"].includes(
          request.body.notifyOption
        )
      ) {
        return reply.status(400).send({ error: "Invalid notifyOption" });
      }

      try {
        // Create comment
        const comment = await db.taskComment.create({
          data: {
            taskId,
            content: request.body.content,
            createdById: currentUser.userId,
          },
          include: {
            createdBy: {
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

        // Extract @-mentions from content
        const mentionedUserIds = extractMentions(request.body.content);
        request.log.info(`Extracted ${mentionedUserIds.length} mentions from comment: ${mentionedUserIds.join(", ")}`);

        // Create notifications based on notifyOption
        const notificationPromises: Promise<any>[] = [];

        if (request.body.notifyOption !== "none") {
          try {
            // Get all project members for all_members option
            const projectMembers =
              request.body.notifyOption === "all_members"
                ? await db.projectMember.findMany({
                    where: { projectId },
                    include: { User: true },
                  })
                : [];

            // Determine who should be notified
            const userIdsToNotify = new Set<string>();

            if (request.body.notifyOption === "task_owner" || request.body.notifyOption === "task_owner_mentions") {
              if (task.ownerId) {
                userIdsToNotify.add(task.ownerId);
              }
            }

            if (request.body.notifyOption === "task_owner_mentions" || request.body.notifyOption === "all_members") {
              // Add mentioned users
              for (const mentionedUserId of mentionedUserIds) {
                userIdsToNotify.add(mentionedUserId);
              }
            }

            if (request.body.notifyOption === "all_members") {
              // Add all project members
              for (const member of projectMembers) {
                userIdsToNotify.add(member.userId);
              }
            }

            // Remove the comment creator from notifications
            userIdsToNotify.delete(currentUser.userId);

            // Create notifications (only if notification table exists)
            request.log.info(`Creating notifications for ${userIdsToNotify.size} users`);
            for (const userId of userIdsToNotify) {
              // Determine notification type
              let notificationType: "TASK_MENTION" | "TASK_COMMENT" = "TASK_COMMENT";
              let mentionedByUserId: string | null = null;

              if (mentionedUserIds.includes(userId)) {
                notificationType = "TASK_MENTION";
                mentionedByUserId = currentUser.userId;
              }

              request.log.info(`Creating ${notificationType} notification for user ${userId}`);

              notificationPromises.push(
                db.notification.create({
                  data: {
                    userId,
                    type: notificationType,
                    taskId,
                    commentId: comment.id,
                    mentionedByUserId,
                  },
                }).then((notification) => {
                  request.log.info(`Successfully created notification ${notification.id} for user ${userId}`);
                  return notification;
                }).catch((err: any) => {
                  // If notification creation fails (table doesn't exist), just log and continue
                  request.log.error(`Failed to create notification for user ${userId}:`, err);
                  return null;
                })
              );
            }
          } catch (notifErr: any) {
            // If notification table doesn't exist, just log and continue
            request.log.warn("Notification creation skipped (table may not exist):", notifErr);
          }
        }

        // Wait for notifications (filter out nulls from failed creates)
        await Promise.all(notificationPromises);

        return reply.status(201).send({
          id: comment.id,
          content: comment.content,
          createdBy: {
            id: comment.createdBy.id,
            email: comment.createdBy.email,
            name: comment.createdBy.name,
            firstName: comment.createdBy.firstName,
            lastName: comment.createdBy.lastName,
          },
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        });
      } catch (err: any) {
        request.log.error("Error creating comment:", err);
        // If table doesn't exist yet (migration not run) or any Prisma error
        if (
          err.message?.includes("does not exist") ||
          err.code === "P2021" ||
          err.code === "P1001" ||
          err.code === "P1003" ||
          err.name === "PrismaClientKnownRequestError" ||
          err.name === "PrismaClientUnknownRequestError" ||
          err.name === "PrismaClientInitializationError"
        ) {
          return reply.status(503).send({
            error: "Comments feature not available",
            message: "Database migration required. Please run database migrations.",
          });
        }
        // For any other error, return 500
        return reply.status(500).send({
          error: "Failed to create comment",
          message: err.message,
        });
      }
    }
  );

  /**
   * Update a project
   * Requires CompanyAdministrator or GlobalAdministrator role
   * All fields are optional - only provided fields are updated
   */
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
      schema: {
        description: "Update a project. Requires CompanyAdministrator or GlobalAdministrator role. All fields are optional - only provided fields are updated.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            name: {
              type: "string",
              nullable: true,
              description: "Project name",
            },
            type: {
              type: "string",
              nullable: true,
              description: "Project type (null to clear)",
            },
            startDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "Project start date (ISO 8601 date, null to clear)",
            },
            endDate: {
              type: "string",
              format: "date",
              nullable: true,
              description: "Project end date (ISO 8601 date, null to clear)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              members: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string", nullable: true },
                    firstName: { type: "string", nullable: true },
                    lastName: { type: "string", nullable: true },
                  },
                },
              },
            },
            description: "Updated project",
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
            description: "Forbidden - requires admin role or tenant",
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
        logoData: updatedProject.logoData,
        logoFileName: updatedProject.logoFileName,
        logoFileType: updatedProject.logoFileType,
        bannerData: updatedProject.bannerData,
        bannerFileName: updatedProject.bannerFileName,
        bannerFileType: updatedProject.bannerFileType,
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

  /**
   * Delete a project
   * Requires CompanyAdministrator or GlobalAdministrator role
   * Cascades to delete phases, tasks, and related data
   */
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Delete a project. Requires CompanyAdministrator or GlobalAdministrator role. Cascades to delete all phases, tasks, and related data.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          204: {
            description: "Project deleted successfully",
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
            description: "Forbidden - requires admin role or tenant",
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

  /**
   * Update project graphics (logo and/or banner)
   * Requires CompanyAdministrator or GlobalAdministrator role
   * All fields are optional - only provided fields are updated
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      logoData?: string | null;
      logoFileName?: string | null;
      logoFileType?: string | null;
      logoShape?: string | null;
      logoPlacement?: string | null;
      logoBorder?: string | null;
      bannerData?: string | null;
      bannerFileName?: string | null;
      bannerFileType?: string | null;
    };
  }>(
    "/:id/graphics",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Update project graphics (logo and/or banner). Requires CompanyAdministrator or GlobalAdministrator role. All fields are optional - only provided fields are updated.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            logoData: {
              type: "string",
              nullable: true,
              description: "Base64 encoded logo image data",
            },
            logoFileName: {
              type: "string",
              nullable: true,
              description: "Original logo filename",
            },
            logoFileType: {
              type: "string",
              nullable: true,
              description: "Logo MIME type (e.g., image/png)",
            },
            logoShape: {
              type: "string",
              nullable: true,
              description: "Logo shape: 'rounded-rect' or 'circle'",
            },
            logoPlacement: {
              type: "string",
              nullable: true,
              description: "Logo placement: 'above-top-left', 'above-center', 'above-right', 'overlay-top-left', 'overlay-top-right', 'overlay-bottom-left', 'overlay-bottom-right'",
            },
            logoBorder: {
              type: "string",
              nullable: true,
              description: "Logo border: 'none', 'white', or 'black'",
            },
            bannerData: {
              type: "string",
              nullable: true,
              description: "Base64 encoded banner image data",
            },
            bannerFileName: {
              type: "string",
              nullable: true,
              description: "Original banner filename",
            },
            bannerFileType: {
              type: "string",
              nullable: true,
              description: "Banner MIME type (e.g., image/png)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", nullable: true },
              startDate: { type: "string", format: "date-time", nullable: true },
              endDate: { type: "string", format: "date-time", nullable: true },
              logoData: { type: "string", nullable: true },
              logoFileName: { type: "string", nullable: true },
              logoFileType: { type: "string", nullable: true },
              logoShape: { type: "string", nullable: true },
              logoPlacement: { type: "string", nullable: true },
              logoBorder: { type: "string", nullable: true },
              bannerData: { type: "string", nullable: true },
              bannerFileName: { type: "string", nullable: true },
              bannerFileType: { type: "string", nullable: true },
              tenantId: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Updated project with graphics",
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
            description: "Forbidden - requires admin role or tenant",
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
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          logoData?: string | null;
          logoFileName?: string | null;
          logoFileType?: string | null;
          logoShape?: string | null;
          logoPlacement?: string | null;
          logoBorder?: string | null;
          bannerData?: string | null;
          bannerFileName?: string | null;
          bannerFileType?: string | null;
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

      // Build update data object with only provided fields
      const updateData: any = {};
      if (request.body.logoData !== undefined) {
        updateData.logoData = request.body.logoData === null ? null : request.body.logoData;
      }
      if (request.body.logoFileName !== undefined) {
        updateData.logoFileName = request.body.logoFileName === null ? null : request.body.logoFileName;
      }
      if (request.body.logoFileType !== undefined) {
        updateData.logoFileType = request.body.logoFileType === null ? null : request.body.logoFileType;
      }
      if (request.body.logoShape !== undefined) {
        updateData.logoShape = request.body.logoShape === null ? null : request.body.logoShape;
      }
      if (request.body.logoPlacement !== undefined) {
        updateData.logoPlacement = request.body.logoPlacement === null ? null : request.body.logoPlacement;
      }
      if (request.body.logoBorder !== undefined) {
        updateData.logoBorder = request.body.logoBorder === null ? null : request.body.logoBorder;
      }
      if (request.body.bannerData !== undefined) {
        updateData.bannerData = request.body.bannerData === null ? null : request.body.bannerData;
      }
      if (request.body.bannerFileName !== undefined) {
        updateData.bannerFileName = request.body.bannerFileName === null ? null : request.body.bannerFileName;
      }
      if (request.body.bannerFileType !== undefined) {
        updateData.bannerFileType = request.body.bannerFileType === null ? null : request.body.bannerFileType;
      }

      let updatedProject;
      try {
        // Update project graphics
        updatedProject = await db.project.update({
          where: { id: projectId },
          data: updateData,
        });
      } catch (error: any) {
        request.log.error({ error, projectId, updateData: { ...updateData, logoData: updateData.logoData ? `${updateData.logoData?.substring(0, 50)}...` : null, bannerData: updateData.bannerData ? `${updateData.bannerData?.substring(0, 50)}...` : null } }, "Error updating project graphics");
        return reply.status(500).send({ error: "Failed to update project graphics", message: error.message });
      }

      if (!updatedProject) {
        return reply.status(404).send({ error: "Project not found after update" });
      }

      // Verify graphics data was saved (log lengths for debugging)
      if (request.body.logoData !== undefined && updatedProject.logoData) {
        request.log.info({ 
          projectId, 
          logoDataLength: updatedProject.logoData.length,
          logoFileName: updatedProject.logoFileName,
          logoFileType: updatedProject.logoFileType
        }, "Logo graphics saved successfully");
      }
      if (request.body.bannerData !== undefined && updatedProject.bannerData) {
        request.log.info({ 
          projectId, 
          bannerDataLength: updatedProject.bannerData.length,
          bannerFileName: updatedProject.bannerFileName,
          bannerFileType: updatedProject.bannerFileType
        }, "Banner graphics saved successfully");
      }

      return reply.send({
        id: updatedProject.id,
        name: updatedProject.name,
        type: updatedProject.type,
        startDate: updatedProject.startDate,
        endDate: updatedProject.endDate,
        logoData: updatedProject.logoData,
        logoFileName: updatedProject.logoFileName,
        logoFileType: updatedProject.logoFileType,
        logoShape: updatedProject.logoShape,
        logoPlacement: updatedProject.logoPlacement,
        logoBorder: updatedProject.logoBorder,
        bannerData: updatedProject.bannerData,
        bannerFileName: updatedProject.bannerFileName,
        bannerFileType: updatedProject.bannerFileType,
        tenantId: updatedProject.tenantId,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
      });
    }
  );

  /**
   * Delete project logo
   * Requires CompanyAdministrator or GlobalAdministrator role
   */
  fastify.delete<{ Params: { id: string } }>(
    "/:id/graphics/logo",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Delete project logo. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              logoData: { type: "string", nullable: true },
              logoFileName: { type: "string", nullable: true },
              logoFileType: { type: "string", nullable: true },
            },
            description: "Project with logo deleted",
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
            description: "Forbidden - requires admin role or tenant",
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

      // Delete logo
      const updatedProject = await db.project.update({
        where: { id: projectId },
        data: {
          logoData: null,
          logoFileName: null,
          logoFileType: null,
        },
      });

      return reply.send({
        id: updatedProject.id,
        name: updatedProject.name,
        logoData: updatedProject.logoData,
        logoFileName: updatedProject.logoFileName,
        logoFileType: updatedProject.logoFileType,
      });
    }
  );

  /**
   * Delete project banner
   * Requires CompanyAdministrator or GlobalAdministrator role
   */
  fastify.delete<{ Params: { id: string } }>(
    "/:id/graphics/banner",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Delete project banner. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              bannerData: { type: "string", nullable: true },
              bannerFileName: { type: "string", nullable: true },
              bannerFileType: { type: "string", nullable: true },
            },
            description: "Project with banner deleted",
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
            description: "Forbidden - requires admin role or tenant",
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

      // Delete banner
      const updatedProject = await db.project.update({
        where: { id: projectId },
        data: {
          bannerData: null,
          bannerFileName: null,
          bannerFileType: null,
        },
      });

      return reply.send({
        id: updatedProject.id,
        name: updatedProject.name,
        bannerData: updatedProject.bannerData,
        bannerFileName: updatedProject.bannerFileName,
        bannerFileType: updatedProject.bannerFileType,
      });
    }
  );

  /**
   * Get dashboard statistics for a project
   * User must be a project member or company admin
   * Returns vendor, RFI, and requirements statistics
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/dashboard/stats",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get dashboard statistics for a project including vendor counts, RFI status, and requirements statistics. User must be a project member or company administrator.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              vendors: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  byStatus: {
                    type: "object",
                    additionalProperties: { type: "number" },
                    description: "Vendor counts grouped by status",
                  },
                },
              },
              rfi: {
                type: "object",
                properties: {
                  questionCount: { type: "number" },
                  status: {
                    type: "string",
                    enum: ["planning", "ongoing", "finished"],
                  },
                  deadline: { type: "string", format: "date-time", nullable: true },
                },
              },
              requirements: {
                type: "object",
                properties: {
                  total: { type: "number" },
                  byStatus: {
                    type: "object",
                    additionalProperties: { type: "number" },
                    description: "Requirement counts grouped by status",
                  },
                  byType: {
                    type: "object",
                    additionalProperties: { type: "number" },
                    description: "Requirement counts grouped by type",
                  },
                  unresolvedComments: { type: "number" },
                },
              },
            },
            description: "Dashboard statistics",
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
    async (request, reply) => {
      const projectId = request.params.id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project exists and user has access
      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

      // Get vendor stats
      const projectVendors = await db.projectVendor.findMany({
        where: { projectId },
        select: { status: true },
      });

      const vendorStats = {
        total: projectVendors.length,
        byStatus: projectVendors.reduce((acc, pv) => {
          acc[pv.status] = (acc[pv.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      // Get RFI stats
      const rfi = await db.rFI.findUnique({
        where: { projectId },
        include: {
          questions: true,
        },
      });

      let rfiStatus: "planning" | "ongoing" | "finished" = "planning";
      if (rfi?.isPublished && rfi.deadline) {
        const deadline = new Date(rfi.deadline);
        const now = new Date();
        if (now > deadline) {
          rfiStatus = "finished";
        } else {
          rfiStatus = "ongoing";
        }
      } else if (rfi?.isPublished) {
        rfiStatus = "ongoing";
      }

      const rfiStats = {
        questionCount: rfi?.questions?.length || 0,
        status: rfiStatus,
        deadline: rfi?.deadline || null,
      };

      // Get requirements stats
      const requirements = await db.requirement.findMany({
        where: {
          hierarchy: {
            projectId,
          },
        },
        select: {
          type: true,
          status: true,
        },
      });

      const requirementsByStatus = requirements.reduce((acc, req) => {
        const status = req.status || "None";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const requirementsByType = requirements.reduce((acc, req) => {
        acc[req.type] = (acc[req.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get unresolved comments count
      // Note: RequirementComment model doesn't exist yet, returning 0
      const unresolvedComments = 0;

      const requirementsStats = {
        total: requirements.length,
        byStatus: requirementsByStatus,
        byType: requirementsByType,
        unresolvedComments,
      };

      return reply.send({
        vendors: vendorStats,
        rfi: rfiStats,
        requirements: requirementsStats,
      });
    }
  );

  /**
   * Get all vendors for a project
   * User must be a project member or company admin
   * Returns vendors with their contact persons
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/vendors",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all vendors linked to a project. User must be a project member or company administrator. Returns vendors with their contact persons ordered by vendor name.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "ProjectVendor relationship ID" },
                projectId: { type: "string" },
                vendorId: { type: "string" },
                status: { type: "string", description: "Vendor status in project" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                vendor: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    organizationNumber: { type: "string", nullable: true },
                    emailDomain: { type: "string", nullable: true },
                    additionalData: { type: "object", nullable: true },
                    contacts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          firstName: { type: "string", nullable: true },
                          lastName: { type: "string", nullable: true },
                          email: { type: "string", nullable: true },
                          isMainContact: { type: "boolean" },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
            description: "Array of project vendors with contact information",
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
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or database models not available",
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Add/link vendor to project
   * User must be a project member or company admin
   * Can link existing vendor or create new one with brreg.no validation
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Add or link a vendor to a project. User must be a project member or company administrator. Can link an existing vendor by vendorId or create a new vendor. Organization numbers are validated with brreg.no.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["name"],
          properties: {
            vendorId: {
              type: "string",
              nullable: true,
              description: "Existing vendor ID to link (if not provided, creates new vendor)",
            },
            name: {
              type: "string",
              description: "Vendor name (required for new vendors)",
            },
            organizationNumber: {
              type: "string",
              nullable: true,
              description: "Norwegian organization number (9 digits, validated with brreg.no)",
            },
            emailDomain: {
              type: "string",
              nullable: true,
              description: "Vendor email domain",
            },
            additionalData: {
              type: "object",
              nullable: true,
              description: "Additional vendor data (JSON object)",
            },
            status: {
              type: "string",
              nullable: true,
              description: "Vendor status in project (defaults to 'Pending')",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", description: "ProjectVendor relationship ID" },
              projectId: { type: "string" },
              vendorId: { type: "string" },
              status: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              vendor: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  organizationNumber: { type: "string", nullable: true },
                  emailDomain: { type: "string", nullable: true },
                  additionalData: { type: "object", nullable: true },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        firstName: { type: "string", nullable: true },
                        lastName: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        isMainContact: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
            description: "Vendor linked to project successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              brregName: { type: "string", nullable: true },
            },
            description: "Validation error, duplicate vendor, or invalid organization number",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or vendor not found",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

      // Validate and set status
      let status: VendorStatus = VendorStatus.Pending;
      if (request.body.status) {
        const statusValue = request.body.status as string;
        if (Object.values(VendorStatus).includes(statusValue as VendorStatus)) {
          status = statusValue as VendorStatus;
        } else {
          return reply.status(400).send({
            error: `Invalid status value. Must be one of: ${Object.values(VendorStatus).join(", ")}`,
          });
        }
      }

      // Create project-vendor link
      const projectVendor = await db.projectVendor.create({
        data: {
          projectId,
          vendorId: vendor.id,
          status,
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

  /**
   * Update vendor details
   * User must be a project member or company admin
   * Updates vendor information with brreg.no validation for organization numbers
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Update vendor details (name, organization number, email domain, additional data). User must be a project member or company administrator. Organization numbers are validated with brreg.no. Prevents duplicate names or organization numbers within the project.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorId: {
              type: "string",
              description: "Vendor ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            name: {
              type: "string",
              nullable: true,
              description: "Vendor name (cannot be empty if provided)",
            },
            organizationNumber: {
              type: "string",
              nullable: true,
              description: "Norwegian organization number (9 digits, validated with brreg.no)",
            },
            emailDomain: {
              type: "string",
              nullable: true,
              description: "Vendor email domain",
            },
            additionalData: {
              type: "object",
              nullable: true,
              description: "Additional vendor data (JSON object)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", description: "ProjectVendor relationship ID" },
              projectId: { type: "string" },
              vendorId: { type: "string" },
              status: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              vendor: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  organizationNumber: { type: "string", nullable: true },
                  emailDomain: { type: "string", nullable: true },
                  additionalData: { type: "object", nullable: true },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        firstName: { type: "string", nullable: true },
                        lastName: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        isMainContact: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
            description: "Updated project-vendor with vendor details",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              brregName: { type: "string", nullable: true },
            },
            description: "Validation error, duplicate vendor, or invalid organization number",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or vendor not found, or vendor not linked to project",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  /**
   * Update project-vendor relationship status
   * User must be a project member or company admin
   * Updates only the status field of the project-vendor relationship
   */
  fastify.put<{
    Params: { id: string; vendorId: string };
    Body: {
      status: string;
    };
  }>(
    "/:id/vendors/:vendorId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update the status of a vendor in a project. User must be a project member or company administrator. Only updates the project-vendor relationship status, not the vendor details themselves.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorId: {
              type: "string",
              description: "Vendor ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              description: "New status for the vendor in this project",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", description: "ProjectVendor relationship ID" },
              projectId: { type: "string" },
              vendorId: { type: "string" },
              status: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
              vendor: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  organizationNumber: { type: "string", nullable: true },
                  emailDomain: { type: "string", nullable: true },
                  additionalData: { type: "object", nullable: true },
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        firstName: { type: "string", nullable: true },
                        lastName: { type: "string", nullable: true },
                        email: { type: "string", nullable: true },
                        isMainContact: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
            description: "Updated project-vendor relationship",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or vendor not found, or vendor not linked to project",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

      // Validate status
      const statusValue = request.body.status as string;
      if (!Object.values(VendorStatus).includes(statusValue as VendorStatus)) {
        return reply.status(400).send({
          error: `Invalid status value. Must be one of: ${Object.values(VendorStatus).join(", ")}`,
        });
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
          status: statusValue as VendorStatus,
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

  /**
   * Remove vendor from project
   * User must be a project member or company admin
   * Removes the project-vendor link but keeps the vendor for other projects
   */
  fastify.delete<{ Params: { id: string; vendorId: string } }>(
    "/:id/vendors/:vendorId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Remove a vendor from a project. User must be a project member or company administrator. This removes the project-vendor relationship but keeps the vendor entity for use in other projects.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorId: {
              type: "string",
              description: "Vendor ID",
            },
          },
        },
        response: {
          204: {
            description: "Vendor removed from project successfully",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or vendor not found, or vendor not linked to project",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  /**
   * Add contact person to vendor
   * User must be a project member or company admin
   * First contact is automatically set as main contact if not specified
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Add a contact person to a vendor. User must be a project member or company administrator. The first contact is automatically set as main contact if not specified. Setting a new contact as main contact will unset other main contacts.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorId: {
              type: "string",
              description: "Vendor ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["firstName", "lastName", "email"],
          properties: {
            firstName: {
              type: "string",
              description: "Contact first name",
            },
            lastName: {
              type: "string",
              description: "Contact last name",
            },
            email: {
              type: "string",
              format: "email",
              description: "Contact email address",
            },
            isMainContact: {
              type: "boolean",
              nullable: true,
              description: "Whether this contact is the main contact (defaults to true for first contact)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              vendorId: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              isMainContact: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Contact person created successfully",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project or vendor not found, or vendor not linked to project",
          },
        },
      },
    },
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

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  /**
   * Update contact person
   * User must be a project member or company admin
   * Setting as main contact will unset other main contacts
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Update a contact person for a vendor. User must be a project member or company administrator. All fields are optional. Setting a contact as main contact will automatically unset other main contacts for the vendor.",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId", "contactId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorId: {
              type: "string",
              description: "Vendor ID",
            },
            contactId: {
              type: "string",
              description: "Contact person ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            firstName: {
              type: "string",
              nullable: true,
              description: "Contact first name",
            },
            lastName: {
              type: "string",
              nullable: true,
              description: "Contact last name",
            },
            email: {
              type: "string",
              format: "email",
              nullable: true,
              description: "Contact email address",
            },
            isMainContact: {
              type: "boolean",
              nullable: true,
              description: "Whether this contact is the main contact",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              vendorId: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              isMainContact: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
            description: "Contact person updated successfully",
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
            description: "Access denied or tenant required",
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Project, vendor, or contact not found",
          },
        },
      },
    },
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
      const vendorId = request.params.vendorId;
      const contactId = request.params.contactId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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
      const vendorId = request.params.vendorId;
      const contactId = request.params.contactId;
      if (!request.user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);

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

  // Bulk import endpoints
  /**
   * Bulk import tasks
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      phaseId: string;
      tasks: Array<{ name: string }>;
    };
  }>(
    "/:id/import/tasks",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk import tasks into a phase",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["phaseId", "tasks"],
          properties: {
            phaseId: { type: "string" },
            tasks: {
              type: "array",
              items: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              count: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      const phaseId = request.body.phaseId;

      await verifyProjectAccess(request, reply);

      // Verify phase belongs to project
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
      });

      if (!phase || phase.projectId !== projectId) {
        return reply.status(404).send({ error: "Phase not found" });
      }

      // Get current max order
      const maxOrderTask = await db.task.findFirst({
        where: { phaseId },
        orderBy: { order: "desc" },
      });
      let currentOrder = maxOrderTask ? maxOrderTask.order + 1 : 1;

      // Create tasks in order
      let count = 0;
      for (const taskData of request.body.tasks) {
        if (!taskData.name || !taskData.name.trim()) {
          continue; // Skip empty names
        }

        await db.task.create({
          data: {
            phaseId,
            name: taskData.name.trim(),
            order: currentOrder++,
          },
        });
        count++;
      }

      return reply.status(200).send({ count });
    }
  );

  /**
   * Bulk import RFI questions
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      questions: Array<{ title: string }>;
    };
  }>(
    "/:id/import/rfi-questions",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk import RFI questions",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["questions"],
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              count: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;

      await verifyProjectAccess(request, reply);

      // Get or create RFI
      let rfi = await db.rFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        rfi = await db.rFI.create({
          data: {
            projectId,
            emailSubject: "",
            emailText: "",
            rfiInformation: "",
          },
        });
      }

      // Get max order
      const maxOrderQuestion = await db.rFIQuestion.findFirst({
        where: { rfiId: rfi.id },
        orderBy: { order: "desc" },
      });
      let currentOrder = maxOrderQuestion ? maxOrderQuestion.order + 1 : 1;

      // Create questions in order
      let count = 0;
      for (const questionData of request.body.questions) {
        if (!questionData.title || !questionData.title.trim()) {
          continue; // Skip empty titles
        }

        await db.rFIQuestion.create({
          data: {
            rfiId: rfi.id,
            title: questionData.title.trim(),
            type: "SingleText",
            required: false,
            order: currentOrder++,
          },
        });
        count++;
      }

      return reply.status(200).send({ count });
    }
  );

  /**
   * Bulk import requirements with hierarchy
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      requirements: Array<{
        level1: string;
        level2?: string;
        requirement: string;
        type?: string;
      }>;
    };
  }>(
    "/:id/import/requirements",
    {
      preHandler: [authenticate],
      schema: {
        description: "Bulk import requirements with hierarchy",
        tags: ["projects"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["requirements"],
          properties: {
            requirements: {
              type: "array",
              items: {
                type: "object",
                required: ["level1", "requirement"],
                properties: {
                  level1: { type: "string" },
                  level2: { type: "string" },
                  requirement: { type: "string" },
                  type: { type: "string" },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              count: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Verify project access using middleware
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const currentUser = getUser(request);

        // Validate request body
        if (!request.body || !Array.isArray(request.body.requirements)) {
          return reply.status(400).send({ error: "Invalid request body: requirements array is required" });
        }

        // Track created hierarchies to avoid duplicates
        const level1Hierarchies = new Map<string, string>(); // level1 title -> hierarchy id
        const level2Hierarchies = new Map<string, string>(); // "level1|level2" -> hierarchy id

        let count = 0;

        for (const reqData of request.body.requirements) {
        if (!reqData.level1 || !reqData.level1.trim() || !reqData.requirement || !reqData.requirement.trim()) {
          continue; // Skip invalid entries
        }

        const level1Title = reqData.level1.trim();
        const level2Title = reqData.level2?.trim() || "";
        const requirementDesc = reqData.requirement.trim();

        // Get or create level 1 hierarchy
        let level1HierarchyId = level1Hierarchies.get(level1Title);
        if (!level1HierarchyId) {
          // Check if it already exists
          const existing = await db.requirementHierarchy.findFirst({
            where: {
              projectId,
              parentId: null,
              title: level1Title,
            },
          });

          if (existing) {
            level1HierarchyId = existing.id;
          } else {
            // Create new level 1 hierarchy
            const number = await generateHierarchyNumber(projectId, null);
            const maxOrder = await db.requirementHierarchy.findFirst({
              where: { projectId, parentId: null },
              orderBy: { order: "desc" },
            });
            const order = maxOrder ? maxOrder.order + 1 : 1;

            const newHierarchy = await db.requirementHierarchy.create({
              data: {
                projectId,
                parentId: null,
                number,
                title: level1Title,
                order,
              },
            });
            level1HierarchyId = newHierarchy.id;
          }
          level1Hierarchies.set(level1Title, level1HierarchyId);
        }

        // Get or create level 2 hierarchy if needed
        let targetHierarchyId = level1HierarchyId;
        if (level2Title) {
          const level2Key = `${level1Title}|${level2Title}`;
          let level2HierarchyId = level2Hierarchies.get(level2Key);
          if (!level2HierarchyId) {
            // Check if it already exists
            const existing = await db.requirementHierarchy.findFirst({
              where: {
                projectId,
                parentId: level1HierarchyId,
                title: level2Title,
              },
            });

            if (existing) {
              level2HierarchyId = existing.id;
            } else {
              // Create new level 2 hierarchy
              const number = await generateHierarchyNumber(projectId, level1HierarchyId);
              const maxOrder = await db.requirementHierarchy.findFirst({
                where: { projectId, parentId: level1HierarchyId },
                orderBy: { order: "desc" },
              });
              const order = maxOrder ? maxOrder.order + 1 : 1;

              const newHierarchy = await db.requirementHierarchy.create({
                data: {
                  projectId,
                  parentId: level1HierarchyId,
                  number,
                  title: level2Title,
                  order,
                },
              });
              level2HierarchyId = newHierarchy.id;
            }
            level2Hierarchies.set(level2Key, level2HierarchyId);
          }
          targetHierarchyId = level2HierarchyId;
        }

        // Create requirement
        const hierarchy = await db.requirementHierarchy.findUnique({
          where: { id: targetHierarchyId },
        });
        if (!hierarchy) {
          continue; // Skip if hierarchy not found
        }

        const requirementNumber = await generateRequirementNumber(targetHierarchyId);
        const maxOrder = await db.requirement.findFirst({
          where: { hierarchyId: targetHierarchyId },
          orderBy: { order: "desc" },
        });
        const order = maxOrder ? maxOrder.order + 1 : 1;

        // Validate and set requirement type
        const validTypes = ["Information", "Mandatory", "Important", "Wish"];
        const requirementType = reqData.type && validTypes.includes(reqData.type)
          ? (reqData.type as any)
          : "Information";

        await db.requirement.create({
          data: {
            hierarchyId: targetHierarchyId,
            number: requirementNumber,
            description: requirementDesc,
            type: requirementType,
            status: RequirementStatus.Imported,
            order,
            createdById: currentUser.userId,
            lastModifiedById: currentUser.userId,
          },
        });

          count++;
        }

        return reply.status(200).send({ count });
      } catch (error: any) {
        request.log.error(error, "Error importing requirements");
        return reply.status(500).send({ 
          error: "Failed to import requirements",
          message: error.message || "An unexpected error occurred"
        });
      }
    }
  );
}

