import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "@dp/db";

export interface VendorContactPayload {
  contactPersonId: string;
  vendorId: string;
  email: string;
  isMainContact: boolean;
  type: "vendor-contact";
}

export interface VendorContactRequest extends FastifyRequest {
  vendorContact?: VendorContactPayload;
}

/**
 * Authenticate vendor contact from JWT token
 * Token should contain vendor contact context (contactPersonId, vendorId, email, isMainContact)
 */
export async function authenticateVendorContact(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const decoded = request.user as unknown as VendorContactPayload;
    
    if (!decoded || decoded.type !== "vendor-contact") {
      return reply.status(401).send({ error: "Invalid token type" });
    }

    // Verify vendor contact still exists
    const contactPerson = await db.vendorContactPerson.findUnique({
      where: { id: decoded.contactPersonId },
      include: {
        vendor: true,
      },
    });

    if (!contactPerson) {
      return reply.status(401).send({ error: "Vendor contact not found" });
    }

    // Verify email matches
    if (contactPerson.email !== decoded.email) {
      return reply.status(401).send({ error: "Email mismatch" });
    }

    // Attach vendor contact info to request
    (request as VendorContactRequest).vendorContact = {
      contactPersonId: contactPerson.id,
      vendorId: contactPerson.vendorId,
      email: contactPerson.email,
      isMainContact: contactPerson.isMainContact,
      type: "vendor-contact",
    };
  } catch {
    reply.status(401).send({ error: "Unauthorized" });
  }
}

/**
 * Require that the authenticated vendor contact is the main contact
 */
export function requireMainContact() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const vendorContact = (request as VendorContactRequest).vendorContact;
    if (!vendorContact) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (!vendorContact.isMainContact) {
      return reply.status(403).send({ 
        error: "Only main contact can perform this action",
        mainContactRequired: true,
      });
    }
  };
}

/**
 * Verify that the vendor contact has access to the specified RFP
 * Checks that:
 * 1. Vendor is linked to the RFP's project via ProjectVendor
 * 2. RFP is published
 */
export async function verifyRFPAccess(
  request: FastifyRequest<{ Params: { rfpId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const vendorContact = (request as VendorContactRequest).vendorContact;
  if (!vendorContact) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const { rfpId } = request.params;

  // Get RFP with project
  const rfp = await db.rFP.findUnique({
    where: { id: rfpId },
    include: {
      project: {
        include: {
          ProjectVendor: {
            where: {
              vendorId: vendorContact.vendorId,
            },
          },
        },
      },
    },
  });

  if (!rfp) {
    return reply.status(404).send({ error: "RFP not found" });
  }

  if (rfp.status !== "Published") {
    return reply.status(403).send({ error: "RFP is not published" });
  }

  // Check if vendor is linked to project
  if (rfp.project.ProjectVendor.length === 0) {
    return reply.status(403).send({ error: "Vendor does not have access to this RFP" });
  }

  // Attach RFP to request for use in route handlers
  (request as any).rfp = rfp;
}
