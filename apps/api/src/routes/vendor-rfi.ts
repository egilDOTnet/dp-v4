import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { syncVendorStatusFromRFIStatus } from "../utils/rfi-utils";

// Helper to validate magic link token
async function validateMagicLinkToken(
  fastify: FastifyInstance,
  token: string
): Promise<{ vendorResponse: any; rfi: any; project: any; vendor: any } | null> {
  try {
    // Verify JWT token
    let decoded: { vendorResponseId?: string; type?: string };
    try {
      decoded = fastify.jwt.verify(token) as { vendorResponseId?: string; type?: string };
    } catch {
      return null; // Invalid or expired token
    }
    
    if (!decoded || decoded.type !== "rfi-vendor" || !decoded.vendorResponseId) {
      return null;
    }

    const dbAny = db as any;
    
    // Get vendor response with token check
    const vendorResponse = await dbAny.rFIVendorResponse.findUnique({
      where: { id: decoded.vendorResponseId },
      select: {
        id: true,
        rfiId: true,
        projectVendorId: true,
        contactPersonId: true,
        status: true,
        sentAt: true,
        answeredAt: true,
        magicLinkToken: true,
        tokenExpiresAt: true,
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
      },
    });

    if (!vendorResponse || vendorResponse.magicLinkToken !== token) {
      return null;
    }

    // Check token expiration
    if (vendorResponse.tokenExpiresAt && new Date(vendorResponse.tokenExpiresAt) < new Date()) {
      return null;
    }

    // Get RFI
    const rfi = await db.rFI.findUnique({
      where: { id: vendorResponse.rfiId },
      select: {
        id: true,
        projectId: true,
        emailSubject: true,
        emailText: true,
        rfiInformation: true,
        deadline: true,
        isPublished: true,
        publishedAt: true,
        unpublishedAt: true,
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
            options: {
              select: {
                id: true,
                questionId: true,
                label: true,
                value: true,
                xAxis: true,
                yAxis: true,
                order: true,
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!rfi) {
      return null;
    }

    // Get project
    const project = await db.project.findUnique({
      where: { id: rfi.projectId },
      select: {
        id: true,
        name: true,
        type: true,
        logoData: true,
        logoFileName: true,
        logoFileType: true,
        logoShape: true,
        logoPlacement: true,
        logoBorder: true,
        bannerData: true,
        bannerFileName: true,
        bannerFileType: true,
      },
    });

    if (!project) {
      return null;
    }

    return {
      vendorResponse,
      rfi,
      project,
      vendor: vendorResponse.projectVendor.vendor,
    };
  } catch {
    return null;
  }
}

export default async function vendorRFIRoutes(fastify: FastifyInstance) {
  /**
   * Catch-all route for vendor RFI endpoints
   * Handles all /vendor/rfi/* requests and parses the path manually
   * because Fastify requires wildcards to be at the end
   */
  fastify.all<{
    Params: { "*": string };
  }>(
    "/vendor/rfi/*",
    {
      schema: {
        description: "Vendor RFI endpoints - handles token-based access to RFI data, responses, and contacts",
        tags: ["vendor-rfi"],
        params: {
          type: "object",
          properties: {
            "*": {
              type: "string",
              description: "Path including token and optional endpoint (e.g., 'token' or 'token/response')",
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { "*": string } }>, reply: FastifyReply) => {
      try {
        const pathParam = request.params["*"] || "";
        const method = request.method;
        const decodedPath = decodeURIComponent(pathParam);
        
        // Parse the path to extract token and endpoint
        // Paths can be:
        // - "token" -> GET main RFI data
        // - "token/response" -> GET existing response or POST submit response
        // - "token/answers" -> PUT save answers incrementally
        // - "token/contacts" -> GET list contacts or POST create contact
        
        let token = decodedPath;
        let endpoint = "";
        
        // Check for endpoints in order of specificity
        // Check /answers first (most specific)
        if (decodedPath.includes("/answers")) {
          const parts = decodedPath.split("/answers");
          token = parts[0];
          endpoint = "answers";
        } else if (decodedPath.includes("/response")) {
          const parts = decodedPath.split("/response");
          token = parts[0];
          endpoint = "response";
        } else if (decodedPath.includes("/contacts")) {
          const parts = decodedPath.split("/contacts");
          token = parts[0];
          endpoint = "contacts";
        }
        
        // Log for debugging
        if (method === "PUT") {
          request.log.info({ 
            decodedPath, 
            token: token.substring(0, 30) + "...", 
            endpoint, 
            method 
          }, "Parsed vendor RFI path");
        }

        // Validate token
        const validation = await validateMagicLinkToken(fastify, token);
        if (!validation) {
          return reply.status(404).send({ error: "Invalid or expired token" });
        }

        const { vendorResponse, rfi, project, vendor } = validation;

        // Handle GET /vendor/rfi/token/response
        if (method === "GET" && endpoint === "response") {
          // Get all responses
          const dbAny = db as any;
          const responses = await dbAny.rFIResponse.findMany({
            where: { vendorResponseId: vendorResponse.id },
            select: {
              id: true,
              questionId: true,
              answer: true,
            },
          });

          // Get contact person
          const contactPerson = await db.vendorContactPerson.findUnique({
            where: { id: vendorResponse.contactPersonId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          });

          return reply.send({
            answers: responses.reduce((acc: any, r: any) => {
              acc[r.questionId] = r.answer;
              return acc;
            }, {}),
            contactPerson,
          });
        }

        // Handle PUT /vendor/rfi/token/answers (save answers incrementally)
        if (method === "PUT" && endpoint === "answers") {
          request.log.info({ 
            method, 
            endpoint, 
            token: token.substring(0, 20) + "...",
            vendorResponseId: vendorResponse.id,
            currentStatus: vendorResponse.status
          }, "PUT /vendor/rfi/token/answers called");
          
          const { answers: answersData } = request.body as {
            answers: Record<string, any>;
          };

          // Check RFI status - allow preview mode (unpublished RFIs) for testing
          // Preview tokens are only generated for project members, so this is safe
          if (!rfi.isPublished) {
            // Allow preview mode - don't block unpublished RFIs
            // This enables preview functionality for project members
          } else if (rfi.deadline && new Date(rfi.deadline) < new Date()) {
            return reply.status(403).send({
              error: "This RFI is now closed for replies",
            });
          }

          const dbAny = db as any;

          // Update status to "Started" if not already "Answered" or "Started"
          if (vendorResponse.status !== "Answered" && vendorResponse.status !== "Started") {
            try {
              request.log.info({ 
                vendorResponseId: vendorResponse.id,
                oldStatus: vendorResponse.status,
                newStatus: "Started"
              }, "Updating vendor response status to Started");
              
              await dbAny.rFIVendorResponse.update({
                where: { id: vendorResponse.id },
                data: { status: "Started" },
              });
              
              request.log.info({ vendorResponseId: vendorResponse.id }, "Status updated to Started successfully");
              
              // Sync vendor status from RFI status
              await syncVendorStatusFromRFIStatus("Started", vendorResponse.projectVendorId);
            } catch (error: any) {
              request.log.error({ 
                err: error,
                vendorResponseId: vendorResponse.id,
                errorMessage: error.message,
                errorCode: error.code
              }, "Error updating vendor response status to Started");
              // Continue anyway - don't fail the request if status update fails
            }
          } else {
            request.log.info({ 
              vendorResponseId: vendorResponse.id,
              currentStatus: vendorResponse.status
            }, "Status not updated - already Answered or Started");
          }

          // Save or update answers
          for (const [questionId, answer] of Object.entries(answersData)) {
            const existingResponse = await dbAny.rFIResponse.findFirst({
              where: {
                vendorResponseId: vendorResponse.id,
                questionId,
              },
            });

            if (existingResponse) {
              await dbAny.rFIResponse.update({
                where: { id: existingResponse.id },
                data: {
                  answer: answer as any,
                },
              });
            } else {
              await dbAny.rFIResponse.create({
                data: {
                  vendorResponseId: vendorResponse.id,
                  questionId,
                  answer: answer as any,
                },
              });
            }
          }

          return reply.send({ success: true });
        }

        // Handle POST /vendor/rfi/token/response
        if (method === "POST" && endpoint === "response") {
          const { answers, contactPerson: contactPersonData } = request.body as {
            answers: Record<string, any>;
            contactPerson: {
              firstName: string;
              lastName: string;
              email: string;
              phone?: string | null;
            };
          };

          // Check RFI status - allow preview mode (unpublished RFIs) for testing
          // Preview tokens are only generated for project members, so this is safe
          if (!rfi.isPublished) {
            // Allow preview mode - don't block unpublished RFIs
            // This enables preview functionality for project members
          } else if (rfi.deadline && new Date(rfi.deadline) < new Date()) {
            return reply.status(403).send({
              error: "This RFI is now closed for replies",
            });
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contactPersonData.email)) {
            return reply.status(400).send({ error: "Invalid email format" });
          }

          const dbAny = db as any;

          // Get project vendor to find vendor ID
          const projectVendor = await db.projectVendor.findUnique({
            where: { id: vendorResponse.projectVendorId },
            select: { vendorId: true },
          });

          if (!projectVendor) {
            return reply.status(404).send({ error: "Vendor not found" });
          }

          // Handle contact person - email is unique identifier
          let contactPersonRecord = await db.vendorContactPerson.findFirst({
            where: {
              vendorId: projectVendor.vendorId,
              email: contactPersonData.email,
            },
          });

          if (contactPersonRecord) {
            // Update existing contact
            contactPersonRecord = await db.vendorContactPerson.update({
              where: { id: contactPersonRecord.id },
              data: {
                firstName: contactPersonData.firstName,
                lastName: contactPersonData.lastName,
                phone: contactPersonData.phone || null,
                isMainContact: true,
              },
            });
          } else {
            // Create new contact
            await db.vendorContactPerson.updateMany({
              where: {
                vendorId: projectVendor.vendorId,
                isMainContact: true,
              },
              data: {
                isMainContact: false,
              },
            });

            contactPersonRecord = await db.vendorContactPerson.create({
              data: {
                vendorId: projectVendor.vendorId,
                firstName: contactPersonData.firstName,
                lastName: contactPersonData.lastName,
                email: contactPersonData.email,
                phone: contactPersonData.phone || null,
                isMainContact: true,
              },
            });
          }

          // Update vendor response with new contact person
          await dbAny.rFIVendorResponse.update({
            where: { id: vendorResponse.id },
            data: {
              contactPersonId: contactPersonRecord.id,
              status: "Answered",
              answeredAt: new Date(),
            },
          });

          // Sync vendor status from RFI status
          await syncVendorStatusFromRFIStatus("Answered", vendorResponse.projectVendorId);

          // Save or update answers
          for (const [questionId, answer] of Object.entries(answers)) {
            const existingResponse = await dbAny.rFIResponse.findFirst({
              where: {
                vendorResponseId: vendorResponse.id,
                questionId,
              },
            });

            if (existingResponse) {
              await dbAny.rFIResponse.update({
                where: { id: existingResponse.id },
                data: {
                  answer: answer as any,
                },
              });
            } else {
              await dbAny.rFIResponse.create({
                data: {
                  vendorResponseId: vendorResponse.id,
                  questionId,
                  answer: answer as any,
                },
              });
            }
          }

          return reply.send({ success: true });
        }

        // Handle GET /vendor/rfi/token/contacts
        if (method === "GET" && endpoint === "contacts") {
          // Get project vendor to find vendor ID
          const projectVendor = await db.projectVendor.findUnique({
            where: { id: vendorResponse.projectVendorId },
            select: { vendorId: true },
          });

          if (!projectVendor) {
            return reply.status(404).send({ error: "Vendor not found" });
          }

          // Get all contacts for this vendor
          const contacts = await db.vendorContactPerson.findMany({
            where: { vendorId: projectVendor.vendorId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              isMainContact: true,
            },
            orderBy: [
              { isMainContact: "desc" },
              { createdAt: "desc" },
            ],
          });

          return reply.send(contacts);
        }

        // Handle POST /vendor/rfi/token/contacts
        if (method === "POST" && endpoint === "contacts") {
          const { firstName, lastName, email, phone } = request.body as {
            firstName: string;
            lastName: string;
            email: string;
            phone?: string | null;
          };

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            return reply.status(400).send({ error: "Invalid email format" });
          }

          // Get project vendor to find vendor ID
          const projectVendor = await db.projectVendor.findUnique({
            where: { id: vendorResponse.projectVendorId },
            select: { vendorId: true },
          });

          if (!projectVendor) {
            return reply.status(404).send({ error: "Vendor not found" });
          }

          // Check if contact with this email already exists
          let contact = await db.vendorContactPerson.findFirst({
            where: {
              vendorId: projectVendor.vendorId,
              email,
            },
          });

          if (contact) {
            // Update existing contact
            contact = await db.vendorContactPerson.update({
              where: { id: contact.id },
              data: {
                firstName,
                lastName,
                phone: phone || null,
              },
            });
          } else {
            // Unset other main contacts
            await db.vendorContactPerson.updateMany({
              where: {
                vendorId: projectVendor.vendorId,
                isMainContact: true,
              },
              data: {
                isMainContact: false,
              },
            });

            // Create new contact
            contact = await db.vendorContactPerson.create({
              data: {
                vendorId: projectVendor.vendorId,
                firstName,
                lastName,
                email,
                phone: phone || null,
                isMainContact: true,
              },
            });
          }

          return reply.send({
            id: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            isMainContact: contact.isMainContact,
          });
        }

        // Handle GET /vendor/rfi/token (main endpoint - no endpoint suffix)
        if (method === "GET" && endpoint === "") {
          // Check RFI status - allow preview mode (unpublished RFIs) for testing
          // Preview tokens are only generated for project members, so this is safe
          // Check if deadline has passed (only for published RFIs)
          const deadlinePassed = rfi.isPublished && rfi.deadline && new Date(rfi.deadline) < new Date();

          // Get existing responses if any
          const dbAny = db as any;
          const existingResponses = await dbAny.rFIResponse.findMany({
            where: { vendorResponseId: vendorResponse.id },
            select: {
              id: true,
              questionId: true,
              answer: true,
            },
          });

          // Get contact person
          const contactPerson = await db.vendorContactPerson.findUnique({
            where: { id: vendorResponse.contactPersonId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          });

          return reply.send({
            project,
            rfi,
            vendor,
            vendorResponse: {
              id: vendorResponse.id,
              status: vendorResponse.status,
              answeredAt: vendorResponse.answeredAt,
              sentAt: vendorResponse.sentAt,
            },
            contactPerson,
            existingResponses: existingResponses.reduce((acc: any, r: any) => {
              acc[r.questionId] = r.answer;
              return acc;
            }, {}),
            deadlinePassed,
          });
        }

        // Method not allowed for this endpoint
        return reply.status(405).send({ error: "Method not allowed" });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in vendor RFI route");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );
}

