import { FastifyInstance } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/project-access";

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

// Helper to sync vendor status from RFI vendor response status
// This ensures one-way sync: RFI status changes update Vendor status
async function syncVendorStatusFromRFIStatus(
  rfiVendorResponseStatus: string,
  projectVendorId: string
): Promise<void> {
  // Map RFI status to Vendor status
  // Only sync certain statuses - Rejected doesn't update vendor status
  let vendorStatus: string | null = null;
  
  switch (rfiVendorResponseStatus) {
    case "Started":
      vendorStatus = "RFI_Started";
      break;
    case "Received":
      vendorStatus = "RFI_Received";
      break;
    case "Answered":
      vendorStatus = "RFI_Answered";
      break;
    case "Sent":
      // When RFI is sent, status should be RFI_Received
      vendorStatus = "RFI_Received";
      break;
    case "Rejected":
      // Don't sync rejected status - vendor status remains as is
      return;
    default:
      // Unknown status, don't sync
      return;
  }

  // Update vendor status
  if (vendorStatus) {
    await db.projectVendor.update({
      where: { id: projectVendorId },
      data: { status: vendorStatus as any },
    });
  }
}

export default async function rfiRoutes(fastify: FastifyInstance) {
  /**
   * Get RFI for a project
   * User must be a project member or company admin
   * Creates RFI if it doesn't exist with default templates
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get RFI for a project. User must be a project member or company administrator. If RFI doesn't exist, creates it with default email and information templates.",
        tags: ["rfi"],
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
            description: "RFI with questions and options",
            // No schema validation - return data as-is to avoid serialization issues
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
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;

        // Verify project access using middleware (includes auth check)
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;
        const project = (request as any).project;

        // Get or create RFI
        // Use select instead of include to ensure proper JSON serialization
        // Access model directly like requirements endpoint does
        let rfi = await db.rFI.findUnique({
          where: { projectId },
          select: {
            id: true,
            projectId: true,
            emailSubject: true,
            emailText: true,
            rfiInformation: true,
            emailTemplateId: true,
            rfiInformationTemplateId: true,
            deadline: true,
            autoPublishDate: true,
            isPublished: true,
            publishedAt: true,
            unpublishedAt: true,
            createdAt: true,
            updatedAt: true,
            questions: {
              select: {
                id: true,
                rfiId: true,
                title: true,
                description: true,
                type: true,
                order: true,
                required: true,
                scaleLabels: true,
                createdAt: true,
                updatedAt: true,
                options: {
                  select: {
                    id: true,
                    questionId: true,
                    label: true,
                    value: true,
                    xAxis: true,
                    yAxis: true,
                    order: true,
                    createdAt: true,
                    updatedAt: true,
                  },
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
          rfi = await db.rFI.create({
            data: {
              projectId,
              emailSubject,
              emailText,
              rfiInformation,
              emailTemplateId: emailTemplate?.id,
              rfiInformationTemplateId: rfiInfoTemplate?.id,
            },
            select: {
              id: true,
              projectId: true,
              emailSubject: true,
              emailText: true,
              rfiInformation: true,
              emailTemplateId: true,
              rfiInformationTemplateId: true,
              deadline: true,
              autoPublishDate: true,
              isPublished: true,
              publishedAt: true,
              unpublishedAt: true,
              createdAt: true,
              updatedAt: true,
              questions: {
                select: {
                  id: true,
                  rfiId: true,
                  title: true,
                  description: true,
                  type: true,
                  order: true,
                  required: true,
                  scaleLabels: true,
                  createdAt: true,
                  updatedAt: true,
                  options: {
                    select: {
                      id: true,
                      questionId: true,
                      label: true,
                      value: true,
                      xAxis: true,
                      yAxis: true,
                      order: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    orderBy: { order: "asc" },
                  },
                },
                orderBy: { order: "asc" },
              },
            },
          });
        }


        // Using select ensures we get plain JavaScript objects that serialize correctly
        // Fastify's serializer handles Date objects automatically
        return reply.send(rfi);
      } catch (error: any) {
        request.log.error({ 
          err: error, 
          errorMessage: error.message,
          errorStack: error.stack,
          projectId: request.params.id
        }, "Error in GET /:id/rfi");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Create or update RFI
   * User must be a project member or company admin
   * Validates that autoPublishDate is before deadline if both are set
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Create or update RFI settings. User must be a project member or company administrator. Validates that autoPublishDate is before deadline if both are provided.",
        tags: ["rfi"],
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
            emailSubject: {
              type: "string",
              nullable: true,
              description: "Email subject for RFI invitations",
            },
            emailText: {
              type: "string",
              nullable: true,
              description: "Email body text for RFI invitations",
            },
            rfiInformation: {
              type: "string",
              nullable: true,
              description: "RFI information/instructions text",
            },
            deadline: {
              type: "string",
              nullable: true,
              description: "RFI deadline (ISO 8601 date or datetime string, e.g., '2025-12-15' or '2025-12-15T23:59:59Z')",
            },
            autoPublishDate: {
              type: "string",
              nullable: true,
              description: "Auto-publish date (ISO 8601 date or datetime string, must be before deadline if both set)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Created or updated RFI",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Validation error (e.g., autoPublishDate >= deadline)",
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
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      const projectId = request.params.id;
      let updateData: any = {};
      let createData: any = {};
      
      try {
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;
      const project = (request as any).project;

      // Helper function to safely parse date strings
      // Handles empty strings, null, and date-only strings (YYYY-MM-DD)
      const parseDate = (dateValue: string | null | undefined): Date | null => {
        if (!dateValue || (typeof dateValue === "string" && dateValue.trim() === "")) {
          return null;
        }
        try {
          // If it's a date-only string (YYYY-MM-DD), convert to end of day in UTC
          if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            // Use UTC to avoid timezone issues - set to end of day (23:59:59.999)
            const date = new Date(dateValue + "T23:59:59.999Z");
            if (isNaN(date.getTime())) {
              return null;
            }
            return date;
          }
          // Otherwise, try to parse as full datetime
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) {
            return null;
          }
          return date;
        } catch (error) {
          request.log.warn({ err: error, dateValue }, "Error parsing date");
          return null;
        }
      };

      // Parse dates for validation
      const parsedDeadline = request.body.deadline !== undefined 
        ? parseDate(request.body.deadline) 
        : null;
      const parsedAutoPublish = request.body.autoPublishDate !== undefined 
        ? parseDate(request.body.autoPublishDate) 
        : null;

      // Validate dates
      if (parsedDeadline && parsedAutoPublish) {
        if (parsedAutoPublish >= parsedDeadline) {
          return reply.status(400).send({
            error: "Auto publish date must be before deadline",
          });
        }
      }

      // Update or create RFI
      // Use direct model access like requirements endpoint
      updateData = {};
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
        updateData.deadline = parsedDeadline;
      }
      if (request.body.autoPublishDate !== undefined) {
        updateData.autoPublishDate = parsedAutoPublish;
      }

      // For create, get templates and apply defaults
      createData = {
        projectId,
        emailText: request.body.emailText || "",
        rfiInformation: request.body.rfiInformation || "",
      };
      
      // Only set deadline/autoPublishDate if they were provided in the request
      if (request.body.deadline !== undefined) {
        createData.deadline = parsedDeadline;
      }
      if (request.body.autoPublishDate !== undefined) {
        createData.autoPublishDate = parsedAutoPublish;
      }

      // Only fetch templates if creating new RFI and fields not explicitly provided
      const existingRfi = await db.rFI.findUnique({ where: { projectId } });
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

      // Use select instead of include to ensure proper JSON serialization
      const rfi = await db.rFI.upsert({
        where: { projectId },
        update: updateData,
        create: createData,
        select: {
          id: true,
          projectId: true,
          emailSubject: true,
          emailText: true,
          rfiInformation: true,
          emailTemplateId: true,
          rfiInformationTemplateId: true,
          deadline: true,
          autoPublishDate: true,
          isPublished: true,
          publishedAt: true,
          unpublishedAt: true,
          createdAt: true,
          updatedAt: true,
          questions: {
            select: {
              id: true,
              rfiId: true,
              title: true,
              description: true,
              type: true,
              order: true,
              required: true,
              scaleLabels: true,
              createdAt: true,
              updatedAt: true,
              options: {
                select: {
                  id: true,
                  questionId: true,
                  label: true,
                  value: true,
                  xAxis: true,
                  yAxis: true,
                  order: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        });

        // Using select ensures we get plain JavaScript objects that serialize correctly
        // Fastify's serializer handles Date objects automatically
        return reply.send(rfi);
      } catch (error: any) {
        request.log.error({ 
          err: error, 
          projectId,
          body: request.body,
          updateData,
          stack: error.stack 
        }, "Error in PUT /:id/rfi");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Publish RFI
   * User must be a project member or company admin
   * Requires deadline to be set
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/publish",
    {
      preHandler: [authenticate],
      schema: {
        description: "Publish an RFI. User must be a project member or company administrator. Requires the RFI deadline to be set before publishing.",
        tags: ["rfi"],
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
              success: { type: "boolean" },
            },
            description: "RFI published successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "RFI deadline not set",
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
            description: "Project or RFI not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
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

      // Get RFI
      const rfi = await db.rFI.findUnique({
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
      await db.rFI.update({
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

  /**
   * Unpublish RFI
   * User must be a project member or company admin
   * Sets unpublishedAt timestamp
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/unpublish",
    {
      preHandler: [authenticate],
      schema: {
        description: "Unpublish an RFI. User must be a project member or company administrator. Sets the unpublishedAt timestamp.",
        tags: ["rfi"],
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
              success: { type: "boolean" },
            },
            description: "RFI unpublished successfully",
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
            description: "Internal server error or RFI model not available",
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

      // Unpublish RFI
      await db.rFI.update({
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

  /**
   * Get all questions for an RFI
   * User must be a project member or company admin
   * Returns empty array if RFI doesn't exist
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/questions",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all questions for an RFI. User must be a project member or company administrator. Returns questions with their options, ordered by order field. Returns empty array if RFI doesn't exist.",
        tags: ["rfi"],
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
            description: "Array of RFI questions",
            // No schema validation - return data as-is to avoid serialization issues
            // Fastify's schema validation can strip properties from Prisma objects
            // even when using select. Using only description allows proper serialization.
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
            description: "Internal server error or RFI model not available",
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

      // Get RFI ID first to query questions directly
      // Using findMany directly (like requirements endpoint) avoids relation serialization issues
      const rfi = await db.rFI.findUnique({
        where: { projectId },
        select: { id: true },
      });

      if (!rfi) {
        return reply.send([]);
      }

      // Query questions directly using findMany (same pattern as requirements endpoint)
      // Access the model via dbAny since TypeScript doesn't know about rFIQuestion
      const dbAny = db as any;
      const questions = await dbAny.rFIQuestion.findMany({
        where: { rfiId: rfi.id },
        select: {
          id: true,
          rfiId: true,
          title: true,
          description: true,
          type: true,
          order: true,
          required: true,
          scaleLabels: true,
          createdAt: true,
          updatedAt: true,
          options: {
            select: {
              id: true,
              questionId: true,
              label: true,
              value: true,
              xAxis: true,
              yAxis: true,
              order: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      });

      // Using select ensures we get plain JavaScript objects that serialize correctly
      // Fastify's serializer handles Date objects automatically
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

  /**
   * Create question
   * User must be a project member or company admin
   * Creates RFI if it doesn't exist
   * Auto-generates order based on existing questions
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Create a question for an RFI. User must be a project member or company administrator. Creates RFI if it doesn't exist. Order is auto-generated based on existing questions.",
        tags: ["rfi"],
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
          required: ["title", "type"],
          properties: {
            title: {
              type: "string",
              description: "Question title",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Question description",
            },
            type: {
              type: "string",
              description: "Question type (e.g., 'text', 'scale', 'multiple_choice')",
            },
            required: {
              type: "boolean",
              nullable: true,
              description: "Whether the question is required",
            },
            scaleLabels: {
              type: "object",
              nullable: true,
              additionalProperties: { type: "string" },
              description: "Scale labels for scale-type questions",
            },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Created question with auto-generated order",
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
            description: "Internal server error or RFI model not available",
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
      const project = (request as any).project;

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
      // Use select instead of include to ensure proper JSON serialization
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
        select: {
          id: true,
          rfiId: true,
          title: true,
          description: true,
          type: true,
          order: true,
          required: true,
          scaleLabels: true,
          createdAt: true,
          updatedAt: true,
          options: {
            select: {
              id: true,
              questionId: true,
              label: true,
              value: true,
              xAxis: true,
              yAxis: true,
              order: true,
              createdAt: true,
              updatedAt: true,
            },
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

  /**
   * Update question
   * User must be a project member or company admin
   * All fields are optional
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Update an RFI question. User must be a project member or company administrator. All fields are optional - only provided fields are updated.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            title: {
              type: "string",
              nullable: true,
              description: "Question title",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Question description",
            },
            type: {
              type: "string",
              nullable: true,
              description: "Question type",
            },
            required: {
              type: "boolean",
              nullable: true,
              description: "Whether the question is required",
            },
            scaleLabels: {
              type: "object",
              nullable: true,
              additionalProperties: { type: "string" },
              description: "Scale labels for scale-type questions",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Updated question",
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
            description: "Project, RFI, or question not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
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

        // Use select instead of include to ensure proper JSON serialization
        const updatedQuestion = await RFIQuestion.update({
          where: { id: questionId },
          data: updateData,
          select: {
            id: true,
            rfiId: true,
            title: true,
            description: true,
            type: true,
            order: true,
            required: true,
            scaleLabels: true,
            createdAt: true,
            updatedAt: true,
            options: {
              select: {
                id: true,
                questionId: true,
                label: true,
                value: true,
                xAxis: true,
                yAxis: true,
                order: true,
                createdAt: true,
                updatedAt: true,
              },
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

  /**
   * Delete question
   * User must be a project member or company admin
   * Cascades to delete options and responses
   */
  fastify.delete<{
    Params: { id: string; questionId: string };
  }>(
    "/:id/rfi/questions/:questionId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete an RFI question. User must be a project member or company administrator. Cascades to delete related options and vendor responses.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
          },
        },
        response: {
          204: {
            description: "Question deleted successfully",
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
            description: "Project, RFI, or question not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Reorder questions
   * User must be a project member or company admin
   * Updates order for all specified questions
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      questionIds: string[];
    };
  }>(
    "/:id/rfi/questions/reorder",
    {
      preHandler: [authenticate],
      schema: {
        description: "Reorder RFI questions (for drag-and-drop). User must be a project member or company administrator. Updates order for all specified questions based on their position in the array.",
        tags: ["rfi"],
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
          required: ["questionIds"],
          properties: {
            questionIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of question IDs in the desired order",
            },
          },
        },
        response: {
          204: {
            description: "Questions reordered successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid question IDs",
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
            description: "Project or RFI not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
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

  /**
   * Add option to question
   * User must be a project member or company admin
   * Auto-generates order based on existing options
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Add an option to an RFI question. User must be a project member or company administrator. Order is auto-generated based on existing options.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["label"],
          properties: {
            label: {
              type: "string",
              description: "Option label",
            },
            value: {
              type: "string",
              nullable: true,
              description: "Option value",
            },
            xAxis: {
              type: "boolean",
              nullable: true,
              description: "Whether this option is on the X-axis (for matrix questions)",
            },
            yAxis: {
              type: "boolean",
              nullable: true,
              description: "Whether this option is on the Y-axis (for matrix questions)",
            },
          },
        },
        response: {
          201: {
            type: "object",
            description: "Created option with auto-generated order",
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
            description: "Project, RFI, or question not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Update option
   * User must be a project member or company admin
   * All fields are optional
   */
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
    {
      preHandler: [authenticate],
      schema: {
        description: "Update an RFI question option. User must be a project member or company administrator. All fields are optional - only provided fields are updated.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId", "optionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
            optionId: {
              type: "string",
              description: "Option ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            label: {
              type: "string",
              nullable: true,
              description: "Option label",
            },
            value: {
              type: "string",
              nullable: true,
              description: "Option value",
            },
            xAxis: {
              type: "boolean",
              nullable: true,
              description: "Whether this option is on the X-axis",
            },
            yAxis: {
              type: "boolean",
              nullable: true,
              description: "Whether this option is on the Y-axis",
            },
          },
        },
        response: {
          200: {
            type: "object",
            description: "Updated option",
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
            description: "Project, RFI, question, or option not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        const optionId = request.params.optionId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Delete option
   * User must be a project member or company admin
   * Cascades to delete related responses
   */
  fastify.delete<{
    Params: { id: string; questionId: string; optionId: string };
  }>(
    "/:id/rfi/questions/:questionId/options/:optionId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete an RFI question option. User must be a project member or company administrator. Cascades to delete related vendor responses.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId", "optionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
            optionId: {
              type: "string",
              description: "Option ID",
            },
          },
        },
        response: {
          204: {
            description: "Option deleted successfully",
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
            description: "Project, RFI, question, or option not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        const optionId = request.params.optionId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Reorder options
   * User must be a project member or company admin
   * Updates order for all specified options
   */
  fastify.put<{
    Params: { id: string; questionId: string };
    Body: {
      optionIds: string[];
    };
  }>(
    "/:id/rfi/questions/:questionId/options/reorder",
    {
      preHandler: [authenticate],
      schema: {
        description: "Reorder RFI question options (for drag-and-drop). User must be a project member or company administrator. Updates order for all specified options based on their position in the array.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            questionId: {
              type: "string",
              description: "Question ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["optionIds"],
          properties: {
            optionIds: {
              type: "array",
              items: { type: "string" },
              description: "Array of option IDs in the desired order",
            },
          },
        },
        response: {
          204: {
            description: "Options reordered successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Invalid option IDs",
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
            description: "Project, RFI, or question not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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

  /**
   * Get vendor responses
   * User must be a project member or company admin
   * Returns empty array if RFI doesn't exist
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/vendor-responses",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get all vendor responses for an RFI. User must be a project member or company administrator. Returns responses with vendor and answer details. Returns empty array if RFI doesn't exist.",
        tags: ["rfi"],
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
            description: "Array of vendor responses with vendor and contact details",
            // No schema validation - return data as-is to avoid serialization issues
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
            description: "Internal server error or RFI model not available",
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

      // Get RFI
      const rfi = await db.rFI.findUnique({
        where: { projectId },
      });

      if (!rfi) {
        return reply.send([]);
      }

      // Get all project vendors with vendor and contact info
      const projectVendors = await db.projectVendor.findMany({
        where: { projectId },
        select: {
          id: true,
          vendorId: true,
        },
      });

      // Get all vendor IDs
      const vendorIds = projectVendors.map(pv => pv.vendorId);

      // Fetch all vendors with their contact persons in one query
      // Use select instead of include to ensure proper JSON serialization
      const vendors = await db.vendor.findMany({
        where: { id: { in: vendorIds } },
        select: {
          id: true,
          name: true,
          VendorContactPerson: {
            where: { isMainContact: true },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              isMainContact: true,
            },
          },
        },
      });

      // Create a map of vendorId -> vendor for quick lookup
      const vendorMap = new Map();
      vendors.forEach((v: any) => {
        vendorMap.set(v.id, v);
      });

      // Get all vendor responses for this RFI
      const dbAny = db as any;
      const vendorResponses = await dbAny.rFIVendorResponse.findMany({
        where: { rfiId: rfi.id },
        select: {
          id: true,
          projectVendorId: true,
          status: true,
          sentAt: true,
          answeredAt: true,
          createdAt: true,
          magicLinkToken: true,
          contactPerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // Create a map of projectVendorId -> vendorResponse for quick lookup
      const responseMap = new Map();
      vendorResponses.forEach((vr: any) => {
        responseMap.set(vr.projectVendorId, vr);
      });

      // Format response: all vendors with their RFI response status if they have one
      const result = projectVendors.map((pv: any) => {
        const vendor = vendorMap.get(pv.vendorId);
        const vendorResponse = responseMap.get(pv.id);
        // Find main contact - from vendor or from response
        const mainContact = vendor?.VendorContactPerson?.[0] || vendorResponse?.contactPerson;

        const vendorName = vendor?.name || `Vendor ${pv.vendorId}`;

        return {
          id: vendorResponse?.id || null,
          vendorId: pv.vendorId,
          vendorName: vendorName,
          contactPerson: mainContact ? {
            id: mainContact.id,
            firstName: mainContact.firstName || "",
            lastName: mainContact.lastName || "",
            email: mainContact.email || "",
            phone: mainContact.phone || null,
          } : {
            id: "",
            firstName: "Unknown",
            lastName: "",
            email: "",
            phone: null,
          },
          status: vendorResponse?.status || null,
          sentAt: vendorResponse?.sentAt || null,
          answeredAt: vendorResponse?.answeredAt || null,
          createdAt: vendorResponse?.createdAt || null,
          magicLinkToken: vendorResponse?.magicLinkToken || null,
        };
      });

      return reply.send(result);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi/vendor-responses");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get individual vendor response with answers
   * User must be a project member or company admin
   * Returns vendor response with all question answers
   */
  fastify.get<{
    Params: { id: string; vendorResponseId: string };
  }>(
    "/:id/rfi/vendor-responses/:vendorResponseId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get individual vendor response with all answers. User must be a project member or company administrator. Returns vendor response with nested responses array containing all question answers.",
        tags: ["rfi"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "vendorResponseId"],
          properties: {
            id: {
              type: "string",
              description: "Project ID",
            },
            vendorResponseId: {
              type: "string",
              description: "Vendor Response ID",
            },
          },
        },
        response: {
          200: {
            description: "Vendor response with answers",
            // No schema validation - return data as-is to avoid serialization issues
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
            description: "Project, RFI, or vendor response not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const vendorResponseId = request.params.vendorResponseId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Verify project access using middleware
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        // Get RFI
        const rfi = await db.rFI.findUnique({
          where: { projectId },
        });

        if (!rfi) {
          return reply.status(404).send({ error: "RFI not found" });
        }

        // Get vendor response with project vendor info
        const RFIVendorResponse = getRFIModel("RFIVendorResponse");
        const vendorResponse = await RFIVendorResponse.findUnique({
          where: { id: vendorResponseId },
          select: {
            id: true,
            rfiId: true,
            status: true,
            sentAt: true,
            answeredAt: true,
            createdAt: true,
            projectVendor: {
              select: {
                id: true,
                projectId: true,
                vendorId: true,
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            contactPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        });

        if (!vendorResponse) {
          request.log.warn({ projectId, vendorResponseId }, "Vendor response not found");
          return reply.status(404).send({ error: "Vendor response not found" });
        }

        // Verify vendor response belongs to this RFI and project
        if (vendorResponse.rfiId !== rfi.id) {
          request.log.warn({ 
            projectId, 
            vendorResponseId, 
            vendorResponseRfiId: vendorResponse.rfiId, 
            expectedRfiId: rfi.id 
          }, "Vendor response RFI mismatch");
          return reply.status(404).send({ error: "Vendor response not found for this RFI" });
        }

        if (vendorResponse.projectVendor.projectId !== projectId) {
          request.log.warn({ 
            projectId, 
            vendorResponseId, 
            vendorResponseProjectId: vendorResponse.projectVendor.projectId 
          }, "Vendor response project mismatch");
          return reply.status(404).send({ error: "Vendor response not found for this project" });
        }

        // Get all responses (answers) for this vendor response
        const RFIResponse = getRFIModel("RFIResponse");
        const responses = await RFIResponse.findMany({
          where: { vendorResponseId },
          select: {
            id: true,
            questionId: true,
            answer: true,
            createdAt: true,
            updatedAt: true,
            question: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                order: true,
                required: true,
                scaleLabels: true,
                options: {
                  select: {
                    id: true,
                    label: true,
                    value: true,
                    order: true,
                  },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
          orderBy: {
            question: {
              order: "asc",
            },
          },
        });

        request.log.info({ 
          projectId, 
          vendorResponseId, 
          responseCount: responses.length,
          vendorName: vendorResponse.projectVendor.vendor.name 
        }, "Fetched vendor response with answers");

        // Format response
        const responseData = {
          id: vendorResponse.id,
          vendorId: vendorResponse.projectVendor.vendorId,
          vendorName: vendorResponse.projectVendor.vendor.name,
          contactPerson: vendorResponse.contactPerson,
          status: vendorResponse.status,
          sentAt: vendorResponse.sentAt,
          answeredAt: vendorResponse.answeredAt,
          createdAt: vendorResponse.createdAt,
          responses: responses.map((r: any) => ({
            id: r.id,
            questionId: r.questionId,
            answer: r.answer,
            question: r.question,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
        };

        return reply.send(responseData);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfi/vendor-responses/:vendorResponseId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Send RFI to vendors
   * User must be a project member or company admin
   * Requires RFI to be published
   * Sends email invitations to all project vendors
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfi/send",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send RFI to all project vendors. User must be a project member or company administrator. Requires RFI to be published. Sends email invitations to all vendors linked to the project.",
        tags: ["rfi"],
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
              success: { type: "boolean" },
              sent: { type: "number", description: "Number of emails sent" },
            },
            description: "RFI sent to vendors successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "RFI not published or no vendors in project",
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
            description: "Project or RFI not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
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
          // Generate magic link token
          const tokenExpiresAt = new Date();
          tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30); // 30 days from now
          
          const vendorResponse = await RFIVendorResponse.create({
            data: {
              rfiId: rfi.id,
              projectVendorId: pv.id,
              contactPersonId: mainContact.id,
              status: "Sent",
              sentAt: now,
              tokenExpiresAt,
            },
          });

          // Generate JWT token
          const magicLinkToken = fastify.jwt.sign(
            {
              vendorResponseId: vendorResponse.id,
              type: "rfi-vendor",
            } as any,
            { expiresIn: "30d" }
          );

          // Update with token
          await RFIVendorResponse.update({
            where: { id: vendorResponse.id },
            data: { magicLinkToken },
          });

          // Update vendor status
          if (pv.status === "Pending") {
            await db.projectVendor.update({
              where: { id: pv.id },
              data: { status: "RFI_Received" },
            });
          }

          // TODO: Send email in production with magic link
          // Magic link URL: ${baseUrl}/rfi/${magicLinkToken}
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

  /**
   * Resend RFI to specific vendor
   * User must be a project member or company admin
   * Requires RFI to be published
   */
  fastify.post<{
    Params: { id: string; vendorId: string };
  }>(
    "/:id/rfi/resend/:vendorId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Resend RFI invitation to a specific vendor. User must be a project member or company administrator. Requires RFI to be published.",
        tags: ["rfi"],
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
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
            description: "RFI resent to vendor successfully",
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "RFI not published or vendor not in project",
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
            description: "Project, RFI, or vendor not found",
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
            description: "Internal server error or RFI model not available",
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const vendorId = request.params.vendorId;
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

      // Verify project access using middleware
      await verifyProjectAccess(request, reply);
      if (reply.sent) return;

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
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30); // 30 days from now

      // Update or create vendor response
      const vendorResponse = await RFIVendorResponse.upsert({
        where: {
          rfiId_projectVendorId: {
            rfiId: rfi.id,
            projectVendorId: projectVendor.id,
          },
        },
        update: {
          sentAt: now,
          status: "Sent",
          tokenExpiresAt,
        },
        create: {
          rfiId: rfi.id,
          projectVendorId: projectVendor.id,
          contactPersonId: mainContact.id,
          status: "Sent",
          sentAt: now,
          tokenExpiresAt,
        },
      });

      // Generate or regenerate magic link token
      const magicLinkToken = fastify.jwt.sign(
        {
          vendorResponseId: vendorResponse.id,
          type: "rfi-vendor",
        } as any,
        { expiresIn: "30d" }
      );

      // Update with token
      await RFIVendorResponse.update({
        where: { id: vendorResponse.id },
        data: { magicLinkToken },
      });

      // Sync vendor status from RFI status (RFI resent = vendor receives it again)
      await syncVendorStatusFromRFIStatus("Sent", projectVendor.id);

      // TODO: Send email in production (with CC to logged in user) with magic link
      // Magic link URL: ${baseUrl}/rfi/${magicLinkToken}

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

  /**
   * Get RFI preview
   * User must be a project member or company admin
   * Returns RFI with questions and options for preview
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfi/preview",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get RFI preview for display. User must be a project member or company administrator. Returns RFI with all questions and options ordered for preview.",
        tags: ["rfi"],
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
            description: "RFI with questions and options for preview",
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
            description: "Internal server error or RFI model not available",
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

      // Get RFI with questions
      // Use select instead of include to ensure proper JSON serialization
      // Use direct model access like requirements endpoint
      const rfi = await db.rFI.findUnique({
        where: { projectId },
        select: {
          id: true,
          projectId: true,
          emailSubject: true,
          emailText: true,
          rfiInformation: true,
          emailTemplateId: true,
          rfiInformationTemplateId: true,
          deadline: true,
          autoPublishDate: true,
          isPublished: true,
          publishedAt: true,
          unpublishedAt: true,
          createdAt: true,
          updatedAt: true,
          questions: {
            select: {
              id: true,
              rfiId: true,
              title: true,
              description: true,
              type: true,
              order: true,
              required: true,
              scaleLabels: true,
              createdAt: true,
              updatedAt: true,
              options: {
                select: {
                  id: true,
                  questionId: true,
                  label: true,
                  value: true,
                  xAxis: true,
                  yAxis: true,
                  order: true,
                  createdAt: true,
                  updatedAt: true,
                },
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

        // Using select ensures we get plain JavaScript objects that serialize correctly
        // Fastify's serializer handles Date objects automatically
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
