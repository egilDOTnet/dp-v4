import { FastifyInstance } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser, requireRole } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/project-access";
import { Prisma } from "@prisma/client";

/**
 * Helper function to check if user is admin
 */
function isAdmin(user: { role: string }): boolean {
  return user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator";
}

/**
 * Helper function to anonymize vendor IDs consistently
 * Returns V1, V2, V3... based on vendor order
 */
function getAnonymizedVendorId(vendorId: string, vendorOrder: Map<string, number>): string {
  const order = vendorOrder.get(vendorId) ?? 0;
  return `V${order + 1}`;
}


export default async function evaluationRoutes(fastify: FastifyInstance) {
  /**
   * Get current user's scores for all vendors/requirements
   * Non-admins see only their own scores, admins see all
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/scores",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get evaluation scores. Non-admins see only their own scores, admins see all.",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Evaluation scores" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const projectId = request.params.id;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get all vendor responses for this RFP
        const vendorResponses = await db.rFPVendorResponse.findMany({
          where: { rfpId: rfp.id },
          include: {
            projectVendor: {
              include: {
                vendor: true,
              },
            },
          },
        });

        // Build vendor order map for anonymization
        const vendorOrder = new Map<string, number>();
        vendorResponses.forEach((vr, index) => {
          vendorOrder.set(vr.projectVendor.vendorId, index);
        });

        // Get scores - filter by user if not admin
        const whereClause: any = {
          vendorResponse: {
            rfpId: rfp.id,
          },
        };

        if (!isAdmin(user)) {
          whereClause.evaluatedById = user.userId;
        }

        const scores = await db.evaluationScore.findMany({
          where: whereClause,
          include: {
            requirement: {
              include: {
                hierarchy: true,
              },
            },
            vendorResponse: {
              include: {
                projectVendor: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
            evaluatedBy: {
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

        // Format response
        const response = scores.map((score) => ({
          id: score.id,
          vendorResponseId: score.vendorResponseId,
          requirementId: score.requirementId,
          score: score.score,
          note: score.note,
          question: score.question,
          evaluatedById: score.evaluatedById,
          evaluatedAt: score.evaluatedAt.toISOString(),
          updatedAt: score.updatedAt.toISOString(),
          requirement: {
            id: score.requirement.id,
            number: score.requirement.number,
            description: score.requirement.description,
            type: score.requirement.type,
            hierarchy: {
              id: score.requirement.hierarchy.id,
              number: score.requirement.hierarchy.number,
              title: score.requirement.hierarchy.title,
              parentId: score.requirement.hierarchy.parentId,
            },
          },
          vendorResponse: {
            id: score.vendorResponse.id,
            vendorId: score.vendorResponse.projectVendor.vendorId,
            vendorName: score.vendorResponse.projectVendor.vendor.name,
            anonymizedId: isAdmin(user)
              ? getAnonymizedVendorId(score.vendorResponse.projectVendor.vendorId, vendorOrder)
              : undefined,
          },
          evaluatedBy: score.evaluatedBy,
        }));

        return reply.send(response);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/scores");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get requirements with vendor responses for scoring interface
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/requirements",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get requirements with vendor responses for scoring interface",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Requirements with vendor responses" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get all requirements for the project
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
            rfpRequirementResponses: {
              where: {
                vendorResponse: {
                  rfpId: rfp.id,
                },
              },
              include: {
                vendorResponse: {
                  include: {
                    projectVendor: {
                      include: {
                        vendor: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            {
              hierarchy: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
        });

        // Get all vendor responses for this RFP
        const vendorResponses = await db.rFPVendorResponse.findMany({
          where: { rfpId: rfp.id },
          include: {
            projectVendor: {
              include: {
                vendor: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // Build vendor order map
        const vendorOrder = new Map<string, number>();
        vendorResponses.forEach((vr, index) => {
          vendorOrder.set(vr.projectVendor.vendorId, index);
        });

        // Format response
        const response = requirements.map((req) => ({
          id: req.id,
          number: req.number,
          description: req.description,
          type: req.type,
          hierarchy: {
            id: req.hierarchy.id,
            number: req.hierarchy.number,
            title: req.hierarchy.title,
            parentId: req.hierarchy.parentId,
            parent: req.hierarchy.parent
              ? {
                  id: req.hierarchy.parent.id,
                  number: req.hierarchy.parent.number,
                  title: req.hierarchy.parent.title,
                }
              : null,
          },
          vendorResponses: req.rfpRequirementResponses.map((rr) => ({
            id: rr.id,
            vendorResponseId: rr.vendorResponseId,
            answer: rr.answer,
            description: rr.description,
            reference: rr.reference,
            vendor: {
              id: rr.vendorResponse.projectVendor.vendorId,
              name: rr.vendorResponse.projectVendor.vendor.name,
              anonymizedId: `V${(vendorOrder.get(rr.vendorResponse.projectVendor.vendorId) ?? 0) + 1}`,
            },
          })),
        }));

        return reply.send(response);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/requirements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create or update evaluation score (upsert)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      vendorResponseId: string;
      requirementId: string;
      score: number | null;
      note?: string | null;
      question?: string | null;
    };
  }>(
    "/:id/rfp/evaluation/scores",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create or update evaluation score (upsert)",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        body: {
          type: "object",
          required: ["vendorResponseId", "requirementId"],
          properties: {
            vendorResponseId: { type: "string" },
            requirementId: { type: "string" },
            score: { type: ["number", "null"], minimum: 1, maximum: 5 },
            note: { type: ["string", "null"] },
            question: { type: ["string", "null"] },
          },
        },
        response: {
          200: { description: "Created or updated score" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const { vendorResponseId, requirementId, score, note, question } = request.body;

        // Validate score range
        if (score !== null && (score < 1 || score > 5)) {
          return reply.status(400).send({ error: "Score must be between 1 and 5, or null" });
        }

        // Verify vendor response belongs to project's RFP
        const vendorResponse = await db.rFPVendorResponse.findUnique({
          where: { id: vendorResponseId },
          include: {
            rfp: true,
          },
        });

        if (!vendorResponse) {
          return reply.status(404).send({ error: "Vendor response not found" });
        }

        const projectId = request.params.id;
        if (vendorResponse.rfp.projectId !== projectId) {
          return reply.status(403).send({ error: "Vendor response does not belong to this project" });
        }

        // Verify requirement belongs to project
        const requirement = await db.requirement.findUnique({
          where: { id: requirementId },
          include: {
            hierarchy: true,
          },
        });

        if (!requirement) {
          return reply.status(404).send({ error: "Requirement not found" });
        }

        // Get project to verify
        const project = await db.project.findUnique({
          where: { id: projectId },
        });

        if (!project || requirement.hierarchy.projectId !== projectId) {
          return reply.status(403).send({ error: "Requirement does not belong to this project" });
        }

        // Upsert score
        const evaluationScore = await db.evaluationScore.upsert({
          where: {
            vendorResponseId_requirementId_evaluatedById: {
              vendorResponseId,
              requirementId,
              evaluatedById: user.userId,
            },
          },
          create: {
            vendorResponseId,
            requirementId,
            score,
            note: note ?? null,
            question: question ?? null,
            evaluatedById: user.userId,
          },
          update: {
            score,
            note: note ?? null,
            question: question ?? null,
            updatedAt: new Date(),
          },
          include: {
            requirement: {
              include: {
                hierarchy: true,
              },
            },
            vendorResponse: {
              include: {
                projectVendor: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
            evaluatedBy: {
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

        return reply.send({
          id: evaluationScore.id,
          vendorResponseId: evaluationScore.vendorResponseId,
          requirementId: evaluationScore.requirementId,
          score: evaluationScore.score,
          note: evaluationScore.note,
          question: evaluationScore.question,
          evaluatedById: evaluationScore.evaluatedById,
          evaluatedAt: evaluationScore.evaluatedAt.toISOString(),
          updatedAt: evaluationScore.updatedAt.toISOString(),
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/evaluation/scores");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete score (set score to null)
   */
  fastify.delete<{
    Params: { id: string; scoreId: string };
  }>(
    "/:id/rfp/evaluation/scores/:scoreId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete evaluation score (set score to null)",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "scoreId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            scoreId: { type: "string", description: "Score ID" },
          },
        },
        response: {
          200: { description: "Score deleted" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const { scoreId } = request.params;

        // Get score and verify ownership (non-admins can only delete their own)
        const score = await db.evaluationScore.findUnique({
          where: { id: scoreId },
          include: {
            vendorResponse: {
              include: {
                rfp: true,
              },
            },
          },
        });

        if (!score) {
          return reply.status(404).send({ error: "Score not found" });
        }

        // Verify it belongs to the project
        const projectId = request.params.id;
        if (score.vendorResponse.rfp.projectId !== projectId) {
          return reply.status(403).send({ error: "Score does not belong to this project" });
        }

        // Non-admins can only delete their own scores
        if (!isAdmin(user) && score.evaluatedById !== user.userId) {
          return reply.status(403).send({ error: "You can only delete your own scores" });
        }

        // Delete score
        await db.evaluationScore.delete({
          where: { id: scoreId },
        });

        return reply.status(204).send();
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/evaluation/scores/:scoreId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get evaluation progress stats for current user
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/progress",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get evaluation progress stats for current user",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Evaluation progress" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const projectId = request.params.id;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get all requirements
        const requirements = await db.requirement.findMany({
          where: {
            hierarchy: {
              projectId,
            },
          },
        });

        // Get all vendor responses
        const vendorResponses = await db.rFPVendorResponse.findMany({
          where: { rfpId: rfp.id },
        });

        // Get user's scores
        const userScores = await db.evaluationScore.findMany({
          where: {
            evaluatedById: user.userId,
            vendorResponse: {
              rfpId: rfp.id,
            },
          },
        });

        // Calculate progress
        const totalNeeded = requirements.length * vendorResponses.length;
        const completed = userScores.filter((s) => s.score !== null).length;
        const notesCount = userScores.filter((s) => s.note && s.note.trim() !== "").length;
        const questionsCount = userScores.filter((s) => s.question && s.question.trim() !== "").length;

        return reply.send({
          totalNeeded,
          completed,
          percentage: totalNeeded > 0 ? Math.round((completed / totalNeeded) * 100) : 0,
          notesCount,
          questionsCount,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/progress");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get hierarchy weights (Admin Only)
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/hierarchy-weights",
    {
      preHandler: [authenticate, requireRole(["CompanyAdministrator", "GlobalAdministrator"])],
      schema: {
        description: "Get hierarchy weights (Admin Only)",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Hierarchy weights" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get all hierarchy weights
        const weights = await db.evaluationHierarchyWeight.findMany({
          where: { rfpId: rfp.id },
          include: {
            hierarchy: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        return reply.send(
          weights.map((w) => ({
            id: w.id,
            rfpId: w.rfpId,
            hierarchyId: w.hierarchyId,
            level1HierarchyId: w.level1HierarchyId,
            weight: w.weight.toString(),
            createdById: w.createdById,
            createdAt: w.createdAt.toISOString(),
            updatedAt: w.updatedAt.toISOString(),
            hierarchy: {
              id: w.hierarchy.id,
              number: w.hierarchy.number,
              title: w.hierarchy.title,
              parentId: w.hierarchy.parentId,
            },
            createdBy: w.createdBy,
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/hierarchy-weights");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update hierarchy weights (bulk update, Admin Only)
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      weights: Array<{
        hierarchyId: string;
        level1HierarchyId?: string | null;
        weight: number;
      }>;
    };
  }>(
    "/:id/rfp/evaluation/hierarchy-weights",
    {
      preHandler: [authenticate, requireRole(["CompanyAdministrator", "GlobalAdministrator"])],
      schema: {
        description: "Update hierarchy weights (bulk update, Admin Only)",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        body: {
          type: "object",
          required: ["weights"],
          properties: {
            weights: {
              type: "array",
              items: {
                type: "object",
                required: ["hierarchyId", "weight"],
                properties: {
                  hierarchyId: { type: "string" },
                  level1HierarchyId: { type: ["string", "null"] },
                  weight: { type: "number" },
                },
              },
            },
          },
        },
        response: {
          200: { description: "Updated hierarchy weights" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const projectId = request.params.id;
        const { weights } = request.body;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Validate and upsert weights
        const results = await Promise.all(
          weights.map(async (w) => {
            // Verify hierarchy belongs to project
            const hierarchy = await db.requirementHierarchy.findUnique({
              where: { id: w.hierarchyId },
            });

            if (!hierarchy || hierarchy.projectId !== projectId) {
              throw new Error(`Hierarchy ${w.hierarchyId} does not belong to this project`);
            }

            // If level1HierarchyId is provided, verify it
            if (w.level1HierarchyId) {
              const level1Hierarchy = await db.requirementHierarchy.findUnique({
                where: { id: w.level1HierarchyId },
              });

              if (!level1Hierarchy || level1Hierarchy.projectId !== projectId) {
                throw new Error(`Level 1 hierarchy ${w.level1HierarchyId} does not belong to this project`);
              }
            }

            return db.evaluationHierarchyWeight.upsert({
              where: {
                rfpId_hierarchyId_level1HierarchyId: {
                  rfpId: rfp.id,
                  hierarchyId: w.hierarchyId,
                  level1HierarchyId: w.level1HierarchyId ?? null,
                },
              },
              create: {
                rfpId: rfp.id,
                hierarchyId: w.hierarchyId,
                level1HierarchyId: w.level1HierarchyId ?? null,
                weight: new Prisma.Decimal(w.weight),
                createdById: user.userId,
              },
              update: {
                weight: new Prisma.Decimal(w.weight),
                updatedAt: new Date(),
              },
              include: {
                hierarchy: true,
              },
            });
          })
        );

        return reply.send(
          results.map((r) => ({
            id: r.id,
            rfpId: r.rfpId,
            hierarchyId: r.hierarchyId,
            level1HierarchyId: r.level1HierarchyId,
            weight: r.weight.toString(),
            createdById: r.createdById,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            hierarchy: {
              id: r.hierarchy.id,
              number: r.hierarchy.number,
              title: r.hierarchy.title,
              parentId: r.hierarchy.parentId,
            },
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/evaluation/hierarchy-weights");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get evaluation summary with aggregated scores (Admin Only)
   * Only includes requirements where all vendors have been scored by all evaluators
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/summary",
    {
      preHandler: [authenticate, requireRole(["CompanyAdministrator", "GlobalAdministrator"])],
      schema: {
        description: "Get evaluation summary with aggregated scores (Admin Only). Only includes requirements where all vendors have been scored by all evaluators.",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Evaluation summary" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get all requirements
        const requirements = await db.requirement.findMany({
          where: {
            hierarchy: {
              projectId,
            },
          },
          include: {
            hierarchy: true,
          },
        });

        // Get all vendor responses
        const vendorResponses = await db.rFPVendorResponse.findMany({
          where: { rfpId: rfp.id },
          include: {
            projectVendor: {
              include: {
                vendor: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // Build vendor order map
        const vendorOrder = new Map<string, number>();
        vendorResponses.forEach((vr, index) => {
          vendorOrder.set(vr.projectVendor.vendorId, index);
        });

        // Get all project members (evaluators)
        const projectMembers = await db.projectMember.findMany({
          where: { projectId },
          include: {
            User: true,
          },
        });

        const evaluatorIds = projectMembers.map((pm) => pm.User.id);

        // Get all scores
        const allScores = await db.evaluationScore.findMany({
          where: {
            vendorResponse: {
              rfpId: rfp.id,
            },
            requirement: {
              hierarchy: {
                projectId,
              },
            },
          },
        });

        // Group scores by requirement and vendor
        const scoresByRequirement = new Map<string, Map<string, number[]>>();

        allScores.forEach((score) => {
          if (score.score === null) return;

          const reqId = score.requirementId;
          const vendorId = score.vendorResponseId;

          if (!scoresByRequirement.has(reqId)) {
            scoresByRequirement.set(reqId, new Map());
          }

          const vendorScores = scoresByRequirement.get(reqId)!;
          if (!vendorScores.has(vendorId)) {
            vendorScores.set(vendorId, []);
          }

          vendorScores.get(vendorId)!.push(score.score!);
        });

        // Filter to only complete evaluations (all vendors scored by all evaluators)
        const completeRequirements = requirements.filter((req) => {
          const vendorScores = scoresByRequirement.get(req.id);
          if (!vendorScores) return false;

          // Check if all vendors have scores from all evaluators
          for (const vendorResponse of vendorResponses) {
            const scores = vendorScores.get(vendorResponse.id) || [];
            if (scores.length !== evaluatorIds.length) {
              return false;
            }
          }

          return true;
        });

        // Calculate aggregated scores
        const summary = completeRequirements.map((req) => {
          const vendorScores = scoresByRequirement.get(req.id)!;
          const vendorStats: Array<{
            vendorId: string;
            anonymizedId: string;
            average: number;
            scores: number[];
          }> = [];

          vendorResponses.forEach((vr) => {
            const scores = vendorScores.get(vr.id) || [];
            if (scores.length > 0) {
              const average = scores.reduce((a, b) => a + b, 0) / scores.length;
              vendorStats.push({
                vendorId: vr.projectVendor.vendorId,
                anonymizedId: getAnonymizedVendorId(vr.projectVendor.vendorId, vendorOrder),
                average: Math.round(average * 10) / 10, // Round to 1 decimal
                scores,
              });
            }
          });

          return {
            requirementId: req.id,
            requirementNumber: req.number,
            requirementDescription: req.description,
            hierarchy: {
              id: req.hierarchy.id,
              number: req.hierarchy.number,
              title: req.hierarchy.title,
              parentId: req.hierarchy.parentId,
            },
            vendorStats,
          };
        });

        // Calculate overall stats
        const totalRequirements = requirements.length;
        const totalVendors = vendorResponses.length;
        const submittedVendors = vendorResponses.filter(
          (vr) => vr.status === "ProposalSubmitted" || vr.proposalSubmittedAt !== null
        ).length;
        // Calculate evaluations completed based on vendor-evaluator pairs (not requirements)
        const completedVendorEvaluatorPairs = new Set<string>();
        allScores.forEach((s) => {
          if (s.score !== null) {
            // Create a unique key for vendor-evaluator pair
            const pairKey = `${s.vendorResponseId}-${s.evaluatedById}`;
            completedVendorEvaluatorPairs.add(pairKey);
          }
        });
        const evaluationsCompleted = completedVendorEvaluatorPairs.size;
        const totalNeeded = totalVendors * evaluatorIds.length;
        const averageScore =
          allScores.length > 0
            ? allScores
                .filter((s) => s.score !== null)
                .reduce((sum, s) => sum + s.score!, 0) / allScores.filter((s) => s.score !== null).length
            : 0;
        const requirementsWithCompleteEvaluations = completeRequirements.length;
        const evaluatorsActive = new Set(allScores.map((s) => s.evaluatedById)).size;
        const totalEvaluators = evaluatorIds.length;
        
        // Count notes and questions
        const notesCount = allScores.filter((s) => s.note && s.note.trim() !== "").length;
        const questionsCount = allScores.filter((s) => s.question && s.question.trim() !== "").length;

        return reply.send({
          summary,
          stats: {
            totalRequirements,
            totalVendors,
            submittedVendors,
            evaluationsCompleted,
            totalNeeded,
            averageScore: Math.round(averageScore * 10) / 10,
            requirementsWithCompleteEvaluations,
            evaluatorsActive,
            totalEvaluators,
            notesCount,
            questionsCount,
          },
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/summary");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get comparison data for Compare tab (Admin Only)
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      hierarchyId?: string;
      evaluatorId?: string;
      vendorId?: string;
    };
  }>(
    "/:id/rfp/evaluation/comparison",
    {
      preHandler: [authenticate, requireRole(["CompanyAdministrator", "GlobalAdministrator"])],
      schema: {
        description: "Get comparison data for Compare tab (Admin Only)",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            hierarchyId: { type: "string" },
            evaluatorId: { type: "string" },
            vendorId: { type: "string" },
          },
        },
        response: {
          200: { description: "Comparison data" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;
        const { hierarchyId, evaluatorId, vendorId } = request.query;

        // Get RFP for project
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Build filter for requirements
        const requirementWhere: any = {
          hierarchy: {
            projectId,
          },
        };

        if (hierarchyId) {
          // Filter by hierarchy and its children
          const hierarchy = await db.requirementHierarchy.findUnique({
            where: { id: hierarchyId },
          });

          if (hierarchy) {
            // Get all child hierarchies
            const childHierarchies = await db.requirementHierarchy.findMany({
              where: {
                projectId,
                parentId: hierarchyId,
              },
            });

            const childHierarchyIds = [hierarchyId, ...childHierarchies.map((h) => h.id)];
            requirementWhere.hierarchyId = {
              in: childHierarchyIds,
            };
          }
        }

        // Get requirements
        const requirements = await db.requirement.findMany({
          where: requirementWhere,
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
          orderBy: [
            {
              hierarchy: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
        });

        // Get vendor responses
        let vendorResponses = await db.rFPVendorResponse.findMany({
          where: { rfpId: rfp.id },
          include: {
            projectVendor: {
              include: {
                vendor: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // Filter by vendor if specified
        if (vendorId) {
          vendorResponses = vendorResponses.filter(
            (vr) => vr.projectVendor.vendorId === vendorId
          );
        }

        // Build vendor order map
        const vendorOrder = new Map<string, number>();
        vendorResponses.forEach((vr, index) => {
          vendorOrder.set(vr.projectVendor.vendorId, index);
        });

        // Build filter for scores
        const scoreWhere: any = {
          vendorResponse: {
            rfpId: rfp.id,
            id: vendorId
              ? {
                  in: vendorResponses.map((vr) => vr.id),
                }
              : undefined,
          },
          requirement: {
            id: {
              in: requirements.map((r) => r.id),
            },
          },
        };

        if (evaluatorId) {
          scoreWhere.evaluatedById = evaluatorId;
        }

        // Get scores
        const scores = await db.evaluationScore.findMany({
          where: scoreWhere,
          include: {
            evaluatedBy: {
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

        // Group scores by requirement and vendor
        const scoresByRequirement = new Map<
          string,
          Map<
            string,
            Array<{
              score: number;
              evaluatedBy: {
                id: string;
                email: string;
                firstName: string | null;
                lastName: string | null;
                name: string | null;
              };
            }>
          >
        >();

        scores.forEach((score) => {
          if (score.score === null) return;

          const reqId = score.requirementId;
          const vendorResponseId = score.vendorResponseId;

          if (!scoresByRequirement.has(reqId)) {
            scoresByRequirement.set(reqId, new Map());
          }

          const vendorScores = scoresByRequirement.get(reqId)!;
          if (!vendorScores.has(vendorResponseId)) {
            vendorScores.set(vendorResponseId, []);
          }

          vendorScores.get(vendorResponseId)!.push({
            score: score.score,
            evaluatedBy: score.evaluatedBy,
          });
        });

        // Format response
        const comparison = requirements.map((req) => {
          const vendorScores = scoresByRequirement.get(req.id) || new Map();
          const vendorData: Array<{
            vendorId: string;
            anonymizedId: string;
            vendorName: string;
            scores: number[];
            average: number | null;
            stdDev: number | null;
          }> = [];

          vendorResponses.forEach((vr) => {
            const scores = vendorScores.get(vr.id) || [];
            const scoreValues = scores.map((s) => s.score);

            let average: number | null = null;
            let stdDev: number | null = null;

            if (scoreValues.length > 0) {
              average = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;

              if (scoreValues.length > 1) {
                const variance =
                  scoreValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) /
                  scoreValues.length;
                stdDev = Math.sqrt(variance);
              } else {
                stdDev = 0;
              }
            }

            vendorData.push({
              vendorId: vr.projectVendor.vendorId,
              anonymizedId: getAnonymizedVendorId(vr.projectVendor.vendorId, vendorOrder),
              vendorName: vr.projectVendor.vendor.name,
              scores: scoreValues,
              average: average !== null ? Math.round(average * 10) / 10 : null,
              stdDev: stdDev !== null ? Math.round(stdDev * 10) / 10 : null,
            });
          });

          return {
            requirementId: req.id,
            requirementNumber: req.number,
            requirementDescription: req.description,
            requirementType: req.type,
            hierarchy: {
              id: req.hierarchy.id,
              number: req.hierarchy.number,
              title: req.hierarchy.title,
              parentId: req.hierarchy.parentId,
              parent: req.hierarchy.parent
                ? {
                    id: req.hierarchy.parent.id,
                    number: req.hierarchy.parent.number,
                    title: req.hierarchy.parent.title,
                  }
                : null,
            },
            vendorData,
          };
        });

        return reply.send(comparison);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/comparison");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get all reference checks for vendors in project
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/evaluation/references",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all reference checks for vendors in project",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "Reference checks" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;

        const referenceChecks = await db.referenceCheck.findMany({
          where: { projectId },
          include: {
            vendor: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return reply.send(
          referenceChecks.map((rc) => ({
            id: rc.id,
            projectId: rc.projectId,
            vendorId: rc.vendorId,
            vendorName: rc.vendor.name,
            companyName: rc.companyName,
            contactName: rc.contactName,
            contactPosition: rc.contactPosition,
            contactEmail: rc.contactEmail,
            contactPhone: rc.contactPhone,
            content: rc.content,
            createdById: rc.createdById,
            createdAt: rc.createdAt.toISOString(),
            updatedAt: rc.updatedAt.toISOString(),
            createdBy: rc.createdBy,
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/references");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get reference checks for specific vendor
   */
  fastify.get<{
    Params: { id: string; vendorId: string };
  }>(
    "/:id/rfp/evaluation/references/:vendorId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get reference checks for specific vendor",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            vendorId: { type: "string", description: "Vendor ID" },
          },
        },
        response: {
          200: { description: "Reference checks for vendor" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const { projectId, vendorId } = request.params;

        const referenceChecks = await db.referenceCheck.findMany({
          where: {
            projectId,
            vendorId,
          },
          include: {
            vendor: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return reply.send(
          referenceChecks.map((rc) => ({
            id: rc.id,
            projectId: rc.projectId,
            vendorId: rc.vendorId,
            vendorName: rc.vendor.name,
            companyName: rc.companyName,
            contactName: rc.contactName,
            contactPosition: rc.contactPosition,
            contactEmail: rc.contactEmail,
            contactPhone: rc.contactPhone,
            content: rc.content,
            createdById: rc.createdById,
            createdAt: rc.createdAt.toISOString(),
            updatedAt: rc.updatedAt.toISOString(),
            createdBy: rc.createdBy,
          }))
        );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/evaluation/references/:vendorId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create reference check
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      vendorId: string;
      companyName: string;
      contactName: string;
      contactPosition?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      content: string;
    };
  }>(
    "/:id/rfp/evaluation/references",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create reference check",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        body: {
          type: "object",
          required: ["vendorId", "companyName", "contactName", "content"],
          properties: {
            vendorId: { type: "string" },
            companyName: { type: "string" },
            contactName: { type: "string" },
            contactPosition: { type: ["string", "null"] },
            contactEmail: { type: ["string", "null"] },
            contactPhone: { type: ["string", "null"] },
            content: { type: "string" },
          },
        },
        response: {
          200: { description: "Created reference check" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const projectId = request.params.id;
        const { vendorId, companyName, contactName, contactPosition, contactEmail, contactPhone, content } =
          request.body;

        // Verify vendor belongs to project
        const projectVendor = await db.projectVendor.findUnique({
          where: {
            projectId_vendorId: {
              projectId,
              vendorId,
            },
          },
        });

        if (!projectVendor) {
          return reply.status(404).send({ error: "Vendor not found in project" });
        }

        const referenceCheck = await db.referenceCheck.create({
          data: {
            projectId,
            vendorId,
            companyName,
            contactName,
            contactPosition: contactPosition ?? null,
            contactEmail: contactEmail ?? null,
            contactPhone: contactPhone ?? null,
            content,
            createdById: user.userId,
          },
          include: {
            vendor: true,
            createdBy: {
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

        return reply.send({
          id: referenceCheck.id,
          projectId: referenceCheck.projectId,
          vendorId: referenceCheck.vendorId,
          vendorName: referenceCheck.vendor.name,
          companyName: referenceCheck.companyName,
          contactName: referenceCheck.contactName,
          contactPosition: referenceCheck.contactPosition,
          contactEmail: referenceCheck.contactEmail,
          contactPhone: referenceCheck.contactPhone,
          content: referenceCheck.content,
          createdById: referenceCheck.createdById,
          createdAt: referenceCheck.createdAt.toISOString(),
          updatedAt: referenceCheck.updatedAt.toISOString(),
          createdBy: referenceCheck.createdBy,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/evaluation/references");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update reference check
   */
  fastify.put<{
    Params: { id: string; referenceId: string };
    Body: {
      companyName?: string;
      contactName?: string;
      contactPosition?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      content?: string;
    };
  }>(
    "/:id/rfp/evaluation/references/:referenceId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update reference check",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "referenceId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            referenceId: { type: "string", description: "Reference check ID" },
          },
        },
        body: {
          type: "object",
          properties: {
            companyName: { type: "string" },
            contactName: { type: "string" },
            contactPosition: { type: ["string", "null"] },
            contactEmail: { type: ["string", "null"] },
            contactPhone: { type: ["string", "null"] },
            content: { type: "string" },
          },
        },
        response: {
          200: { description: "Updated reference check" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;
        const { referenceId } = request.params;
        const updateData = request.body;

        // Verify reference check belongs to project
        const referenceCheck = await db.referenceCheck.findUnique({
          where: { id: referenceId },
        });

        if (!referenceCheck) {
          return reply.status(404).send({ error: "Reference check not found" });
        }

        if (referenceCheck.projectId !== projectId) {
          return reply.status(403).send({ error: "Reference check does not belong to this project" });
        }

        const updated = await db.referenceCheck.update({
          where: { id: referenceId },
          data: {
            ...(updateData.companyName !== undefined && { companyName: updateData.companyName }),
            ...(updateData.contactName !== undefined && { contactName: updateData.contactName }),
            ...(updateData.contactPosition !== undefined && {
              contactPosition: updateData.contactPosition ?? null,
            }),
            ...(updateData.contactEmail !== undefined && { contactEmail: updateData.contactEmail ?? null }),
            ...(updateData.contactPhone !== undefined && { contactPhone: updateData.contactPhone ?? null }),
            ...(updateData.content !== undefined && { content: updateData.content }),
            updatedAt: new Date(),
          },
          include: {
            vendor: true,
            createdBy: {
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

        return reply.send({
          id: updated.id,
          projectId: updated.projectId,
          vendorId: updated.vendorId,
          vendorName: updated.vendor.name,
          companyName: updated.companyName,
          contactName: updated.contactName,
          contactPosition: updated.contactPosition,
          contactEmail: updated.contactEmail,
          contactPhone: updated.contactPhone,
          content: updated.content,
          createdById: updated.createdById,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          createdBy: updated.createdBy,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/evaluation/references/:referenceId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Delete reference check
   */
  fastify.delete<{
    Params: { id: string; referenceId: string };
  }>(
    "/:id/rfp/evaluation/references/:referenceId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete reference check",
        tags: ["evaluation"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "referenceId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            referenceId: { type: "string", description: "Reference check ID" },
          },
        },
        response: {
          200: { description: "Reference check deleted" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const projectId = request.params.id;
        const { referenceId } = request.params;

        // Verify reference check belongs to project
        const referenceCheck = await db.referenceCheck.findUnique({
          where: { id: referenceId },
        });

        if (!referenceCheck) {
          return reply.status(404).send({ error: "Reference check not found" });
        }

        if (referenceCheck.projectId !== projectId) {
          return reply.status(403).send({ error: "Reference check does not belong to this project" });
        }

        await db.referenceCheck.delete({
          where: { id: referenceId },
        });

        return reply.status(204).send();
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/evaluation/references/:referenceId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );
}

