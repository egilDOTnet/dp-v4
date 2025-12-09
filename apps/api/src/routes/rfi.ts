import { FastifyInstance } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";

// Helper to safely access RFI models with better error handling
// Prisma generates model names in camelCase: Project -> db.project, RFI -> db.rFI
function getRFIModel(modelName: string) {
  const dbAny = db as any;
  
  // Prisma naming: first letter lowercase, rest stays
  // RFI -> rFI, RFIQuestion -> rFIQuestion, etc.
  const camelCaseName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const model = dbAny[camelCaseName];

  if (!model) {
    // Provide helpful error message with available models
    const availableModels = Object.keys(dbAny)
      .filter(
        (key) =>
          !key.startsWith("_") &&
          !key.startsWith("$") &&
          typeof dbAny[key] === "object" &&
          dbAny[key] !== null &&
          dbAny[key].findUnique !== undefined // Only Prisma models have findUnique
      )
      .slice(0, 30);
    
    throw new Error(
      `RFI model "${modelName}" (accessed as "${camelCaseName}") not found in Prisma client. ` +
        `Please ensure: 1) Migrations have been applied with 'pnpm prisma migrate deploy' in packages/db, ` +
        `2) Prisma client has been regenerated with 'pnpm prisma generate' in packages/db, ` +
        `3) API server has been restarted. ` +
        (availableModels.length > 0 ? `Available Prisma models: ${availableModels.join(", ")}` : "")
    );
  }

  return model;
}

export default async function rfiRoutes(fastify: FastifyInstance) {
  // Get RFI for a project
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

        // Get or create RFI
        const RFI = getRFIModel("RFI");
        let rfi = await RFI.findUnique({
          where: { projectId },
          include: {
            questions: {
              include: {
                options: {
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        });

        if (!rfi) {
          // Get default templates
          const emailTemplate = await db.template.findUnique({
            where: { id: "rfi-default-email-template" },
          });
          const rfiInfoTemplate = await db.template.findUnique({
            where: { id: "rfi-default-information-template" },
          });

          // Replace template variables with project data
          const emailSubject = `Request for Information (RFI) for "${project.name}"`;
          const emailText = emailTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name) || "";
          const rfiInformation = rfiInfoTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name).replace(/{PROJECT_DESCRIPTION}/g, project.type || "No description available") || "";

          // Create RFI if it doesn't exist
          rfi = await RFI.create({
            data: {
              projectId,
              emailSubject,
              emailText,
              rfiInformation,
              emailTemplateId: emailTemplate?.id,
              rfiInformationTemplateId: rfiInfoTemplate?.id,
            },
            include: {
              questions: {
                include: {
                  options: {
                    orderBy: { order: "asc" },
                  },
                },
                orderBy: { order: "asc" },
              },
            },
          });
        }

        return reply.send(rfi);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Create or update RFI
  fastify.put<{
    Params: { id: string };
    Body: {
      emailSubject?: string;
      emailText?: string;
      rfiInformation?: string;
      deadline?: string | null;
      autoPublishDate?: string | null;
    };
  }>(
    "/:id/rfi",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Validate dates
      if (request.body.deadline && request.body.autoPublishDate) {
        const deadline = new Date(request.body.deadline);
        const autoPublish = new Date(request.body.autoPublishDate);
        if (autoPublish >= deadline) {
          return reply.status(400).send({
            error: "Auto publish date must be before deadline",
          });
        }
      }

      // Update or create RFI
      const RFI = getRFIModel("RFI");
      const updateData: any = {};
      if (request.body.emailSubject !== undefined) {
        updateData.emailSubject = request.body.emailSubject;
      }
      if (request.body.emailText !== undefined) {
        updateData.emailText = request.body.emailText;
      }
      if (request.body.rfiInformation !== undefined) {
        updateData.rfiInformation = request.body.rfiInformation;
      }
      if (request.body.deadline !== undefined) {
        updateData.deadline = request.body.deadline ? new Date(request.body.deadline) : null;
      }
      if (request.body.autoPublishDate !== undefined) {
        updateData.autoPublishDate = request.body.autoPublishDate
          ? new Date(request.body.autoPublishDate)
          : null;
      }

      // For create, get templates and apply defaults
      const createData: any = {
        projectId,
        emailText: request.body.emailText || "",
        rfiInformation: request.body.rfiInformation || "",
        deadline: request.body.deadline ? new Date(request.body.deadline) : null,
        autoPublishDate: request.body.autoPublishDate
          ? new Date(request.body.autoPublishDate)
          : null,
      };

      // Only fetch templates if creating new RFI and fields not explicitly provided
      const existingRfi = await RFI.findUnique({ where: { projectId } });
      if (!existingRfi) {
        if (!request.body.emailSubject) {
          createData.emailSubject = `Request for Information (RFI) for "${project.name}"`;
        } else {
          createData.emailSubject = request.body.emailSubject;
        }

        if (!request.body.emailText) {
          const emailTemplate = await db.template.findUnique({
            where: { id: "rfi-default-email-template" },
          });
          createData.emailText = emailTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name) || "";
          createData.emailTemplateId = emailTemplate?.id;
        }

        if (!request.body.rfiInformation) {
          const rfiInfoTemplate = await db.template.findUnique({
            where: { id: "rfi-default-information-template" },
          });
          createData.rfiInformation = rfiInfoTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name).replace(/{PROJECT_DESCRIPTION}/g, project.type || "No description available") || "";
          createData.rfiInformationTemplateId = rfiInfoTemplate?.id;
        }
      }

      const rfi = await RFI.upsert({
        where: { projectId },
        update: updateData,
        create: createData,
        include: {
          questions: {
            include: {
              options: {
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      });

        return reply.send(rfi);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfi");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Publish RFI
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/publish",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get RFI
      const RFI = getRFIModel("RFI");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      // Validate deadline is set
      if (!rfi.deadline) {
        return reply.status(400).send({
          error: "Deadline must be set before publishing",
        });
      }

      // Publish RFI
      await RFI.update({
        where: { projectId },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          unpublishedAt: null,
        },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/publish");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Unpublish RFI
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/unpublish",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Unpublish RFI
      const RFI = getRFIModel("RFI");
      await RFI.update({
        where: { projectId },
        data: {
          isPublished: false,
          unpublishedAt: new Date(),
        },
      });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/unpublish");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Get all questions for an RFI
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/questions",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.send([]);
      }

      // Get questions
      const questions = await RFIQuestion.findMany({
        where: { rfiId: rfi.id },
        include: {
          options: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      });

        return reply.send(questions);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi/questions");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Create question
  fastify.post<{
    Params: { id: string };
    Body: {
      title: string;
      description?: string | null;
      type: string;
      required?: boolean;
      scaleLabels?: Record<string, string> | null;
    };
  }>(
    "/:id/rfi/questions",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get or create RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      let rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        // Get default templates
        const emailTemplate = await db.template.findUnique({
          where: { id: "rfi-default-email-template" },
        });
        const rfiInfoTemplate = await db.template.findUnique({
          where: { id: "rfi-default-information-template" },
        });

        // Replace template variables with project data
        const emailSubject = `Request for Information (RFI) for "${project.name}"`;
        const emailText = emailTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name) || "";
        const rfiInformation = rfiInfoTemplate?.content?.replace(/{PROJECT_NAME}/g, project.name).replace(/{PROJECT_DESCRIPTION}/g, project.type || "No description available") || "";

        rfi = await RFI.create({
          data: {
            projectId,
            emailSubject,
            emailText,
            rfiInformation,
            emailTemplateId: emailTemplate?.id,
            rfiInformationTemplateId: rfiInfoTemplate?.id,
          },
        });
      }

      // Get max order
      const maxOrderQuestion = await RFIQuestion.findFirst({
        where: { rfiId: rfi.id },
        orderBy: { order: "desc" },
      });

      const order = maxOrderQuestion ? maxOrderQuestion.order + 1 : 1;

      // Create question
      const question = await RFIQuestion.create({
        data: {
          rfiId: rfi.id,
          title: request.body.title,
          description: request.body.description || null,
          type: request.body.type as any,
          required: request.body.required !== undefined ? request.body.required : true,
          order,
          scaleLabels: request.body.scaleLabels || null,
        },
        include: {
          options: {
            orderBy: { order: "asc" },
          },
        },
      });

        return reply.status(201).send(question);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/questions");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Update question
  fastify.put<{
    Params: { id: string; questionId: string };
    Body: {
      title?: string;
      description?: string | null;
      type?: string;
      required?: boolean;
      scaleLabels?: Record<string, string> | null;
    };
  }>(
    "/:id/rfi/questions/:questionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
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

        // Verify question belongs to RFI
        const RFI = getRFIModel("RFI");
        const RFIQuestion = getRFIModel("RFIQuestion");
        const rfi = await RFI.findUnique({
          where: { projectId },
        });

        if (!rfi) {
          return reply.status(404).send({ error: "RFI not found" });
        }

        const question = await RFIQuestion.findUnique({
          where: { id: questionId },
        });

        if (!question || question.rfiId !== rfi.id) {
          return reply.status(404).send({ error: "Question not found" });
        }

        // Update question
        const updateData: any = {};
        if (request.body.title !== undefined) {
          updateData.title = request.body.title;
        }
        if (request.body.description !== undefined) {
          updateData.description = request.body.description;
        }
        if (request.body.type !== undefined) {
          updateData.type = request.body.type as any;
        }
        if (request.body.required !== undefined) {
          updateData.required = request.body.required;
        }
        if (request.body.scaleLabels !== undefined) {
          updateData.scaleLabels = request.body.scaleLabels;
        }

        const updatedQuestion = await RFIQuestion.update({
          where: { id: questionId },
          data: updateData,
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
        });

        return reply.send(updatedQuestion);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfi/questions/:questionId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Delete question
  fastify.delete<{
    Params: { id: string; questionId: string };
  }>(
    "/:id/rfi/questions/:questionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
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

      // Verify question belongs to RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      const question = await RFIQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question || question.rfiId !== rfi.id) {
        return reply.status(404).send({ error: "Question not found" });
      }

      // Delete question (cascade will delete options and responses)
      await RFIQuestion.delete({
        where: { id: questionId },
      });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfi/questions/:questionId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Reorder questions
  fastify.put<{
    Params: { id: string };
    Body: {
      questionIds: string[];
    };
  }>(
    "/:id/rfi/questions/reorder",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Verify RFI exists
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      // Update order for each question
      const updatePromises = request.body.questionIds.map((questionId, index) =>
        RFIQuestion.update({
          where: { id: questionId },
          data: { order: index + 1 },
        })
      );

        await Promise.all(updatePromises);

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfi/questions/reorder");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Add option to question
  fastify.post<{
    Params: { id: string; questionId: string };
    Body: {
      label: string;
      value?: string | null;
      xAxis?: boolean;
      yAxis?: boolean;
    };
  }>(
    "/:id/rfi/questions/:questionId/options",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
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

      // Verify question belongs to RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const RFIQuestionOption = getRFIModel("RFIQuestionOption");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      const question = await RFIQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question || question.rfiId !== rfi.id) {
        return reply.status(404).send({ error: "Question not found" });
      }

      // Get max order
      const maxOrderOption = await RFIQuestionOption.findFirst({
        where: { questionId },
        orderBy: { order: "desc" },
      });

      const order = maxOrderOption ? maxOrderOption.order + 1 : 1;

      // Create option
      const option = await RFIQuestionOption.create({
        data: {
          questionId,
          label: request.body.label,
          value: request.body.value || null,
          xAxis: request.body.xAxis || false,
          yAxis: request.body.yAxis || false,
          order,
        },
      });

        return reply.status(201).send(option);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/questions/:questionId/options");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Update option
  fastify.put<{
    Params: { id: string; questionId: string; optionId: string };
    Body: {
      label?: string;
      value?: string | null;
      xAxis?: boolean;
      yAxis?: boolean;
    };
  }>(
    "/:id/rfi/questions/:questionId/options/:optionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        const optionId = request.params.optionId;
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

      // Verify option belongs to question and question belongs to RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const RFIQuestionOption = getRFIModel("RFIQuestionOption");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      const question = await RFIQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question || question.rfiId !== rfi.id) {
        return reply.status(404).send({ error: "Question not found" });
      }

      const option = await RFIQuestionOption.findUnique({
        where: { id: optionId },
      });

      if (!option || option.questionId !== questionId) {
        return reply.status(404).send({ error: "Option not found" });
      }

      // Update option
      const updateData: any = {};
      if (request.body.label !== undefined) {
        updateData.label = request.body.label;
      }
      if (request.body.value !== undefined) {
        updateData.value = request.body.value;
      }
      if (request.body.xAxis !== undefined) {
        updateData.xAxis = request.body.xAxis;
      }
      if (request.body.yAxis !== undefined) {
        updateData.yAxis = request.body.yAxis;
      }

      const updatedOption = await RFIQuestionOption.update({
        where: { id: optionId },
        data: updateData,
      });

        return reply.send(updatedOption);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfi/questions/:questionId/options/:optionId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Delete option
  fastify.delete<{
    Params: { id: string; questionId: string; optionId: string };
  }>(
    "/:id/rfi/questions/:questionId/options/:optionId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        const optionId = request.params.optionId;
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

      // Verify option belongs to question and question belongs to RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const RFIQuestionOption = getRFIModel("RFIQuestionOption");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      const question = await RFIQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question || question.rfiId !== rfi.id) {
        return reply.status(404).send({ error: "Question not found" });
      }

      const option = await RFIQuestionOption.findUnique({
        where: { id: optionId },
      });

      if (!option || option.questionId !== questionId) {
        return reply.status(404).send({ error: "Option not found" });
      }

      // Delete option
      await RFIQuestionOption.delete({
        where: { id: optionId },
      });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfi/questions/:questionId/options/:optionId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Reorder options
  fastify.put<{
    Params: { id: string; questionId: string };
    Body: {
      optionIds: string[];
    };
  }>(
    "/:id/rfi/questions/:questionId/options/reorder",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
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

      // Verify question belongs to RFI
      const RFI = getRFIModel("RFI");
      const RFIQuestion = getRFIModel("RFIQuestion");
      const RFIQuestionOption = getRFIModel("RFIQuestionOption");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      const question = await RFIQuestion.findUnique({
        where: { id: questionId },
      });

      if (!question || question.rfiId !== rfi.id) {
        return reply.status(404).send({ error: "Question not found" });
      }

      // Update order for each option
      const updatePromises = request.body.optionIds.map((optionId, index) =>
        RFIQuestionOption.update({
          where: { id: optionId },
          data: { order: index + 1 },
        })
      );

        await Promise.all(updatePromises);

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfi/questions/:questionId/options/reorder");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Get vendor responses
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/vendor-responses",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get RFI
      const RFI = getRFIModel("RFI");
      const RFIVendorResponse = getRFIModel("RFIVendorResponse");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.send([]);
      }

      // Get vendor responses
      const vendorResponses = await RFIVendorResponse.findMany({
        where: { rfiId: rfi.id },
        include: {
          projectVendor: {
            include: {
              vendor: {
                include: {
                  VendorContactPerson: true,
                },
              },
            },
          },
          contactPerson: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send(
        vendorResponses.map((vr) => ({
          id: vr.id,
          vendorId: vr.projectVendor.vendorId,
          vendorName: vr.projectVendor.vendor.name,
          contactPerson: {
            id: vr.contactPerson.id,
            firstName: vr.contactPerson.firstName,
            lastName: vr.contactPerson.lastName,
            email: vr.contactPerson.email,
            phone: vr.contactPerson.phone,
          },
          status: vr.status,
          sentAt: vr.sentAt,
          answeredAt: vr.answeredAt,
          createdAt: vr.createdAt,
        }))
      );
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi/vendor-responses");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Send RFI to vendors
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/send",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get RFI
      const RFI = getRFIModel("RFI");
      const RFIVendorResponse = getRFIModel("RFIVendorResponse");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      if (!rfi.isPublished) {
        return reply.status(400).send({
          error: "RFI must be published before sending to vendors",
        });
      }

      // Get all project vendors with main contacts
      const projectVendors = await db.projectVendor.findMany({
        where: { projectId },
        include: {
          vendor: {
            include: {
              VendorContactPerson: {
                where: { isMainContact: true },
              },
            },
          },
        },
      });

      const now = new Date();

      // Create vendor responses for each vendor with a main contact
      for (const pv of projectVendors) {
        const mainContact = pv.vendor.VendorContactPerson.find((c) => c.isMainContact);
        if (!mainContact) {
          continue; // Skip vendors without main contacts
        }

        // Check if response already exists
        const existingResponse = await RFIVendorResponse.findUnique({
          where: {
            rfiId_projectVendorId: {
              rfiId: rfi.id,
              projectVendorId: pv.id,
            },
          },
        });

        if (!existingResponse) {
          // Create vendor response
          await RFIVendorResponse.create({
            data: {
              rfiId: rfi.id,
              projectVendorId: pv.id,
              contactPersonId: mainContact.id,
              status: "Sent",
              sentAt: now,
            },
          });

          // Update vendor status
          if (pv.status === "Pending") {
            await db.projectVendor.update({
              where: { id: pv.id },
              data: { status: "RFI_Received" },
            });
          }

          // TODO: Send email in production
          if (process.env.NODE_ENV === "development") {
            console.log(
              `[RFI Email] Would send RFI to ${mainContact.email} for vendor ${pv.vendor.name}`
            );
          }
        }
      }

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/send");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Resend RFI to a specific vendor
  fastify.post<{
    Params: { id: string; vendorId: string };
  }>(
    "/:id/rfi/resend/:vendorId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const vendorId = request.params.vendorId;
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

      // Get RFI
      const RFI = getRFIModel("RFI");
      const RFIVendorResponse = getRFIModel("RFIVendorResponse");
      const rfi = await RFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.status(404).send({ error: "RFI not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId,
          vendorId,
        },
        include: {
          vendor: {
            include: {
              VendorContactPerson: {
                where: { isMainContact: true },
              },
            },
          },
        },
      });

      if (!projectVendor) {
        return reply.status(404).send({ error: "Vendor not found in project" });
      }

      const mainContact = projectVendor.vendor.VendorContactPerson.find((c) => c.isMainContact);
      if (!mainContact) {
        return reply.status(400).send({ error: "Vendor has no main contact" });
      }

      const now = new Date();

      // Update or create vendor response
      await RFIVendorResponse.upsert({
        where: {
          rfiId_projectVendorId: {
            rfiId: rfi.id,
            projectVendorId: projectVendor.id,
          },
        },
        update: {
          sentAt: now,
          status: "Sent",
        },
        create: {
          rfiId: rfi.id,
          projectVendorId: projectVendor.id,
          contactPersonId: mainContact.id,
          status: "Sent",
          sentAt: now,
        },
      });

      // TODO: Send email in production (with CC to logged in user)
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[RFI Email] Would resend RFI to ${mainContact.email} for vendor ${projectVendor.vendor.name} (CC: ${user?.email})`
        );
      }

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfi/resend/:vendorId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Get RFI preview
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/preview",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
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

      // Get RFI with questions
      const RFI = getRFIModel("RFI");
      const rfi = await RFI.findUnique({
        where: { projectId },
        include: {
          questions: {
            include: {
              options: {
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      });

        if (!rfi) {
          return reply.status(404).send({ error: "RFI not found" });
        }

        return reply.send(rfi);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi/preview");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );
}
