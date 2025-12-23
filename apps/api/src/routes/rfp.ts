import { FastifyInstance } from "fastify";
import { db } from "@dp/db";
import { authenticate, getUser } from "../middleware/auth";
import { verifyProjectAccess } from "../middleware/project-access";

// Helper function to initialize default schedule items for a new RFP
async function initializeDefaultScheduleItems(rfpId: string) {
  // Check if required schedule items already exist
  const existingItems = await db.rFPScheduleItem.findMany({
    where: {
      rfpId,
      type: { in: ["StartDate", "AcceptanceDate", "QuestionsDate", "DeliveryDate"] },
    },
  });

  // Create a set of existing types to avoid duplicates
  const existingTypes = new Set(existingItems.map((item) => item.type));

  // Create default schedule items (only if they don't exist)
  const defaultItems = [
    { type: "StartDate" as const, description: "Publish date", date: null, isRequired: true, order: 0 },
    { type: "AcceptanceDate" as const, description: "Deadline for Acceptance", date: null, isRequired: true, order: 1 },
    { type: "QuestionsDate" as const, description: "Deadline for Questions", date: null, isRequired: true, order: 2 },
    { type: "DeliveryDate" as const, description: "Deadline for Delivery", date: null, isRequired: true, order: 3 },
  ];

  for (const itemData of defaultItems) {
    // Only create if this type doesn't already exist
    if (!existingTypes.has(itemData.type)) {
      await db.rFPScheduleItem.create({
        data: {
          rfpId,
          type: itemData.type,
          description: itemData.description,
          date: itemData.date,
          isRequired: itemData.isRequired,
          order: itemData.order,
        },
      });
    }
  }
}

// Helper function to create or update changelog entry
// Merges with last entry if less than 15 minutes old
async function createChangelogEntry(
  rfpId: string,
  description: string,
  userId: string
) {
  try {
    // Verify RFP exists
    const rfp = await db.rFP.findUnique({
      where: { id: rfpId },
      select: { id: true },
    });

    if (!rfp) {
      return; // RFP doesn't exist
    }

    const now = new Date();

    // Get the last changelog entry
    const lastEntry = await db.rFPChangelogEntry.findFirst({
      where: { rfpId },
      orderBy: { createdAt: "desc" },
    });

    // If last entry was less than 15 minutes ago, append to it
    if (lastEntry) {
      const timeDiff = now.getTime() - lastEntry.createdAt.getTime();
      const fifteenMinutes = 15 * 60 * 1000;

      if (timeDiff < fifteenMinutes) {
        // Update the last entry
        await db.rFPChangelogEntry.update({
          where: { id: lastEntry.id },
          data: {
            description: `${lastEntry.description}\n${description}`,
            updatedAt: now,
          },
        });
        return;
      }
    }

    // Create new entry
    await db.rFPChangelogEntry.create({
      data: {
        rfpId,
        description,
        createdById: userId,
      },
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error("Error creating changelog entry:", error);
  }
}

export default async function rfpRoutes(fastify: FastifyInstance) {
  /**
   * Get RFP for a project
   * User must be a project member or company admin
   * Creates RFP if it doesn't exist
   */
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp",
    {
      preHandler: [authenticate],
      schema: {
        description: "Get RFP for a project. User must be a project member or company administrator. If RFP doesn't exist, creates it.",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "RFP data" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        let rfp = await db.rFP.findUnique({
          where: { projectId },
          select: {
            id: true,
            projectId: true,
            status: true,
            contactPersonId: true,
            alternativeContactPersonId: true,
            publishDate: true,
            deliveryDate: true,
            about: true,
            createdAt: true,
            updatedAt: true,
            contactPerson: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
            alternativeContactPerson: {
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

        if (!rfp) {
          rfp = await db.rFP.create({
            data: {
              projectId,
              status: "Draft",
            },
            select: {
              id: true,
              projectId: true,
              status: true,
              contactPersonId: true,
              alternativeContactPersonId: true,
              publishDate: true,
              deliveryDate: true,
              about: true,
              createdAt: true,
              updatedAt: true,
              contactPerson: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
              alternativeContactPerson: {
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

          // Initialize default schedule items
          await initializeDefaultScheduleItems(rfp.id);
        }

        return reply.send(rfp);
      } catch (error: any) {
        request.log.error({ err: error, projectId: request.params.id }, "Error in GET /:id/rfp");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Update RFP
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      status?: "Draft" | "Published" | "Closed";
      contactPersonId?: string | null;
      alternativeContactPersonId?: string | null;
      publishDate?: string | null;
      deliveryDate?: string | null;
      about?: string | null;
    };
  }>(
    "/:id/rfp",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update RFP settings",
        tags: ["rfp"],
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
          properties: {
            status: { type: "string", enum: ["Draft", "Published", "Closed"] },
            contactPersonId: { type: "string", nullable: true },
            alternativeContactPersonId: { type: "string", nullable: true },
            publishDate: { type: "string", format: "date-time", nullable: true },
            deliveryDate: { type: "string", format: "date-time", nullable: true },
            about: { type: "string", nullable: true },
          },
        },
        response: {
          200: { description: "Updated RFP" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const updateData: any = {};
        if (request.body.status !== undefined) {
          updateData.status = request.body.status;
        }
        if (request.body.contactPersonId !== undefined) {
          updateData.contactPersonId = request.body.contactPersonId || null;
        }
        if (request.body.alternativeContactPersonId !== undefined) {
          updateData.alternativeContactPersonId = request.body.alternativeContactPersonId || null;
        }
        if (request.body.publishDate !== undefined) {
          updateData.publishDate = request.body.publishDate ? new Date(request.body.publishDate) : null;
        }
        if (request.body.deliveryDate !== undefined) {
          updateData.deliveryDate = request.body.deliveryDate ? new Date(request.body.deliveryDate) : null;
        }
        if (request.body.about !== undefined) {
          updateData.about = request.body.about || null;
        }

        const rfp = await db.rFP.upsert({
          where: { projectId },
          update: updateData,
          create: {
            projectId,
            status: request.body.status || "Draft",
            contactPersonId: request.body.contactPersonId || null,
            alternativeContactPersonId: request.body.alternativeContactPersonId || null,
            publishDate: request.body.publishDate ? new Date(request.body.publishDate) : null,
            deliveryDate: request.body.deliveryDate ? new Date(request.body.deliveryDate) : null,
          },
          select: {
            id: true,
            projectId: true,
            status: true,
            contactPersonId: true,
            alternativeContactPersonId: true,
            publishDate: true,
            deliveryDate: true,
            about: true,
            createdAt: true,
            updatedAt: true,
            contactPerson: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
            alternativeContactPerson: {
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

        // Create changelog entry if RFP is published
        if (rfp.status === "Published") {
          await createChangelogEntry(
            rfp.id,
            "RFP settings updated",
            user.userId
          );
        }

        return reply.send(rfp);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Publish RFP
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfp/publish",
    {
      preHandler: [authenticate],
      schema: {
        description: "Publish RFP",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        const rfp = await db.rFP.findUnique({
          where: { projectId },
          include: {
            contactPerson: true,
            alternativeContactPerson: true,
          },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Check if main contact person is set
        if (!rfp.contactPersonId) {
          return reply.status(400).send({
            error: "Main contact person must be set before publishing",
          });
        }

        // Verify user permissions: must be company admin, main contact, or alternative contact
        const isCompanyAdmin = user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator";
        const isMainContact = rfp.contactPersonId === user.userId;
        const isAlternativeContact = rfp.alternativeContactPersonId === user.userId;

        if (!isCompanyAdmin && !isMainContact && !isAlternativeContact) {
          return reply.status(403).send({
            error: "Only company administrators, main contact person, or alternative contact can publish the RFP",
          });
        }

        // Check if all required dates are set (except StartDate which will be set to current time)
        const requiredItems = await db.rFPScheduleItem.findMany({
          where: {
            rfpId: rfp.id,
            isRequired: true,
          },
        });

        const missingDates: string[] = [];
        for (const item of requiredItems) {
          // Skip StartDate as it will be set to current time
          if (item.type !== "StartDate" && !item.date) {
            missingDates.push(item.description);
          }
        }

        if (missingDates.length > 0) {
          return reply.status(400).send({
            error: "All required dates must be set before publishing",
            message: `Missing dates: ${missingDates.join(", ")}`,
          });
        }

        // Get start date item
        const startDateItem = requiredItems.find((item) => item.type === "StartDate");
        if (!startDateItem) {
          return reply.status(400).send({
            error: "Start date schedule item not found",
          });
        }

        // Set start date to current time
        const currentTime = new Date();

        // Update start date schedule item
        await db.rFPScheduleItem.update({
          where: { id: startDateItem.id },
          data: {
            date: currentTime,
          },
        });

        // Update RFP status and publish date
        await db.rFP.update({
          where: { projectId },
          data: {
            status: "Published",
            publishDate: currentTime,
          },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/publish");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Generate preview token for RFP
   * Creates a temporary token for company users to preview the vendor portal in read-only mode
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfp/preview-token",
    {
      preHandler: [authenticate],
      schema: {
        description: "Generate a preview token for the RFP vendor portal. User must be a project member or company administrator.",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string", description: "Preview token for vendor portal access" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
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

        // Get RFP
        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Generate preview token with user context
        const user = getUser(request);
        const token = fastify.jwt.sign({
          userId: user.userId,
          projectId,
          rfpId: rfp.id,
          type: "rfp-preview",
        } as any, { expiresIn: "1h" });

        return reply.send({ token });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/preview-token");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Impersonate a vendor contact for testing purposes
   * Only available to project admins and company administrators
   */
  fastify.post<{
    Params: { id: string; contactPersonId: string };
  }>(
    "/:id/rfp/impersonate/:contactPersonId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Generate a vendor contact token for impersonation. Only available to project members or company administrators.",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "contactPersonId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            contactPersonId: { type: "string", description: "Vendor contact person ID" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string", description: "Vendor contact impersonation token" },
              contactPerson: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  isMainContact: { type: "boolean" },
                  vendor: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const contactPersonId = request.params.contactPersonId;
        
        if (!request.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        // Verify project access using middleware
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const user = getUser(request);
        
        // Check if user is admin (CompanyAdministrator or GlobalAdministrator)
        // verifyProjectAccess already checks for project member or admin, so we're good
        // But we want to restrict to admins only for impersonation
        const isAdmin = user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator";
        if (!isAdmin) {
          return reply.status(403).send({ error: "Only administrators can impersonate vendor contacts" });
        }

        // Verify contact person exists and belongs to a vendor in this project
        const contactPerson = await db.vendorContactPerson.findUnique({
          where: { id: contactPersonId },
          include: {
            vendor: {
              include: {
                ProjectVendor: {
                  where: {
                    projectId,
                  },
                },
              },
            },
          },
        });

        if (!contactPerson) {
          return reply.status(404).send({ error: "Vendor contact not found" });
        }

        // Verify the vendor is linked to this project
        if (contactPerson.vendor.ProjectVendor.length === 0) {
          return reply.status(403).send({ error: "Vendor contact does not belong to a vendor in this project" });
        }

        // Generate vendor contact token with impersonated flag
        // Set expiration to 24 hours for impersonation tokens
        const token = fastify.jwt.sign({
          contactPersonId: contactPerson.id,
          vendorId: contactPerson.vendorId,
          email: contactPerson.email,
          isMainContact: contactPerson.isMainContact,
          type: "vendor-contact",
          impersonated: true,
        } as any, { expiresIn: "24h" });

        return reply.send({
          token,
          contactPerson: {
            id: contactPerson.id,
            email: contactPerson.email,
            firstName: contactPerson.firstName,
            lastName: contactPerson.lastName,
            isMainContact: contactPerson.isMainContact,
            vendor: {
              id: contactPerson.vendor.id,
              name: contactPerson.vendor.name,
            },
          },
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/impersonate/:contactPersonId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Send RFP to vendors
   */
  fastify.post<{
    Params: { id: string };
  }>(
    "/:id/rfp/send",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send RFP to all project vendors via email",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // TODO: Implement email sending to all project vendors
        // For now, just return success
        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/send");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Schedule endpoints
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/schedule",
    {
      preHandler: [authenticate],
      schema: {
        description: "List schedule items for RFP",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "List of schedule items" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Initialize default schedule items if they don't exist (for existing RFPs)
        await initializeDefaultScheduleItems(rfp.id);

        const items = await db.rFPScheduleItem.findMany({
          where: { rfpId: rfp.id },
          orderBy: [
            { date: "asc" },
            { fromDate: "asc" },
            { order: "asc" },
          ],
        });

        return reply.send(items);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/schedule");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: {
      type: "StartDate" | "AcceptanceDate" | "QuestionsDate" | "DeliveryDate" | "CustomDate" | "CustomDateRange";
      description: string;
      date?: string;
      fromDate?: string;
      toDate?: string;
      isRequired?: boolean;
    };
  }>(
    "/:id/rfp/schedule",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create schedule item",
        tags: ["rfp"],
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
          required: ["type", "description"],
          properties: {
            type: {
              type: "string",
              enum: ["StartDate", "AcceptanceDate", "QuestionsDate", "DeliveryDate", "CustomDate", "CustomDateRange"],
            },
            description: { type: "string" },
            date: { type: "string", format: "date-time" },
            fromDate: { type: "string", format: "date-time" },
            toDate: { type: "string", format: "date-time" },
            isRequired: { type: "boolean" },
          },
        },
        response: {
          200: { description: "Created schedule item" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        let rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        // Create RFP if it doesn't exist (similar to GET endpoint)
        if (!rfp) {
          rfp = await db.rFP.create({
            data: {
              projectId,
              status: "Draft",
            },
          });

          // Initialize default schedule items
          await initializeDefaultScheduleItems(rfp.id);
        }

        // Get max order
        const maxOrder = await db.rFPScheduleItem.findFirst({
          where: { rfpId: rfp.id },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        const itemDate = request.body.date ? new Date(request.body.date) : null;
        const item = await db.rFPScheduleItem.create({
          data: {
            rfpId: rfp.id,
            type: request.body.type,
            description: request.body.description,
            date: itemDate,
            fromDate: request.body.fromDate ? new Date(request.body.fromDate) : null,
            toDate: request.body.toDate ? new Date(request.body.toDate) : null,
            order: (maxOrder?.order ?? -1) + 1,
            isRequired: request.body.isRequired ?? false,
          },
        });

        // Sync schedule item dates to RFP model for StartDate and DeliveryDate
        const rfpUpdateData: any = {};
        if (request.body.type === "StartDate" && itemDate) {
          rfpUpdateData.publishDate = itemDate;
        } else if (request.body.type === "DeliveryDate" && itemDate) {
          rfpUpdateData.deliveryDate = itemDate;
        }

        // Update RFP if needed
        if (Object.keys(rfpUpdateData).length > 0) {
          await db.rFP.update({
            where: { id: rfp.id },
            data: rfpUpdateData,
          });
        }

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${request.body.description}" was added to Schedule`,
          user.userId
        );

        return reply.send(item);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/schedule");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string; itemId: string };
    Body: {
      description?: string;
      date?: string | null;
      fromDate?: string | null;
      toDate?: string | null;
    };
  }>(
    "/:id/rfp/schedule/:itemId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update schedule item",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            itemId: { type: "string", description: "Schedule item ID" },
          },
        },
        body: {
          type: "object",
          properties: {
            description: { type: "string" },
            date: { type: "string", format: "date-time", nullable: true },
            fromDate: { type: "string", format: "date-time", nullable: true },
            toDate: { type: "string", format: "date-time", nullable: true },
            linkedToDeliveryDate: { type: "boolean" },
            disregardTimestamp: { type: "boolean" },
          },
        },
        response: {
          200: { description: "Updated schedule item" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const itemId = request.params.itemId;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const item = await db.rFPScheduleItem.findUnique({
          where: { id: itemId },
        });

        if (!item || item.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Schedule item not found" });
        }

        const updateData: any = {};
        if (request.body.description !== undefined) {
          updateData.description = request.body.description;
        }
        if (request.body.date !== undefined) {
          updateData.date = request.body.date ? new Date(request.body.date) : null;
        }
        if (request.body.fromDate !== undefined) {
          updateData.fromDate = request.body.fromDate ? new Date(request.body.fromDate) : null;
        }
        if (request.body.toDate !== undefined) {
          updateData.toDate = request.body.toDate ? new Date(request.body.toDate) : null;
        }
        if (request.body.linkedToDeliveryDate !== undefined) {
          updateData.linkedToDeliveryDate = request.body.linkedToDeliveryDate;
        }
        if (request.body.disregardTimestamp !== undefined) {
          updateData.disregardTimestamp = request.body.disregardTimestamp;
        }

        const updated = await db.rFPScheduleItem.update({
          where: { id: itemId },
          data: updateData,
        });

        // Sync schedule item dates to RFP model for StartDate and DeliveryDate
        const rfpUpdateData: any = {};
        if (item.type === "StartDate" && updateData.date !== undefined) {
          rfpUpdateData.publishDate = updateData.date;
        } else if (item.type === "DeliveryDate" && updateData.date !== undefined) {
          rfpUpdateData.deliveryDate = updateData.date;
        }

        // Update RFP if needed
        if (Object.keys(rfpUpdateData).length > 0) {
          await db.rFP.update({
            where: { id: rfp.id },
            data: rfpUpdateData,
          });
        }

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${item.description}" was changed in Schedule`,
          user.userId
        );

        return reply.send(updated);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/schedule/:itemId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.delete<{
    Params: { id: string; itemId: string };
  }>(
    "/:id/rfp/schedule/:itemId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete schedule item (if not required)",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "itemId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            itemId: { type: "string", description: "Schedule item ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const itemId = request.params.itemId;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const item = await db.rFPScheduleItem.findUnique({
          where: { id: itemId },
        });

        if (!item || item.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Schedule item not found" });
        }

        if (item.isRequired) {
          return reply.status(400).send({
            error: "Cannot delete required schedule item",
          });
        }

        await db.rFPScheduleItem.delete({
          where: { id: itemId },
        });

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${item.description}" was removed from Schedule`,
          user.userId
        );

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/schedule/:itemId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Documents/Links endpoints
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/documents",
    {
      preHandler: [authenticate],
      schema: {
        description: "List documents and links for RFP",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "List of documents and links" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const documents = await db.rFPDocument.findMany({
          where: { rfpId: rfp.id },
          orderBy: { order: "asc" },
        });

        return reply.send(documents);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/documents");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: {
      type: "Document" | "Link";
      description: string;
      url?: string;
      fileName?: string;
      fileType?: string;
      fileData?: string; // Base64
      fileSize?: number;
    };
  }>(
    "/:id/rfp/documents",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create document or link",
        tags: ["rfp"],
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
          required: ["type", "description"],
          properties: {
            type: { type: "string", enum: ["Document", "Link", "Requirements"] },
            description: { type: "string" },
            url: { type: "string" },
            fileName: { type: "string" },
            fileType: { type: "string" },
            fileData: { type: "string" },
            fileSize: { type: "number" },
          },
        },
        response: {
          200: { description: "Created document or link" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Validate
        if (request.body.type === "Link" && !request.body.url) {
          return reply.status(400).send({ error: "URL is required for links" });
        }
        if (request.body.type === "Document" && !request.body.fileData) {
          return reply.status(400).send({ error: "File data is required for documents" });
        }
        // Requirements documents don't need URL or fileData

        // Validate file type for documents
        if (request.body.type === "Document" && request.body.fileType) {
          const allowedTypes = ["application/pdf", "application/zip"];
          if (!allowedTypes.includes(request.body.fileType)) {
            return reply.status(400).send({
              error: "Only PDF and ZIP files are allowed",
            });
          }
        }

        // Get max order
        const maxOrder = await db.rFPDocument.findFirst({
          where: { rfpId: rfp.id },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        // Capitalize description if all lowercase
        let description = request.body.description;
        if (description && description === description.toLowerCase() && description.length > 0) {
          description = description.charAt(0).toUpperCase() + description.slice(1);
        }

        const document = await db.rFPDocument.create({
          data: {
            rfpId: rfp.id,
            type: request.body.type,
            description,
            url: request.body.url || null,
            fileName: request.body.fileName || null,
            fileType: request.body.fileType || null,
            fileData: request.body.fileData || null,
            fileSize: request.body.fileSize || null,
            order: (maxOrder?.order ?? -1) + 1,
          },
        });

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${description}" was added to Documents`,
          user.userId
        );

        return reply.send(document);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/documents");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string; docId: string };
    Body: {
      description?: string;
      url?: string | null;
      fileName?: string | null;
      fileType?: string | null;
      fileData?: string | null;
      fileSize?: number | null;
    };
  }>(
    "/:id/rfp/documents/:docId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update document or link",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "docId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            docId: { type: "string", description: "Document ID" },
          },
        },
        body: {
          type: "object",
          properties: {
            description: { type: "string" },
            url: { type: "string", nullable: true },
            fileName: { type: "string", nullable: true },
            fileType: { type: "string", nullable: true },
            fileData: { type: "string", nullable: true },
            fileSize: { type: "number", nullable: true },
          },
        },
        response: {
          200: { description: "Updated document or link" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const docId = request.params.docId;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const doc = await db.rFPDocument.findUnique({
          where: { id: docId },
        });

        if (!doc || doc.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Document not found" });
        }

        const updateData: any = {};
        if (request.body.description !== undefined) {
          updateData.description = request.body.description;
        }
        if (request.body.url !== undefined) {
          updateData.url = request.body.url || null;
        }
        if (request.body.fileName !== undefined) {
          updateData.fileName = request.body.fileName || null;
        }
        if (request.body.fileType !== undefined) {
          updateData.fileType = request.body.fileType || null;
        }
        if (request.body.fileData !== undefined) {
          updateData.fileData = request.body.fileData || null;
        }
        if (request.body.fileSize !== undefined) {
          updateData.fileSize = request.body.fileSize || null;
        }
        
        // Validate file type if updating file data
        if (updateData.fileType && updateData.fileType !== null) {
          const allowedTypes = ["application/pdf", "application/zip"];
          if (!allowedTypes.includes(updateData.fileType)) {
            return reply.status(400).send({
              error: "Only PDF and ZIP files are allowed",
            });
          }
        }

        const updated = await db.rFPDocument.update({
          where: { id: docId },
          data: updateData,
        });

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${doc.description}" was changed in Documents`,
          user.userId
        );

        return reply.send(updated);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/documents/:docId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.delete<{
    Params: { id: string; docId: string };
  }>(
    "/:id/rfp/documents/:docId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete document or link",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "docId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            docId: { type: "string", description: "Document ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const docId = request.params.docId;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const doc = await db.rFPDocument.findUnique({
          where: { id: docId },
        });

        if (!doc || doc.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Document not found" });
        }

        await db.rFPDocument.delete({
          where: { id: docId },
        });

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `"${doc.description}" was removed from Documents`,
          user.userId
        );

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/documents/:docId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string };
    Body: {
      documentIds: string[];
    };
  }>(
    "/:id/rfp/documents/reorder",
    {
      preHandler: [authenticate],
      schema: {
        description: "Reorder documents",
        tags: ["rfp"],
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
          required: ["documentIds"],
          properties: {
            documentIds: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Update order for each document
        for (let i = 0; i < request.body.documentIds.length; i++) {
          await db.rFPDocument.update({
            where: { id: request.body.documentIds[i] },
            data: { order: i },
          });
        }

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/documents/reorder");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Changelog endpoints
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/changelog",
    {
      preHandler: [authenticate],
      schema: {
        description: "List changelog entries",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "List of changelog entries" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const entries = await db.rFPChangelogEntry.findMany({
          where: { rfpId: rfp.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rfpId: true,
            description: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
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

        return reply.send(entries);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/changelog");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string; entryId: string };
    Body: {
      description: string;
    };
  }>(
    "/:id/rfp/changelog/:entryId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update changelog entry description",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "entryId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            entryId: { type: "string", description: "Changelog entry ID" },
          },
        },
        body: {
          type: "object",
          required: ["description"],
          properties: {
            description: { type: "string" },
          },
        },
        response: {
          200: { description: "Updated changelog entry" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const entryId = request.params.entryId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const entry = await db.rFPChangelogEntry.findUnique({
          where: { id: entryId },
        });

        if (!entry || entry.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Changelog entry not found" });
        }

        const updated = await db.rFPChangelogEntry.update({
          where: { id: entryId },
          data: {
            description: request.body.description,
          },
        });

        return reply.send(updated);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/changelog/:entryId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.delete<{
    Params: { id: string; entryId: string };
  }>(
    "/:id/rfp/changelog/:entryId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete changelog entry",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "entryId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            entryId: { type: "string", description: "Changelog entry ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const entryId = request.params.entryId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const entry = await db.rFPChangelogEntry.findUnique({
          where: { id: entryId },
        });

        if (!entry || entry.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Changelog entry not found" });
        }

        await db.rFPChangelogEntry.delete({
          where: { id: entryId },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/changelog/:entryId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Q&A endpoints
  fastify.get<{
    Params: { id: string };
    Querystring: {
      filter?: "answered" | "unanswered";
    };
  }>(
    "/:id/rfp/questions",
    {
      preHandler: [authenticate],
      schema: {
        description: "List questions (with optional filter)",
        tags: ["rfp"],
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
            filter: { type: "string", enum: ["answered", "unanswered"] },
          },
        },
        response: {
          200: { description: "List of questions" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const filter = request.query.filter;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const where: any = { rfpId: rfp.id };
        if (filter === "answered") {
          where.answer = { not: null };
        } else if (filter === "unanswered") {
          where.answer = null;
        }

        const orderBy: any[] = [];
        if (filter === "unanswered") {
          orderBy.push({ createdAt: "asc" }); // Oldest first
        } else if (filter === "answered") {
          orderBy.push({ answeredAt: "desc" }); // Newest first
        } else {
          orderBy.push({ createdAt: "desc" }); // Default: newest first
        }

        const questions = await db.rFPQuestion.findMany({
          where,
          orderBy,
          select: {
            id: true,
            rfpId: true,
            question: true,
            cleanedQuestion: true,
            answer: true,
            answeredAt: true,
            answeredById: true,
            vendorId: true,
            contactPersonId: true,
            createdAt: true,
            updatedAt: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
            contactPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            answeredBy: {
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

        return reply.send(questions);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/questions");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: {
      question: string;
      vendorId: string;
      contactPersonId: string;
      createdAt?: string;
    };
  }>(
    "/:id/rfp/questions",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create question manually",
        tags: ["rfp"],
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
          required: ["question", "vendorId", "contactPersonId"],
          properties: {
            question: { type: "string" },
            vendorId: { type: "string" },
            contactPersonId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: { description: "Created question" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Verify vendor and contact person exist
        const vendor = await db.vendor.findUnique({
          where: { id: request.body.vendorId },
        });

        if (!vendor) {
          return reply.status(400).send({ error: "Vendor not found" });
        }

        const contactPerson = await db.vendorContactPerson.findUnique({
          where: { id: request.body.contactPersonId },
        });

        if (!contactPerson || contactPerson.vendorId !== request.body.vendorId) {
          return reply.status(400).send({ error: "Contact person not found or doesn't belong to vendor" });
        }

        const question = await db.rFPQuestion.create({
          data: {
            rfpId: rfp.id,
            question: request.body.question,
            vendorId: request.body.vendorId,
            contactPersonId: request.body.contactPersonId,
            createdAt: request.body.createdAt ? new Date(request.body.createdAt) : undefined,
          },
          select: {
            id: true,
            rfpId: true,
            question: true,
            cleanedQuestion: true,
            answer: true,
            answeredAt: true,
            answeredById: true,
            vendorId: true,
            contactPersonId: true,
            createdAt: true,
            updatedAt: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
            contactPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            answeredBy: {
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

        return reply.send(question);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/questions");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string; questionId: string };
    Body: {
      questions: string[]; // Array of split questions
    };
  }>(
    "/:id/rfp/questions/:questionId/split",
    {
      preHandler: [authenticate],
      schema: {
        description: "Split question into multiple questions",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            questionId: { type: "string", description: "Question ID" },
          },
        },
        body: {
          type: "object",
          required: ["questions"],
          properties: {
            questions: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          200: { description: "Created questions from split" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const originalQuestion = await db.rFPQuestion.findUnique({
          where: { id: questionId },
        });

        if (!originalQuestion || originalQuestion.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Question not found" });
        }

        if (request.body.questions.length < 2) {
          return reply.status(400).send({
            error: "Must split into at least 2 questions",
          });
        }

        // Create new questions from split
        const createdQuestions = [];
        for (const questionText of request.body.questions) {
          if (questionText.trim()) {
            const newQuestion = await db.rFPQuestion.create({
              data: {
                rfpId: rfp.id,
                question: questionText.trim(),
                vendorId: originalQuestion.vendorId,
                contactPersonId: originalQuestion.contactPersonId,
                createdAt: originalQuestion.createdAt,
              },
              select: {
                id: true,
                rfpId: true,
                question: true,
                cleanedQuestion: true,
                answer: true,
                answeredAt: true,
                answeredById: true,
                vendorId: true,
                contactPersonId: true,
                createdAt: true,
                updatedAt: true,
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                contactPerson: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
                answeredBy: {
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
            createdQuestions.push(newQuestion);
          }
        }

        // Delete original question
        await db.rFPQuestion.delete({
          where: { id: questionId },
        });

        return reply.send(createdQuestions);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/questions/:questionId/split");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string; questionId: string };
    Body: {
      cleanedQuestion: string;
      answer: string; // HTML from WYSIWYG
    };
  }>(
    "/:id/rfp/questions/:questionId/answer",
    {
      preHandler: [authenticate],
      schema: {
        description: "Answer a question",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            questionId: { type: "string", description: "Question ID" },
          },
        },
        body: {
          type: "object",
          required: ["cleanedQuestion", "answer"],
          properties: {
            cleanedQuestion: { type: "string" },
            answer: { type: "string" },
          },
        },
        response: {
          200: { description: "Answered question" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const question = await db.rFPQuestion.findUnique({
          where: { id: questionId },
        });

        if (!question || question.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Question not found" });
        }

        const updated = await db.rFPQuestion.update({
          where: { id: questionId },
          data: {
            cleanedQuestion: request.body.cleanedQuestion,
            answer: request.body.answer,
            answeredAt: new Date(),
            answeredById: user.userId,
          },
          select: {
            id: true,
            rfpId: true,
            question: true,
            cleanedQuestion: true,
            answer: true,
            answeredAt: true,
            answeredById: true,
            vendorId: true,
            contactPersonId: true,
            createdAt: true,
            updatedAt: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
            contactPerson: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            answeredBy: {
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

        // Create changelog entry
        await createChangelogEntry(
          rfp.id,
          `Question answered: "${request.body.cleanedQuestion.substring(0, 50)}..."`,
          user.userId
        );

        return reply.send(updated);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/questions/:questionId/answer");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.delete<{
    Params: { id: string; questionId: string };
  }>(
    "/:id/rfp/questions/:questionId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete question",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "questionId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            questionId: { type: "string", description: "Question ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const questionId = request.params.questionId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const question = await db.rFPQuestion.findUnique({
          where: { id: questionId },
        });

        if (!question || question.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Question not found" });
        }

        await db.rFPQuestion.delete({
          where: { id: questionId },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/questions/:questionId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  // Announcements endpoints
  fastify.get<{
    Params: { id: string };
  }>(
    "/:id/rfp/announcements",
    {
      preHandler: [authenticate],
      schema: {
        description: "List announcements",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID" },
          },
        },
        response: {
          200: { description: "List of announcements" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const announcements = await db.rFPAnnouncement.findMany({
          where: { rfpId: rfp.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rfpId: true,
            title: true,
            description: true,
            sentAt: true,
            scheduledSendAt: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
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

        return reply.send(announcements);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /:id/rfp/announcements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: {
      title: string;
      description: string; // HTML from WYSIWYG
      sendImmediately?: boolean;
      scheduledSendAt?: string; // ISO datetime string
    };
  }>(
    "/:id/rfp/announcements",
    {
      preHandler: [authenticate],
      schema: {
        description: "Create announcement",
        tags: ["rfp"],
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
          required: ["title", "description"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            sendImmediately: { type: "boolean" },
            scheduledSendAt: { type: "string" },
          },
        },
        response: {
          200: { description: "Created announcement" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const user = getUser(request);
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const sendImmediately = request.body.sendImmediately !== false; // Default to true
        const now = new Date();
        const scheduledSendAt = request.body.scheduledSendAt
          ? new Date(request.body.scheduledSendAt)
          : null;

        const announcement = await db.rFPAnnouncement.create({
          data: {
            rfpId: rfp.id,
            title: request.body.title,
            description: request.body.description,
            createdById: user.userId,
            sentAt: sendImmediately ? now : null,
            scheduledSendAt: !sendImmediately && scheduledSendAt ? scheduledSendAt : null,
          },
          select: {
            id: true,
            rfpId: true,
            title: true,
            description: true,
            sentAt: true,
            scheduledSendAt: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
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

        return reply.send(announcement);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/announcements");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.post<{
    Params: { id: string; announcementId: string };
  }>(
    "/:id/rfp/announcements/:announcementId/send",
    {
      preHandler: [authenticate],
      schema: {
        description: "Send announcement via email to all vendors",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "announcementId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            announcementId: { type: "string", description: "Announcement ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const announcementId = request.params.announcementId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const announcement = await db.rFPAnnouncement.findUnique({
          where: { id: announcementId },
        });

        if (!announcement || announcement.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Announcement not found" });
        }

        // Update sentAt timestamp
        await db.rFPAnnouncement.update({
          where: { id: announcementId },
          data: { sentAt: new Date() },
        });

        // TODO: Implement email sending to all project vendors
        // For now, just return success

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in POST /:id/rfp/announcements/:announcementId/send");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.put<{
    Params: { id: string; announcementId: string };
    Body: {
      title: string;
      description: string; // HTML from WYSIWYG
      sendImmediately?: boolean;
      scheduledSendAt?: string; // ISO datetime string
    };
  }>(
    "/:id/rfp/announcements/:announcementId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Update announcement",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "announcementId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            announcementId: { type: "string", description: "Announcement ID" },
          },
        },
        body: {
          type: "object",
          required: ["title", "description"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            sendImmediately: { type: "boolean" },
            scheduledSendAt: { type: "string" },
          },
        },
        response: {
          200: { description: "Updated announcement" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const announcementId = request.params.announcementId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const announcement = await db.rFPAnnouncement.findUnique({
          where: { id: announcementId },
        });

        if (!announcement || announcement.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Announcement not found" });
        }

        // Don't allow updating sent announcements
        if (announcement.sentAt) {
          return reply.status(400).send({ error: "Cannot update sent announcement" });
        }

        const sendImmediately = request.body.sendImmediately !== false; // Default to true
        const scheduledSendAt = request.body.scheduledSendAt
          ? new Date(request.body.scheduledSendAt)
          : null;

        const updated = await db.rFPAnnouncement.update({
          where: { id: announcementId },
          data: {
            title: request.body.title,
            description: request.body.description,
            scheduledSendAt: !sendImmediately && scheduledSendAt ? scheduledSendAt : null,
          },
          select: {
            id: true,
            rfpId: true,
            title: true,
            description: true,
            sentAt: true,
            scheduledSendAt: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
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

        return reply.send(updated);
      } catch (error: any) {
        request.log.error({ err: error }, "Error in PUT /:id/rfp/announcements/:announcementId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  fastify.delete<{
    Params: { id: string; announcementId: string };
  }>(
    "/:id/rfp/announcements/:announcementId",
    {
      preHandler: [authenticate],
      schema: {
        description: "Delete announcement",
        tags: ["rfp"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "announcementId"],
          properties: {
            id: { type: "string", description: "Project ID" },
            announcementId: { type: "string", description: "Announcement ID" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          500: { type: "object", properties: { error: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const projectId = request.params.id;
        const announcementId = request.params.announcementId;
        await verifyProjectAccess(request, reply);
        if (reply.sent) return;

        const rfp = await db.rFP.findUnique({
          where: { projectId },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        const announcement = await db.rFPAnnouncement.findUnique({
          where: { id: announcementId },
        });

        if (!announcement || announcement.rfpId !== rfp.id) {
          return reply.status(404).send({ error: "Announcement not found" });
        }

        await db.rFPAnnouncement.delete({
          where: { id: announcementId },
        });

        return reply.send({ success: true });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in DELETE /:id/rfp/announcements/:announcementId");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );
}

