import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";
import { authenticate, requireRole, requireTenant, getUser } from "../middleware/auth";

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

interface UpdateCompanySettingsBody {
  name?: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
  logoData?: string | null;
  logoFileName?: string | null;
  logoFileType?: string | null;
  logoShape?: string | null;
  logoPlacement?: string | null;
  logoBorder?: string | null;
  bannerData?: string | null;
  bannerFileName?: string | null;
  bannerFileType?: string | null;
}

export default async function companyRoutes(fastify: FastifyInstance) {
  /**
   * Get company/tenant settings
   * Returns full tenant information including subscription status, tier, and graphics
   * Requires CompanyAdministrator or GlobalAdministrator role
   */
  fastify.get(
    "/settings",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Get company/tenant settings including subscription status, tier, and graphics. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["company"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              organizationNumber: { type: "string", nullable: true },
              emailDomain: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
              subscriptionTier: { type: "string", nullable: true, enum: ["Projects1", "Projects2", "Projects5", "Unlimited"] },
              subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
              trialStartedAt: { type: "string", format: "date-time", nullable: true },
              logoData: { type: "string", nullable: true },
              logoFileName: { type: "string", nullable: true },
              logoFileType: { type: "string", nullable: true },
              logoShape: { type: "string", nullable: true },
              logoPlacement: { type: "string", nullable: true },
              logoBorder: { type: "string", nullable: true },
              bannerData: { type: "string", nullable: true },
              bannerFileName: { type: "string", nullable: true },
              bannerFileType: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
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
            description: "Forbidden - requires admin role or tenant",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const currentUser = getUser(request);
      if (!currentUser.tenantId) {
        return reply.status(403).send({ error: "Tenant required" });
      }

      const tenant = await db.tenant.findUnique({
        where: { id: currentUser.tenantId },
      });

      if (!tenant) {
        return reply.status(404).send({ error: "Tenant not found" });
      }

      return reply.send({
        id: tenant.id,
        name: tenant.name,
        organizationNumber: tenant.organizationNumber,
        emailDomain: tenant.emailDomain,
        subscriptionStatus: tenant.subscriptionStatus,
        subscriptionTier: tenant.subscriptionTier,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        trialStartedAt: tenant.trialStartedAt,
        logoData: tenant.logoData,
        logoFileName: tenant.logoFileName,
        logoFileType: tenant.logoFileType,
        logoShape: tenant.logoShape,
        logoPlacement: tenant.logoPlacement,
        logoBorder: tenant.logoBorder,
        bannerData: tenant.bannerData,
        bannerFileName: tenant.bannerFileName,
        bannerFileType: tenant.bannerFileType,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      });
    }
  );

  /**
   * Update company/tenant settings
   * Accepts name, organizationNumber, emailDomain, and graphics fields
   * Validates organization number with brreg.no
   * Requires CompanyAdministrator or GlobalAdministrator role
   */
  fastify.put<{ Body: UpdateCompanySettingsBody }>(
    "/settings",
    {
      preHandler: [
        authenticate,
        requireTenant,
        requireRole(["CompanyAdministrator", "GlobalAdministrator"]),
      ],
      schema: {
        description: "Update company/tenant settings. Validates organization number with brreg.no. Requires CompanyAdministrator or GlobalAdministrator role.",
        tags: ["company"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            organizationNumber: { type: "string", nullable: true },
            emailDomain: { type: "string", nullable: true },
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
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              organizationNumber: { type: "string", nullable: true },
              emailDomain: { type: "string", nullable: true },
              subscriptionStatus: { type: "string", enum: ["Trial", "Active", "Expired"] },
              subscriptionTier: { type: "string", nullable: true, enum: ["Projects1", "Projects2", "Projects5", "Unlimited"] },
              subscriptionExpiresAt: { type: "string", format: "date-time", nullable: true },
              trialStartedAt: { type: "string", format: "date-time", nullable: true },
              logoData: { type: "string", nullable: true },
              logoFileName: { type: "string", nullable: true },
              logoFileType: { type: "string", nullable: true },
              logoShape: { type: "string", nullable: true },
              logoPlacement: { type: "string", nullable: true },
              logoBorder: { type: "string", nullable: true },
              bannerData: { type: "string", nullable: true },
              bannerFileName: { type: "string", nullable: true },
              bannerFileType: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              brregName: { type: "string" },
            },
            description: "Validation error or brreg.no validation failed",
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
    async (request: FastifyRequest<{ Body: UpdateCompanySettingsBody }>, reply: FastifyReply) => {
      try {
        const currentUser = getUser(request);
        if (!currentUser.tenantId) {
          return reply.status(403).send({ error: "Tenant required" });
        }

        const body = request.body;

        // Get current tenant to preserve fields not being updated
        const currentTenant = await db.tenant.findUnique({
          where: { id: currentUser.tenantId },
        });

        if (!currentTenant) {
          return reply.status(404).send({ error: "Tenant not found" });
        }

        // Prepare update data
        const updateData: any = {
          updatedAt: new Date(),
        };

        // Update name if provided
        if (body.name !== undefined) {
          updateData.name = body.name;
        }

        // Update email domain if provided
        if (body.emailDomain !== undefined) {
          updateData.emailDomain = body.emailDomain || null;
        }

        // Validate organization number if provided
        if (body.organizationNumber !== undefined) {
          const orgNumber = body.organizationNumber?.trim() || null;
          
          if (orgNumber) {
            // Get the name to validate against (use provided name or current tenant name)
            const nameToValidate = body.name || currentTenant.name;
            
            const validation = await validateBrregOrganizationNumber(orgNumber, nameToValidate);
            
            if (!validation.valid) {
              return reply.status(400).send({
                error: validation.error || "Invalid organization number",
                brregName: validation.brregName,
              });
            }
            
            updateData.organizationNumber = orgNumber;
          } else {
            updateData.organizationNumber = null;
          }
        }

        // Update graphics fields if provided
        // Validate base64 data size (max 5MB for logo, 10MB for banner)
        if (body.logoData !== undefined) {
          if (body.logoData && body.logoData.length > 5 * 1024 * 1024) {
            return reply.status(400).send({
              error: "Image too large",
              message: "Logo image data exceeds maximum size of 5MB. Please use a smaller image.",
            });
          }
          updateData.logoData = body.logoData || null;
        }
        if (body.logoFileName !== undefined) {
          updateData.logoFileName = body.logoFileName || null;
        }
        if (body.logoFileType !== undefined) {
          updateData.logoFileType = body.logoFileType || null;
        }
        if (body.logoShape !== undefined) {
          updateData.logoShape = body.logoShape || null;
        }
        if (body.logoPlacement !== undefined) {
          updateData.logoPlacement = body.logoPlacement || null;
        }
        if (body.logoBorder !== undefined) {
          updateData.logoBorder = body.logoBorder || null;
        }
        if (body.bannerData !== undefined) {
          if (body.bannerData && body.bannerData.length > 10 * 1024 * 1024) {
            return reply.status(400).send({
              error: "Image too large",
              message: "Banner image data exceeds maximum size of 10MB. Please use a smaller image.",
            });
          }
          updateData.bannerData = body.bannerData || null;
        }
        if (body.bannerFileName !== undefined) {
          updateData.bannerFileName = body.bannerFileName || null;
        }
        if (body.bannerFileType !== undefined) {
          updateData.bannerFileType = body.bannerFileType || null;
        }

        // Update tenant
        const updatedTenant = await db.tenant.update({
          where: { id: currentUser.tenantId },
          data: updateData,
        });

        return reply.send({
          id: updatedTenant.id,
          name: updatedTenant.name,
          organizationNumber: updatedTenant.organizationNumber,
          emailDomain: updatedTenant.emailDomain,
          subscriptionStatus: updatedTenant.subscriptionStatus,
          subscriptionTier: updatedTenant.subscriptionTier,
          subscriptionExpiresAt: updatedTenant.subscriptionExpiresAt,
          trialStartedAt: updatedTenant.trialStartedAt,
          logoData: updatedTenant.logoData,
          logoFileName: updatedTenant.logoFileName,
          logoFileType: updatedTenant.logoFileType,
          logoShape: updatedTenant.logoShape,
          logoPlacement: updatedTenant.logoPlacement,
          logoBorder: updatedTenant.logoBorder,
          bannerData: updatedTenant.bannerData,
          bannerFileName: updatedTenant.bannerFileName,
          bannerFileType: updatedTenant.bannerFileType,
          createdAt: updatedTenant.createdAt,
          updatedAt: updatedTenant.updatedAt,
        });
      } catch (error: any) {
        request.log.error({ err: error }, "Error updating company settings");
        return reply.status(500).send({
          error: "Internal server error",
          message: error.message || "An unexpected error occurred while updating company settings",
        });
      }
    }
  );
}

