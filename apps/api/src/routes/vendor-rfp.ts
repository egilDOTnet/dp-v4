import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import { db } from "@dp/db";
import { RFPVendorResponseStatus } from "@prisma/client";
import { authenticateVendorContact, requireMainContact, verifyRFPAccess, VendorContactRequest } from "../middleware/vendor-auth";
import { generateRequirementsPDF } from "../utils/requirements-pdf";
import { generateRequirementsExcel } from "../utils/requirements-excel";
import { detectColumnStructure, parseRequirementsExcelWithMapping, ColumnMapping } from "../utils/rfp-requirements-excel";

// Store magic links in memory (in production, use Redis or database)
const vendorMagicLinks = new Map<string, { email: string; expiresAt: number }>();

interface LoginBody {
  email: string;
  password?: string;
}

interface MagicLinkBody {
  email: string;
}

export default async function vendorRFPRoutes(fastify: FastifyInstance) {
  /**
   * Check if a vendor contact exists and has a password set
   * Used to determine if vendor contact should use password login or magic link
   */
  fastify.post<{ Body: { email: string } }>(
    "/vendor-rfp/auth/check-user",
    {
      schema: {
        description: "Check if a vendor contact exists and has a password set. Used to determine authentication method.",
        tags: ["vendor-rfp"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Vendor contact email address",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              exists: {
                type: "boolean",
                description: "Whether the vendor contact exists in the system",
              },
              hasPassword: {
                type: "boolean",
                description: "Whether the vendor contact has a password set (via User account)",
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      const { email } = request.body;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Email required" });
      }

      // Check if email exists in VendorContactPerson
      const contactPerson = await db.vendorContactPerson.findFirst({
        where: { email },
      });

      if (!contactPerson) {
        return reply.send({
          exists: false,
          hasPassword: false,
        });
      }

      // Check if email also exists in User table with password
      const user = await db.user.findUnique({
        where: { email },
      });

      return reply.send({
        exists: true,
        hasPassword: !!user?.passwordHash,
      });
    }
  );

  /**
   * Authenticate vendor contact with email and password
   * Returns JWT token with vendor contact context
   */
  fastify.post<{ Body: LoginBody }>(
    "/vendor-rfp/auth/login",
    {
      schema: {
        description: "Authenticate vendor contact with email and password. Returns JWT token for subsequent API requests.",
        tags: ["vendor-rfp"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Vendor contact email address",
            },
            password: {
              type: "string",
              description: "User password (required if user has password set)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "JWT authentication token",
              },
              contactPerson: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
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
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Email required" });
      }

      // Find vendor contact person
      const contactPerson = await db.vendorContactPerson.findFirst({
        where: { email },
        include: {
          vendor: true,
        },
      });

      if (!contactPerson) {
        return reply.status(404).send({ error: "Vendor contact not found" });
      }

      // Check if email exists in User table with password
      const user = await db.user.findUnique({
        where: { email },
      });

      // If user has no password, they need to use magic link
      if (!user?.passwordHash) {
        return reply.status(400).send({
          error: "Password not set. Please use magic link to set your password.",
        });
      }

      if (!password) {
        return reply.status(400).send({ error: "Password required" });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: "Invalid password" });
      }

      // Update last logged in timestamp
      await db.user.update({
        where: { id: user.id },
        data: { lastLoggedIn: new Date() },
      });

      // Create JWT token with vendor contact context
      const token = fastify.jwt.sign({
        contactPersonId: contactPerson.id,
        vendorId: contactPerson.vendorId,
        email: contactPerson.email,
        isMainContact: contactPerson.isMainContact,
        type: "vendor-contact",
      });

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
    }
  );

  /**
   * Request a magic link for vendor contact passwordless authentication
   * In development mode, returns the link directly. In production, sends email.
   */
  fastify.post<{ Body: MagicLinkBody }>(
    "/vendor-rfp/auth/magic-link",
    {
      schema: {
        description: "Request a magic link for vendor contact passwordless authentication. In dev mode, returns link in response. In production, sends email.",
        tags: ["vendor-rfp"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Vendor contact email address",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              magicLink: { type: "string", nullable: true, description: "Only in development mode" },
              token: { type: "string", nullable: true, description: "Only in development mode" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
            description: "Vendor contact not found (production mode only)",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: MagicLinkBody }>, reply: FastifyReply) => {
      try {
        const { email } = request.body;

        if (!email || typeof email !== "string") {
          return reply.status(400).send({ error: "Email required" });
        }

        // Check if email exists in VendorContactPerson
        const contactPerson = await db.vendorContactPerson.findFirst({
          where: { email },
        });

        const isProduction = process.env.NODE_ENV === "production";
        const isDev = !isProduction;

        // In production, only allow magic link for existing vendor contacts
        // In dev mode, always allow magic link generation
        if (!contactPerson && isProduction) {
          return reply.status(404).send({ error: "Vendor contact not found" });
        }

        // Generate magic link token
        const token = fastify.jwt.sign({ email, type: "vendor-magic-link" } as any, { expiresIn: "1h" });
        const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

        vendorMagicLinks.set(token, { email, expiresAt });

        // In dev mode, always return the link in the response and log to console
        if (isDev) {
          const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
          const magicLink = `${baseUrl}/portal/magic-link?token=${token}`;
          
          // Log to console in dev mode
          console.log(`\n🔗 Vendor Magic Link for ${email}:`);
          console.log(magicLink);
          console.log(`\nToken: ${token}\n`);
          
          return reply.send({
            message: contactPerson ? "Magic link generated (dev mode)" : "Magic link generated for new vendor contact (dev mode)",
            magicLink,
            token,
          });
        }

        // In production, send email here
        return reply.send({ message: "Magic link sent to your email" });
      } catch (err) {
        fastify.log.error(err);
        throw err;
      }
    }
  );

  /**
   * Verify vendor magic link token and set password
   * Creates User account if doesn't exist, or updates existing user's password
   * Returns JWT token for immediate authentication
   */
  fastify.post<{ Body: { token: string; password: string } }>(
    "/vendor-rfp/auth/set-password",
    {
      schema: {
        description: "Set or update vendor contact password using magic link token. Creates User account if email doesn't exist. Returns JWT token.",
        tags: ["vendor-rfp"],
        body: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: {
              type: "string",
              description: "Magic link token from /vendor-rfp/auth/magic-link",
            },
            password: {
              type: "string",
              minLength: 8,
              description: "New password (minimum 8 characters)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "JWT authentication token",
              },
              contactPerson: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
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
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { token: string; password: string } }>, reply: FastifyReply) => {
      const { token, password } = request.body;

      if (!token || !password) {
        return reply.status(400).send({ error: "Token and password required" });
      }

      if (password.length < 8) {
        return reply.status(400).send({ error: "Password must be at least 8 characters" });
      }

      const magicLink = vendorMagicLinks.get(token);
      if (!magicLink || magicLink.expiresAt < Date.now()) {
        return reply.status(400).send({ error: "Invalid or expired token" });
      }

      try {
        const decoded = fastify.jwt.verify(token) as { email: string; type: string };
        if (decoded.type !== "vendor-magic-link") {
          return reply.status(400).send({ error: "Invalid token type" });
        }

        // Find vendor contact person
        const contactPerson = await db.vendorContactPerson.findFirst({
          where: { email: decoded.email },
          include: {
            vendor: true,
          },
        });

        if (!contactPerson) {
          return reply.status(404).send({ error: "Vendor contact not found" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Find or create user account
        let user = await db.user.findUnique({
          where: { email: decoded.email },
        });

        if (!user) {
          // Create new user account for vendor contact
          user = await db.user.create({
            data: {
              email: decoded.email,
              name: `${contactPerson.firstName} ${contactPerson.lastName}`,
              firstName: contactPerson.firstName,
              lastName: contactPerson.lastName,
              passwordHash,
              role: "Vendor",
            } as any,
          });
        } else {
          // Update existing user's password
          user = await db.user.update({
            where: { id: user.id },
            data: {
              passwordHash,
            },
          });
        }

        // Remove magic link from store
        vendorMagicLinks.delete(token);

        // Update last logged in timestamp (this is their first login when setting password)
        await db.user.update({
          where: { id: user.id },
          data: { lastLoggedIn: new Date() },
        });

        // Create JWT token with vendor contact context
        const jwtToken = fastify.jwt.sign({
          contactPersonId: contactPerson.id,
          vendorId: contactPerson.vendorId,
          email: contactPerson.email,
          isMainContact: contactPerson.isMainContact,
          type: "vendor-contact",
        });

        return reply.send({
          token: jwtToken,
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
      } catch (err) {
        fastify.log.error(err);
        return reply.status(400).send({ error: "Invalid token" });
      }
    }
  );

  /**
   * Get current vendor contact info
   * Returns vendor contact, vendor, and accessible RFPs
   */
  fastify.get(
    "/vendor-rfp/auth/me",
    {
      preHandler: [authenticateVendorContact],
      schema: {
        description: "Get current vendor contact information, vendor details, and accessible RFPs",
        tags: ["vendor-rfp"],
        response: {
          200: {
            type: "object",
            properties: {
              contactPerson: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
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
          401: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: VendorContactRequest, reply: FastifyReply) => {
      try {
        const vendorContact = request.vendorContact;
        if (!vendorContact) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const contactPerson = await db.vendorContactPerson.findUnique({
          where: { id: vendorContact.contactPersonId },
          include: {
            vendor: {
              include: {
                VendorContactPerson: {
                  where: { isMainContact: true },
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (!contactPerson) {
          return reply.status(404).send({ error: "Vendor contact not found" });
        }

        // Get main contact person (first one found, should be only one)
        const mainContact = contactPerson.vendor.VendorContactPerson[0] || null;

        return reply.send({
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
          mainContact: mainContact
            ? {
                id: mainContact.id,
                firstName: mainContact.firstName,
                lastName: mainContact.lastName,
                email: mainContact.email,
              }
            : null,
        });
      } catch (error: any) {
        request.log.error({ err: error, endpoint: "/vendor-rfp/auth/me" }, "Error in GET /vendor-rfp/auth/me");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * List ongoing RFPs for authenticated vendor contact
   * Returns RFPs where vendor is linked to project and RFP is published
   * Also accessible to Company Admins/Regular users (read-only) for their projects
   */
  fastify.get(
    "/vendor-rfp/rfps",
    {
      preHandler: [authenticateVendorContact],
      schema: {
        description: "List ongoing RFPs for authenticated vendor contact. Also accessible to Company users for their projects.",
        tags: ["vendor-rfp"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                projectId: { type: "string" },
                project: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    logoData: { type: "string", nullable: true },
                    logoFileName: { type: "string", nullable: true },
                    logoFileType: { type: "string", nullable: true },
                    logoShape: { type: "string", nullable: true },
                    logoPlacement: { type: "string", nullable: true },
                    logoBorder: { type: "string", nullable: true },
                    bannerData: { type: "string", nullable: true },
                    bannerFileName: { type: "string", nullable: true },
                    bannerFileType: { type: "string", nullable: true },
                  },
                },
                about: { type: "string", nullable: true },
                deliveryDate: { type: "string", nullable: true },
                scheduleItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      date: { type: "string", nullable: true },
                    },
                  },
                },
                vendorResponse: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    status: { type: "string" },
                    participatedAt: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: VendorContactRequest, reply: FastifyReply) => {
      try {
        const vendorContact = request.vendorContact;
        if (!vendorContact) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const now = new Date();

        // Get RFPs where:
        // 1. Vendor is linked to project via ProjectVendor
        // 2. RFP status is Published
        // 3. Current date is before delivery date (ongoing)
        const projectVendors = await db.projectVendor.findMany({
          where: {
            vendorId: vendorContact.vendorId,
          },
          include: {
            project: {
              include: {
                RFP: {
                  include: {
                    scheduleItems: {
                      where: {
                        type: { in: ["StartDate", "AcceptanceDate", "QuestionsDate", "DeliveryDate"] },
                      },
                      orderBy: { order: "asc" },
                    },
                    vendorResponses: true,
                  },
                },
              },
            },
          },
        });

        // Flatten and format RFPs
        // Note: RFP is a one-to-one relationship, so pv.project.RFP is a single object or null
        const rfps = projectVendors
          .flatMap((pv) => {
            const rfp = pv.project.RFP;
            
            // Filter: RFP must exist, be Published, and delivery date must be in the future
            if (!rfp || rfp.status !== "Published" || !rfp.deliveryDate || rfp.deliveryDate <= now) {
              return [];
            }

            const vendorResponse = rfp.vendorResponses.find(
              (vr) => vr.projectVendorId === pv.id
            );

            return {
              id: rfp.id,
              projectId: rfp.projectId,
              project: {
                id: pv.project.id,
                name: pv.project.name,
                logoData: pv.project.logoData,
                logoFileName: pv.project.logoFileName,
                logoFileType: pv.project.logoFileType,
                logoShape: pv.project.logoShape,
                logoPlacement: pv.project.logoPlacement,
                logoBorder: pv.project.logoBorder,
                bannerData: pv.project.bannerData,
                bannerFileName: pv.project.bannerFileName,
                bannerFileType: pv.project.bannerFileType,
              },
              about: rfp.about,
              deliveryDate: rfp.deliveryDate?.toISOString() || null,
              scheduleItems: rfp.scheduleItems.map((item) => ({
                type: item.type,
                date: item.date?.toISOString() || null,
              })),
              vendorResponse: vendorResponse
                ? {
                    id: vendorResponse.id,
                    status: vendorResponse.status,
                    participatedAt: vendorResponse.participatedAt?.toISOString() || null,
                  }
                : null,
            };
          })
          .filter((rfp) => rfp !== null);

        return reply.send(rfps);
      } catch (error: any) {
        request.log.error({ err: error, endpoint: "/vendor-rfp/rfps" }, "Error in GET /vendor-rfp/rfps");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get RFP details in preview mode (read-only)
   * Uses preview token for company users to view RFP before publishing
   */
  fastify.get<{ Params: { rfpId: string }; Querystring: { token?: string } }>(
    "/vendor-rfp/rfps/:rfpId/preview",
    {
      schema: {
        description: "Get RFP details in preview mode using preview token. Read-only access for company users.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        querystring: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Preview token",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              projectId: { type: "string" },
              project: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  logoData: { type: "string", nullable: true },
                  logoFileName: { type: "string", nullable: true },
                  logoFileType: { type: "string", nullable: true },
                  logoShape: { type: "string", nullable: true },
                  logoPlacement: { type: "string", nullable: true },
                  logoBorder: { type: "string", nullable: true },
                  bannerData: { type: "string", nullable: true },
                  bannerFileName: { type: "string", nullable: true },
                  bannerFileType: { type: "string", nullable: true },
                },
              },
              about: { type: "string", nullable: true },
              deliveryDate: { type: "string", nullable: true },
              scheduleItems: { type: "array" },
              documents: { type: "array" },
              changelogEntries: { type: "array" },
              questions: { type: "array" },
              vendorResponse: { type: "object", nullable: true },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string }; Querystring: { token?: string } }>, reply: FastifyReply) => {
      try {
        const { rfpId } = request.params;
        const { token } = request.query;

        if (!token) {
          return reply.status(400).send({ error: "Preview token required" });
        }

        // Verify preview token
        let decoded: { userId?: string; projectId?: string; rfpId?: string; type?: string };
        try {
          decoded = fastify.jwt.verify(token) as any;
        } catch {
          return reply.status(401).send({ error: "Invalid or expired preview token" });
        }

        if (!decoded || decoded.type !== "rfp-preview") {
          return reply.status(401).send({ error: "Invalid token type" });
        }

        if (decoded.rfpId !== rfpId) {
          return reply.status(403).send({ error: "Token does not match RFP ID" });
        }

        // Verify user has access to the project
        const user = await db.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user) {
          return reply.status(401).send({ error: "User not found" });
        }

        // Get RFP
        const rfp = await db.rFP.findUnique({
          where: { id: rfpId },
          include: {
            project: true,
            scheduleItems: {
              orderBy: { order: "asc" },
            },
            documents: {
              orderBy: { order: "asc" },
            },
            changelogEntries: {
              orderBy: { createdAt: "desc" },
              include: {
                createdBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
            questions: {
              orderBy: { createdAt: "desc" },
              include: {
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
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Verify user has access to this project
        const project = await db.project.findUnique({
          where: { id: rfp.projectId },
          include: { ProjectMember: true },
        });

        if (!project) {
          return reply.status(404).send({ error: "Project not found" });
        }

        const isMember = project.ProjectMember.some((pm) => pm.userId === user.id);
        const isAdmin =
          (user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator") &&
          user.tenantId === project.tenantId;

        if (!isMember && !isAdmin) {
          return reply.status(403).send({ error: "Access denied" });
        }

        // Return RFP data (read-only, no vendor response)
        return reply.send({
          id: rfp.id,
          projectId: rfp.projectId,
          project: {
            id: project.id,
            name: project.name,
            logoData: project.logoData,
            logoFileName: project.logoFileName,
            logoFileType: project.logoFileType,
            logoShape: project.logoShape,
            logoPlacement: project.logoPlacement,
            logoBorder: project.logoBorder,
            bannerData: project.bannerData,
            bannerFileName: project.bannerFileName,
            bannerFileType: project.bannerFileType,
          },
          about: rfp.about,
          deliveryDate: rfp.deliveryDate?.toISOString() || null,
          scheduleItems: rfp.scheduleItems.map((item) => ({
            id: item.id,
            type: item.type,
            description: item.description,
            date: item.date?.toISOString() || null,
            fromDate: item.fromDate?.toISOString() || null,
            toDate: item.toDate?.toISOString() || null,
            order: item.order,
            isRequired: item.isRequired,
          })),
          documents: rfp.documents.map((doc) => ({
            id: doc.id,
            type: doc.type,
            description: doc.description,
            url: doc.url,
            fileName: doc.fileName,
            fileData: doc.fileData,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            order: doc.order,
          })),
          changelogEntries: rfp.changelogEntries.map((entry) => ({
            id: entry.id,
            description: entry.description,
            createdAt: entry.createdAt.toISOString(),
            createdBy: entry.createdBy
              ? {
                  id: entry.createdBy.id,
                  name: entry.createdBy.name,
                  email: entry.createdBy.email,
                }
              : null,
          })),
          questions: rfp.questions.map((q) => ({
            id: q.id,
            question: q.question,
            cleanedQuestion: q.cleanedQuestion,
            answer: q.answer,
            createdAt: q.createdAt.toISOString(),
            answeredAt: q.answeredAt?.toISOString() || null,
            vendor: q.vendor
              ? {
                  id: q.vendor.id,
                  name: q.vendor.name,
                }
              : null,
            contactPerson: q.contactPerson
              ? {
                  id: q.contactPerson.id,
                  firstName: q.contactPerson.firstName,
                  lastName: q.contactPerson.lastName,
                  email: q.contactPerson.email,
                }
              : null,
            answeredBy: q.answeredBy
              ? {
                  id: q.answeredBy.id,
                  name: q.answeredBy.name,
                  email: q.answeredBy.email,
                }
              : null,
          })),
          vendorResponse: null, // No vendor response in preview mode
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error in GET /vendor-rfp/rfps/:rfpId/preview");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Get RFP details
   * Returns full RFP data including schedule, documents, changelog, questions
   * Includes vendor response status if exists
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Get RFP details including schedule, documents, changelog, and questions",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              projectId: { type: "string" },
              project: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  logoData: { type: "string", nullable: true },
                  logoFileName: { type: "string", nullable: true },
                  logoFileType: { type: "string", nullable: true },
                  bannerData: { type: "string", nullable: true },
                  bannerFileName: { type: "string", nullable: true },
                  bannerFileType: { type: "string", nullable: true },
                },
              },
              about: { type: "string", nullable: true },
              deliveryDate: { type: "string", nullable: true },
              scheduleItems: { type: "array" },
              documents: { type: "array" },
              changelogEntries: { type: "array" },
              questions: { type: "array" },
              vendorResponse: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  status: { type: "string" },
                  participatedAt: { type: "string", nullable: true },
                  proposalSubmittedAt: { type: "string", nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get full RFP data
      const fullRfp = await db.rFP.findUnique({
        where: { id: rfp.id },
        include: {
          project: true,
          scheduleItems: {
            orderBy: { order: "asc" },
          },
          documents: {
            orderBy: { order: "asc" },
          },
          changelogEntries: {
            orderBy: { createdAt: "desc" },
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          questions: {
            where: {
              OR: [
                // All answered questions (from any vendor)
                {
                  AND: [
                    { answer: { not: null } },
                    { answeredAt: { not: null } },
                  ],
                },
                // Unanswered questions from this vendor
                { 
                  vendorId: vendorContact.vendorId,
                  OR: [
                    { answer: null },
                    { answeredAt: null },
                  ],
                },
              ],
            },
            orderBy: { createdAt: "desc" },
            include: {
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
                  name: true,
                  email: true,
                },
              },
            },
          },
          vendorResponses: {
            where: {
              projectVendor: {
                vendorId: vendorContact.vendorId,
              },
            },
            include: {
              proposalFiles: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      });

      if (!fullRfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      const vendorResponse = fullRfp.vendorResponses[0] || null;

      return reply.send({
        id: fullRfp.id,
        projectId: fullRfp.projectId,
        project: {
          id: fullRfp.project.id,
          name: fullRfp.project.name,
          logoData: fullRfp.project.logoData,
          logoFileName: fullRfp.project.logoFileName,
          logoFileType: fullRfp.project.logoFileType,
          logoShape: fullRfp.project.logoShape,
          logoPlacement: fullRfp.project.logoPlacement,
          logoBorder: fullRfp.project.logoBorder,
          bannerData: fullRfp.project.bannerData,
          bannerFileName: fullRfp.project.bannerFileName,
          bannerFileType: fullRfp.project.bannerFileType,
        },
        about: fullRfp.about,
        deliveryDate: fullRfp.deliveryDate?.toISOString() || null,
        scheduleItems: fullRfp.scheduleItems.map((item) => ({
          id: item.id,
          type: item.type,
          description: item.description,
          date: item.date?.toISOString() || null,
          fromDate: item.fromDate?.toISOString() || null,
          toDate: item.toDate?.toISOString() || null,
          order: item.order,
          isRequired: item.isRequired,
        })),
        documents: fullRfp.documents.map((doc) => ({
          id: doc.id,
          type: doc.type,
          description: doc.description,
          fileName: doc.fileName,
          fileData: doc.fileData,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          url: doc.url,
          order: doc.order,
        })),
        changelogEntries: fullRfp.changelogEntries.map((entry) => ({
          id: entry.id,
          description: entry.description,
          createdAt: entry.createdAt.toISOString(),
          createdBy: entry.createdBy
            ? {
                id: entry.createdBy.id,
                name: entry.createdBy.name,
                email: entry.createdBy.email,
              }
            : null,
        })),
        questions: fullRfp.questions.map((q) => ({
          id: q.id,
          question: q.question,
          cleanedQuestion: q.cleanedQuestion,
          answer: q.answer,
          answeredAt: q.answeredAt?.toISOString() || null,
          createdAt: q.createdAt.toISOString(),
          vendor: {
            id: q.vendor.id,
            name: q.vendor.name,
          },
          contactPerson: {
            id: q.contactPerson.id,
            firstName: q.contactPerson.firstName,
            lastName: q.contactPerson.lastName,
            email: q.contactPerson.email,
          },
          answeredBy: q.answeredBy
            ? {
                id: q.answeredBy.id,
                name: q.answeredBy.name,
                email: q.answeredBy.email,
              }
            : null,
        })),
        vendorResponse: vendorResponse
          ? {
              id: vendorResponse.id,
              status: vendorResponse.status,
              participatedAt: vendorResponse.participatedAt?.toISOString() || null,
              proposalSubmittedAt: vendorResponse.proposalSubmittedAt?.toISOString() || null,
              declineNote: vendorResponse.declineNote || null,
              hasProposalChanges: vendorResponse.hasProposalChanges,
              proposalFiles: vendorResponse.proposalFiles.map((file) => ({
                id: file.id,
                fileName: file.fileName,
                fileType: file.fileType,
                fileSize: file.fileSize,
                order: file.order,
              })),
            }
          : null,
      });
    }
  );

  /**
   * Vendor agrees to participate in RFP
   * Only allowed for main contact
   * Creates or updates RFPVendorResponse with status Participating
   */
  fastify.post<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/participate",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess, requireMainContact()],
      schema: {
        description: "Vendor agrees to participate in RFP. Only allowed for main contact.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              participatedAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Check participation deadline (AcceptanceDate)
      const acceptanceDateItem = await db.rFPScheduleItem.findFirst({
        where: {
          rfpId: rfp.id,
          type: "AcceptanceDate",
        },
      });

      if (acceptanceDateItem?.date) {
        const now = new Date();
        if (now > acceptanceDateItem.date) {
          return reply.status(400).send({ error: "Participation deadline has passed" });
        }
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Create or update vendor response
      const vendorResponse = await db.rFPVendorResponse.upsert({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
        create: {
          rfpId: rfp.id,
          projectVendorId: projectVendor.id,
          contactPersonId: vendorContact.contactPersonId,
          status: RFPVendorResponseStatus.Participating,
          participatedAt: new Date(),
        },
        update: {
          status: RFPVendorResponseStatus.Participating,
          participatedAt: new Date(),
        },
      });

      return reply.send({
        id: vendorResponse.id,
        status: vendorResponse.status,
        participatedAt: vendorResponse.participatedAt?.toISOString() || null,
      });
    }
  );

  /**
   * Vendor declines to participate in RFP
   * Only allowed for main contact
   * Updates RFPVendorResponse with status Declined and optional note
   */
  fastify.post<{ Params: { rfpId: string }; Body: { note?: string } }>(
    "/vendor-rfp/rfps/:rfpId/decline",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess, requireMainContact()],
      schema: {
        description: "Vendor declines to participate in RFP. Only allowed for main contact.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            note: {
              type: "string",
              description: "Optional note explaining why vendor won't participate",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string }; Body: { note?: string } }>, reply: FastifyReply) => {
      try {
        const vendorContact = (request as VendorContactRequest).vendorContact;
        if (!vendorContact) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const rfp = (request as any).rfp;
        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get project vendor
        const projectVendor = await db.projectVendor.findFirst({
          where: {
            projectId: rfp.projectId,
            vendorId: vendorContact.vendorId,
          },
        });

        if (!projectVendor) {
          return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
        }

        // Create or update vendor response with Declined status
        const vendorResponse = await db.rFPVendorResponse.upsert({
          where: {
            rfpId_projectVendorId: {
              rfpId: rfp.id,
              projectVendorId: projectVendor.id,
            },
          },
          create: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
            contactPersonId: vendorContact.contactPersonId,
            status: RFPVendorResponseStatus.Declined,
            declineNote: request.body.note || null,
          },
          update: {
            status: RFPVendorResponseStatus.Declined,
            declineNote: request.body.note || null,
          },
        });

        return reply.send({
          id: vendorResponse.id,
          status: vendorResponse.status,
        });
      } catch (error: any) {
        request.log.error({ err: error, endpoint: "/vendor-rfp/rfps/:rfpId/decline" }, "Error in POST /vendor-rfp/rfps/:rfpId/decline");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred",
        });
      }
    }
  );

  /**
   * Submit a question for RFP
   * Creates RFPQuestion with vendor and contact person info
   */
  fastify.post<{ Params: { rfpId: string }; Body: { question: string } }>(
    "/vendor-rfp/rfps/:rfpId/questions",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Submit a question for RFP",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: {
              type: "string",
              description: "Question text",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              question: { type: "string" },
              createdAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string }; Body: { question: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      const { question } = request.body;

      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return reply.status(400).send({ error: "Question is required" });
      }

      // Get RFP with contact persons to determine who to notify
      const rfpWithContacts = await db.rFP.findUnique({
        where: { id: rfp.id },
        select: {
          id: true,
          contactPersonId: true,
          alternativeContactPersonId: true,
        },
      });

      // Create question
      const rfpQuestion = await db.rFPQuestion.create({
        data: {
          rfpId: rfp.id,
          vendorId: vendorContact.vendorId,
          contactPersonId: vendorContact.contactPersonId,
          question: question.trim(),
        },
      });

      // Create notifications for main contact and alternative contact only
      try {
        const userIdsToNotify: string[] = [];
        
        if (rfpWithContacts?.contactPersonId) {
          userIdsToNotify.push(rfpWithContacts.contactPersonId);
        }
        
        if (rfpWithContacts?.alternativeContactPersonId) {
          userIdsToNotify.push(rfpWithContacts.alternativeContactPersonId);
        }

        // Remove duplicates
        const uniqueUserIds = Array.from(new Set(userIdsToNotify));

        const notificationPromises = uniqueUserIds.map((userId) =>
          db.notification.create({
            data: {
              userId,
              type: "RFP_QUESTION",
              rfpQuestionId: rfpQuestion.id,
            },
          }).catch((err: any) => {
            request.log.error({ err, userId }, "Failed to create notification for RFP question");
            return null;
          })
        );

        await Promise.all(notificationPromises);
        request.log.info({ questionId: rfpQuestion.id, userIds: uniqueUserIds }, "Created notifications for RFP question");

        // Schedule email notifications for 15 minutes later
        // We'll create a pending email notification record that the scheduler will process
        const emailNotificationPromises = uniqueUserIds.map((userId) =>
          db.pendingEmailNotification.create({
            data: {
              userId,
              rfpQuestionId: rfpQuestion.id,
              scheduledFor: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
            },
          }).catch((err: any) => {
            request.log.error({ err, userId }, "Failed to schedule email notification for RFP question");
            return null;
          })
        );

        await Promise.all(emailNotificationPromises);
        request.log.info({ questionId: rfpQuestion.id, userIds: uniqueUserIds }, "Scheduled email notifications for RFP question");
      } catch (notificationError: any) {
        // Log error but don't fail the request if notification creation fails
        request.log.error({ err: notificationError, questionId: rfpQuestion.id }, "Error creating notifications for RFP question");
      }

      return reply.send({
        id: rfpQuestion.id,
        question: rfpQuestion.question,
        createdAt: rfpQuestion.createdAt.toISOString(),
      });
    }
  );

  /**
   * Get questions and answers for RFP
   * Returns all questions for this RFP with answers
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/questions",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Get questions and answers for RFP",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
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
                question: { type: "string" },
                cleanedQuestion: { type: "string", nullable: true },
                answer: { type: "string", nullable: true },
                answeredAt: { type: "string", nullable: true },
                createdAt: { type: "string" },
                vendor: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                  },
                },
                contactPerson: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    email: { type: "string" },
                  },
                },
                answeredBy: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Return ALL answered questions (from any vendor) AND unanswered questions from this vendor
      const questions = await db.rFPQuestion.findMany({
        where: { 
          rfpId: rfp.id,
          OR: [
            // All answered questions (from any vendor)
            {
              AND: [
                { answer: { not: null } },
                { answeredAt: { not: null } },
              ],
            },
            // Unanswered questions from this vendor
            { 
              vendorId: vendorContact.vendorId,
              OR: [
                { answer: null },
                { answeredAt: null },
              ],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
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
              name: true,
              email: true,
            },
          },
        },
      });

      return reply.send(
        questions.map((q) => ({
          id: q.id,
          question: q.question,
          cleanedQuestion: q.cleanedQuestion,
          answer: q.answer,
          answeredAt: q.answeredAt?.toISOString() || null,
          createdAt: q.createdAt.toISOString(),
          vendor: {
            id: q.vendor.id,
            name: q.vendor.name,
          },
          contactPerson: {
            id: q.contactPerson.id,
            firstName: q.contactPerson.firstName,
            lastName: q.contactPerson.lastName,
            email: q.contactPerson.email,
          },
          answeredBy: q.answeredBy
            ? {
                id: q.answeredBy.id,
                name: q.answeredBy.name,
                email: q.answeredBy.email,
              }
            : null,
        }))
      );
    }
  );

  /**
   * Get proposal files for RFP
   * Returns list of uploaded proposal files
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Get proposal files for RFP",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
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
                fileName: { type: "string" },
                fileType: { type: "string" },
                fileSize: { type: "number" },
                order: { type: "number" },
                createdAt: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get vendor response
      const vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
        include: {
          proposalFiles: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!vendorResponse) {
        return reply.send([]);
      }

      return reply.send(
        vendorResponse.proposalFiles.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          order: file.order,
          createdAt: file.createdAt.toISOString(),
        }))
      );
    }
  );

  /**
   * Upload proposal file
   * Accepts multipart/form-data
   * Creates RFPProposalFile record
   */
  fastify.post<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal/files",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Upload proposal file",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        consumes: ["multipart/form-data"],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              fileName: { type: "string" },
              fileType: { type: "string" },
              fileSize: { type: "number" },
              order: { type: "number" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get or create vendor response
      let vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
        include: {
          proposalFiles: true,
        },
      });

      if (!vendorResponse) {
        // Create vendor response if it doesn't exist
        vendorResponse = await db.rFPVendorResponse.create({
          data: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
            contactPersonId: vendorContact.contactPersonId,
            status: RFPVendorResponseStatus.Participating,
          },
          include: {
            proposalFiles: true,
          },
        });
      }

      // Parse multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "File is required" });
      }

      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (data.file.bytesRead > maxSize) {
        return reply.status(400).send({ error: "File size exceeds maximum allowed size (10MB)" });
      }

      // Read file data
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      const fileData = fileBuffer.toString("base64");

      // Get next order number
      const nextOrder = vendorResponse.proposalFiles.length;

      // Create proposal file
      const proposalFile = await db.rFPProposalFile.create({
        data: {
          vendorResponseId: vendorResponse.id,
          fileName: data.filename || "untitled",
          fileType: data.mimetype || "application/octet-stream",
          fileData,
          fileSize: fileBuffer.length,
          order: nextOrder,
        },
      });

      // Mark proposal as having changes
      await db.rFPVendorResponse.update({
        where: { id: vendorResponse.id },
        data: { hasProposalChanges: true },
      });

      return reply.send({
        id: proposalFile.id,
        fileName: proposalFile.fileName,
        fileType: proposalFile.fileType,
        fileSize: proposalFile.fileSize,
        order: proposalFile.order,
      });
    }
  );

  /**
   * Update proposal file name
   * Allows renaming uploaded files
   */
  fastify.put<{ Params: { rfpId: string; fileId: string }; Body: { fileName: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal/files/:fileId",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Update proposal file name",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId", "fileId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
            fileId: {
              type: "string",
              description: "File ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["fileName"],
          properties: {
            fileName: {
              type: "string",
              description: "New file name",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              fileName: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string; fileId: string }; Body: { fileName: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      const { fileId } = request.params;
      const { fileName } = request.body;

      if (!fileName || typeof fileName !== "string" || fileName.trim().length === 0) {
        return reply.status(400).send({ error: "File name is required" });
      }

      // Verify file belongs to vendor's response
      const proposalFile = await db.rFPProposalFile.findUnique({
        where: { id: fileId },
        include: {
          vendorResponse: {
            include: {
              projectVendor: true,
            },
          },
        },
      });

      if (!proposalFile) {
        return reply.status(404).send({ error: "File not found" });
      }

      if (proposalFile.vendorResponse.projectVendor.vendorId !== vendorContact.vendorId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Update file name
      const updated = await db.rFPProposalFile.update({
        where: { id: fileId },
        data: {
          fileName: fileName.trim(),
        },
      });

      // Mark proposal as having changes
      await db.rFPVendorResponse.update({
        where: { id: proposalFile.vendorResponse.id },
        data: { hasProposalChanges: true },
      });

      return reply.send({
        id: updated.id,
        fileName: updated.fileName,
      });
    }
  );

  /**
   * Delete proposal file
   * Removes proposal file
   */
  fastify.delete<{ Params: { rfpId: string; fileId: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal/files/:fileId",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Delete proposal file",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId", "fileId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
            fileId: {
              type: "string",
              description: "File ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string; fileId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      const { fileId } = request.params;

      // Verify file belongs to vendor's response
      const proposalFile = await db.rFPProposalFile.findUnique({
        where: { id: fileId },
        include: {
          vendorResponse: {
            include: {
              projectVendor: true,
            },
          },
        },
      });

      if (!proposalFile) {
        return reply.status(404).send({ error: "File not found" });
      }

      if (proposalFile.vendorResponse.projectVendor.vendorId !== vendorContact.vendorId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Store vendor response ID before deletion
      const vendorResponseId = proposalFile.vendorResponse.id;

      // Delete file
      await db.rFPProposalFile.delete({
        where: { id: fileId },
      });

      // Mark proposal as having changes
      await db.rFPVendorResponse.update({
        where: { id: vendorResponseId },
        data: { hasProposalChanges: true },
      });

      return reply.send({ message: "File deleted successfully" });
    }
  );

  /**
   * Submit proposal
   * Only allowed for main contact
   * Updates RFPVendorResponse status to ProposalSubmitted
   * Requires confirmation with list of files
   */
  fastify.post<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal/submit",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess, requireMainContact()],
      schema: {
        description: "Submit proposal. Only allowed for main contact.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              proposalSubmittedAt: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get vendor response
      const vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
        include: {
          proposalFiles: true,
          requirementResponses: true,
        },
      });

      if (!vendorResponse) {
        return reply.status(400).send({ error: "Vendor response not found. Please participate first." });
      }

      // Check if this is a resubmission
      const isResubmission = vendorResponse.status === RFPVendorResponseStatus.ProposalSubmitted;
      
      if (isResubmission) {
        // Only allow resubmission if there are proposal changes
        if (!vendorResponse.hasProposalChanges) {
          return reply.status(400).send({ error: "No changes detected. You can only resubmit after making changes to your proposal." });
        }
      } else {
        // First submission - must be participating
        if (vendorResponse.status !== RFPVendorResponseStatus.Participating) {
          return reply.status(400).send({ error: "Vendor must be participating to submit proposal" });
        }
      }

      // Check if there are any files
      if (vendorResponse.proposalFiles.length === 0) {
        return reply.status(400).send({ error: "At least one proposal file is required" });
      }

      // Check if RFP has Requirements document
      const requirementsDocument = await db.rFPDocument.findFirst({
        where: {
          rfpId: rfp.id,
          type: "Requirements",
        },
      });

      // If Requirements document exists, validate that at least one requirement response exists
      if (requirementsDocument) {
        if (vendorResponse.requirementResponses.length === 0) {
          return reply.status(400).send({ error: "Requirements response is required. Please upload your requirements response Excel file." });
        }
      }

      // Update vendor response status and reset hasProposalChanges
      const updated = await db.rFPVendorResponse.update({
        where: { id: vendorResponse.id },
        data: {
          status: RFPVendorResponseStatus.ProposalSubmitted,
          proposalSubmittedAt: new Date(),
          hasProposalChanges: false,
        },
      });

      // Update ProjectVendor status to RFP_Delivered
      await db.projectVendor.update({
        where: { id: projectVendor.id },
        data: {
          status: "RFP_Delivered",
        },
      });

      return reply.send({
        id: updated.id,
        status: updated.status,
        proposalSubmittedAt: updated.proposalSubmittedAt?.toISOString() || null,
      });
    }
  );

  /**
   * Reopen proposal submission
   * Only allowed for main contact
   * Updates RFPVendorResponse status from ProposalSubmitted back to Participating
   */
  fastify.post<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/proposal/reopen",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess, requireMainContact()],
      schema: {
        description: "Reopen proposal submission. Only allowed for main contact.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get vendor response
      const vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
      });

      if (!vendorResponse) {
        return reply.status(400).send({ error: "Vendor response not found." });
      }

      // Only allow reopening if status is ProposalSubmitted
      if (vendorResponse.status !== RFPVendorResponseStatus.ProposalSubmitted) {
        return reply.status(400).send({ error: "Proposal must be submitted to reopen it." });
      }

      // Update vendor response status back to Participating
      const updated = await db.rFPVendorResponse.update({
        where: { id: vendorResponse.id },
        data: {
          status: RFPVendorResponseStatus.Participating,
        },
      });

      // Update ProjectVendor status back to RFP_Received
      await db.projectVendor.update({
        where: { id: projectVendor.id },
        data: {
          status: "RFP_Received",
        },
      });

      return reply.send({
        id: updated.id,
        status: updated.status,
      });
    }
  );

  /**
   * Download Requirements PDF for vendor
   * Only accessible to vendors who have access to the RFP
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/requirements/pdf",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Download Requirements PDF for vendor. Only accessible to vendors with RFP access.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            description: "PDF file",
            type: "string",
            format: "binary",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      try {
        const rfp = (request as any).rfp;
        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get project info
        const project = await db.project.findUnique({
          where: { id: rfp.projectId },
          select: { name: true },
        });

        if (!project) {
          return reply.status(404).send({ error: "Project not found" });
        }

        // Get approved requirements with hierarchy information
        const requirements = await db.requirement.findMany({
          where: {
            hierarchy: {
              projectId: rfp.projectId,
            },
            status: "Approved",
          },
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
          orderBy: [
            { hierarchyId: "asc" },
            { order: "asc" },
          ],
        });

        // Generate PDF
        const pdfDoc = generateRequirementsPDF(
          { name: project.name },
          requirements as any
        );

        // Use hijack() to take full control of the response stream
        reply.hijack();
        const responseStream = reply.raw;
        
        // Get origin from request for CORS
        const origin = request.headers.origin;
        const isDevelopment = process.env.NODE_ENV !== "production";
        
        // Determine allowed origin
        let allowedOrigin: string | null = null;
        if (origin) {
          if (isDevelopment) {
            if (
              origin === "http://localhost:3000" ||
              origin === "http://127.0.0.1:3000" ||
              /^http:\/\/.*\.local:\d+$/.test(origin) ||
              /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
              /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
              /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/.test(origin)
            ) {
              allowedOrigin = origin;
            }
          } else {
            if (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000") {
              allowedOrigin = origin;
            }
          }
        }
        
        // Set headers directly on the raw response
        responseStream.statusCode = 200;
        responseStream.setHeader("Content-Type", "application/pdf");
        responseStream.setHeader("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, "_")}_Requirements.pdf"`);
        
        // Add CORS headers
        if (allowedOrigin) {
          responseStream.setHeader("Access-Control-Allow-Origin", allowedOrigin);
          responseStream.setHeader("Access-Control-Allow-Credentials", "true");
          responseStream.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
          responseStream.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
        
        // Pipe PDF to response
        pdfDoc.pipe(responseStream);
        pdfDoc.end();
      } catch (error: any) {
        request.log.error({ err: error, rfpId: request.params.rfpId }, "Error generating requirements PDF for vendor");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "Failed to generate PDF",
        });
      }
    }
  );

  /**
   * Download Requirements Excel for vendor
   * Only accessible to vendors who have access to the RFP
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/requirements/excel",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Download Requirements Excel for vendor. Only accessible to vendors with RFP access.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            description: "Excel file",
            type: "string",
            format: "binary",
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      try {
        const rfp = (request as any).rfp;
        if (!rfp) {
          return reply.status(404).send({ error: "RFP not found" });
        }

        // Get project info
        const project = await db.project.findUnique({
          where: { id: rfp.projectId },
          select: { name: true },
        });

        if (!project) {
          return reply.status(404).send({ error: "Project not found" });
        }

        // Get approved requirements with hierarchy information
        const requirements = await db.requirement.findMany({
          where: {
            hierarchy: {
              projectId: rfp.projectId,
            },
            status: "Approved",
          },
          include: {
            hierarchy: {
              include: {
                parent: true,
              },
            },
          },
          orderBy: [
            { hierarchyId: "asc" },
            { order: "asc" },
          ],
        });

        // Generate Excel
        const excelBuffer = await generateRequirementsExcel(
          { name: project.name },
          requirements as any
        );

        // Set response headers
        reply
          .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("Content-Disposition", `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, "_")}_Requirements.xlsx"`)
          .send(excelBuffer);
      } catch (error: any) {
        request.log.error({ err: error, rfpId: request.params.rfpId }, "Error generating requirements Excel for vendor");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "Failed to generate Excel",
        });
      }
    }
  );

  /**
   * Upload requirements response Excel file
   * Accepts xlsx file upload, parses it, and creates/updates RFPRequirementResponse records
   * First attempts auto-detection of column structure
   * If auto-detection fails, returns column detection result with available columns
   * Accepts optional columnMapping in form data for second call
   */
  fastify.post<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/requirements/upload",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Upload requirements response Excel file. Returns column mapping info if needed.",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        consumes: ["multipart/form-data"],
        response: {
          200: {
            type: "object",
            properties: {
              totalRequirements: { type: "number" },
              answeredCount: { type: "number" },
              percentage: { type: "number" },
              invalidAnswers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    requirementNumber: { type: "string" },
                    invalidValue: { type: "string" },
                    row: { type: "number" },
                  },
                },
              },
              needsColumnMapping: { type: "boolean" },
              availableColumns: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    header: { type: "string" },
                    sampleValues: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get or create vendor response
      let vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
      });

      if (!vendorResponse) {
        vendorResponse = await db.rFPVendorResponse.create({
          data: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
            contactPersonId: vendorContact.contactPersonId,
            status: RFPVendorResponseStatus.Participating,
          },
        });
      }

      // Parse multipart form data
      // First, check for column mapping field
      let columnMapping: ColumnMapping | undefined;
      let fileData: any = null;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          fileData = part;
        } else if (part.type === "field" && part.fieldname === "columnMapping") {
          try {
            columnMapping = JSON.parse(part.value as string) as ColumnMapping;
          } catch (_err) {
            return reply.status(400).send({ error: "Invalid column mapping format" });
          }
        }
      }

      if (!fileData) {
        return reply.status(400).send({ error: "File is required" });
      }

      // Validate file type (must be xlsx)
      if (!fileData.mimetype || !fileData.mimetype.includes("spreadsheetml")) {
        return reply.status(400).send({ error: "File must be an Excel file (.xlsx)" });
      }

      // Read file data
      const chunks: Buffer[] = [];
      for await (const chunk of fileData.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // If no column mapping provided, try auto-detection
      if (!columnMapping) {
        try {
          const detectionResult = await detectColumnStructure(fileBuffer);
          if (detectionResult.needsMapping) {
            // Return column mapping request
            return reply.send({
              needsColumnMapping: true,
              availableColumns: detectionResult.availableColumns,
              totalRequirements: 0,
              answeredCount: 0,
              percentage: 0,
              invalidAnswers: [],
            });
          }
          // Use detected mapping
          if (detectionResult.mapping) {
            columnMapping = detectionResult.mapping;
          }
        } catch (err: any) {
          return reply.status(400).send({ 
            error: `Failed to detect column structure: ${err.message || "Invalid file format"}` 
          });
        }
      }

      // If still no mapping, use standard format
      if (!columnMapping) {
        columnMapping = {
          requirementNumber: 0, // Column A
          answer: 3, // Column D
          description: 4, // Column E
          reference: 5, // Column F
        };
      }

      // Parse Excel file with mapping
      let parseResult;
      try {
        parseResult = await parseRequirementsExcelWithMapping(fileBuffer, columnMapping);
      } catch (err: any) {
        return reply.status(400).send({ 
          error: `Failed to parse Excel file: ${err.message || "Invalid file format"}` 
        });
      }

      // Delete all existing requirement responses for this vendor before loading new data
      // This ensures each upload completely replaces the previous responses
      await db.rFPRequirementResponse.deleteMany({
        where: {
          vendorResponseId: vendorResponse.id,
        },
      });

      // Get all requirements for this project
      const requirements = await db.requirement.findMany({
        where: {
          hierarchy: {
            projectId: rfp.projectId,
          },
          status: "Approved",
        },
      });

      // Create a map of requirement numbers to requirement IDs
      const requirementMap = new Map<string, string>();
      requirements.forEach((req) => {
        requirementMap.set(req.number, req.id);
      });

      // Process parsed responses
      const upsertPromises = parseResult.responses.map(async (response) => {
        const requirementId = requirementMap.get(response.requirementNumber);
        if (!requirementId) {
          // Skip if requirement not found (might be from different version)
          return null;
        }

        // Upsert requirement response
        return db.rFPRequirementResponse.upsert({
          where: {
            requirementId_vendorResponseId: {
              requirementId,
              vendorResponseId: vendorResponse.id,
            },
          },
          create: {
            requirementId,
            vendorResponseId: vendorResponse.id,
            answer: response.answer,
            description: response.description || null,
            reference: response.reference || null,
          },
          update: {
            answer: response.answer,
            description: response.description || null,
            reference: response.reference || null,
          },
        });
      });

      await Promise.all(upsertPromises);

      return reply.send({
        totalRequirements: parseResult.totalRequirements,
        answeredCount: parseResult.answeredCount,
        percentage: parseResult.percentage,
        invalidAnswers: parseResult.invalidAnswers,
        needsColumnMapping: false,
      });
    }
  );

  /**
   * Get requirements responses for RFP
   * Returns existing responses for the vendor
   */
  fastify.get<{ Params: { rfpId: string } }>(
    "/vendor-rfp/rfps/:rfpId/requirements/responses",
    {
      preHandler: [authenticateVendorContact, verifyRFPAccess],
      schema: {
        description: "Get requirements responses for RFP",
        tags: ["vendor-rfp"],
        params: {
          type: "object",
          required: ["rfpId"],
          properties: {
            rfpId: {
              type: "string",
              description: "RFP ID",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              responses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    requirementId: { type: "string" },
                    requirementNumber: { type: "string" },
                    answer: { type: "string", nullable: true },
                    description: { type: "string", nullable: true },
                    reference: { type: "string", nullable: true },
                  },
                },
              },
              totalRequirements: { type: "number" },
              answeredCount: { type: "number" },
              percentage: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rfpId: string } }>, reply: FastifyReply) => {
      const vendorContact = (request as VendorContactRequest).vendorContact;
      if (!vendorContact) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const rfp = (request as any).rfp;
      if (!rfp) {
        return reply.status(404).send({ error: "RFP not found" });
      }

      // Get project vendor
      const projectVendor = await db.projectVendor.findFirst({
        where: {
          projectId: rfp.projectId,
          vendorId: vendorContact.vendorId,
        },
      });

      if (!projectVendor) {
        return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
      }

      // Get vendor response
      const vendorResponse = await db.rFPVendorResponse.findUnique({
        where: {
          rfpId_projectVendorId: {
            rfpId: rfp.id,
            projectVendorId: projectVendor.id,
          },
        },
        include: {
          requirementResponses: {
            include: {
              requirement: true,
            },
          },
        },
      });

      if (!vendorResponse) {
        return reply.send({
          responses: [],
          totalRequirements: 0,
          answeredCount: 0,
          percentage: 0,
        });
      }

      // Get total approved requirements
      const totalRequirements = await db.requirement.count({
        where: {
          hierarchy: {
            projectId: rfp.projectId,
          },
          status: "Approved",
        },
      });

      const answeredCount = vendorResponse.requirementResponses.filter(
        (r) => r.answer !== null
      ).length;

      const percentage = totalRequirements > 0
        ? Math.round((answeredCount / totalRequirements) * 100)
        : 0;

      return reply.send({
        responses: vendorResponse.requirementResponses.map((r) => ({
          id: r.id,
          requirementId: r.requirementId,
          requirementNumber: r.requirement.number,
          answer: r.answer,
          description: r.description,
          reference: r.reference,
        })),
        totalRequirements,
        answeredCount,
        percentage,
      });
    }
  );
}

