/**
 * Publishing service for RFI and RFP
 * Contains shared logic for publishing, creating vendor responses, and sending emails
 */

import { db } from "@dp/db";
import { FastifyInstance } from "fastify";
import { sendRFIEmail, sendRFPEmail } from "./email";

const dbAny = db as any;

/**
 * Publish RFI:
 * - Validates RFI (deadline set, questions exist)
 * - Updates RFI status and timestamps
 * - Creates vendor responses for all project vendors
 * - Updates vendor statuses
 * - Generates magic link tokens
 * - Sends emails (via email service)
 */
export async function publishRFI(
  rfiId: string,
  projectId: string,
  fastify: FastifyInstance
): Promise<void> {
  // Get RFI
  const rfi = await db.rFI.findUnique({
    where: { id: rfiId },
    include: {
      project: true,
    },
  });

  if (!rfi) {
    throw new Error("RFI not found");
  }

  // Validate deadline is set
  if (!rfi.deadline) {
    throw new Error("Deadline must be set before publishing");
  }

  // Validate at least 1 question exists
  const questionCount = await dbAny.rFIQuestion.count({
    where: { rfiId: rfi.id },
  });

  if (questionCount === 0) {
    throw new Error("At least 1 question must be added before publishing");
  }

  const now = new Date();
  const previousStatus = rfi.status;

  // Update RFI status
  await db.rFI.update({
    where: { id: rfiId },
    data: {
      status: "Published",
      publishedAt: now,
      unpublishedAt: null,
    },
  });

  // Only create vendor responses and send emails if publishing from Draft status
  // If publishing from Unpublished, skip this (emails already sent, responses already exist)
  const shouldSendEmails = previousStatus === "Draft";

  if (!shouldSendEmails) {
    return; // Skip vendor response creation and email sending
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

  // Create vendor responses and send emails
  for (const pv of projectVendors) {
    const mainContact = pv.vendor.VendorContactPerson.find((c) => c.isMainContact);
    if (!mainContact) {
      continue; // Skip vendors without main contacts
    }

    // Check if response already exists
    const existingResponse = await dbAny.rFIVendorResponse.findUnique({
      where: {
        rfiId_projectVendorId: {
          rfiId: rfi.id,
          projectVendorId: pv.id,
        },
      },
    });

    if (!existingResponse) {
      // Generate token expiration (30 days from now)
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

      // Create vendor response
      const vendorResponse = await dbAny.rFIVendorResponse.create({
        data: {
          rfiId: rfi.id,
          projectVendorId: pv.id,
          contactPersonId: mainContact.id,
          status: "Sent",
          sentAt: now,
          tokenExpiresAt,
        },
      });

      // Generate magic link token
      const magicLinkToken = fastify.jwt.sign(
        {
          vendorResponseId: vendorResponse.id,
          type: "rfi-vendor",
        } as any,
        { expiresIn: "30d" }
      );

      // Update with token
      await dbAny.rFIVendorResponse.update({
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

      // Send email (development mode will log, production will send via SES)
      try {
        await sendRFIEmail(mainContact, rfi, magicLinkToken);
      } catch (error) {
        // Log error but don't fail the entire publishing process
        console.error(`Failed to send RFI email to ${mainContact.email}:`, error);
      }
    }
  }
}

/**
 * Publish RFP:
 * - Validates RFP (contact person set, required dates set)
 * - Deletes all RFP changelog entries (wipe changelog)
 * - Updates RFP status and publish date
 * - Updates StartDate schedule item with current time
 * - Creates vendor responses for all project vendors
 * - Updates vendor statuses
 * - Sends emails (via email service)
 */
export async function publishRFP(
  rfpId: string,
  projectId: string,
  fastify: FastifyInstance
): Promise<void> {
  // Get RFP
  const rfp = await db.rFP.findUnique({
    where: { id: rfpId },
    include: {
      contactPerson: true,
      alternativeContactPerson: true,
    },
  });

  if (!rfp) {
    throw new Error("RFP not found");
  }

  // Validate main contact person is set
  if (!rfp.contactPersonId) {
    throw new Error("Main contact person must be set before publishing");
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
    throw new Error(`All required dates must be set before publishing. Missing: ${missingDates.join(", ")}`);
  }

  const now = new Date();
  const previousStatus = rfp.status;

  // Delete all changelog entries (wipe changelog) - only when publishing from Draft
  // If republishing from Unpublished, preserve existing changelog entries
  if (previousStatus === "Draft") {
    await db.rFPChangelogEntry.deleteMany({
      where: { rfpId: rfp.id },
    });
  }

  // Get start date item
  const startDateItem = requiredItems.find((item) => item.type === "StartDate");
  if (startDateItem) {
    // Update start date schedule item with current time
    await db.rFPScheduleItem.update({
      where: { id: startDateItem.id },
      data: {
        date: now,
      },
    });
  }

  // Update RFP status and publish date
  await db.rFP.update({
    where: { id: rfpId },
    data: {
      status: "Published",
      publishDate: now,
    },
  });

  // Only create vendor responses and send emails if publishing from Draft status
  // If publishing from Unpublished, skip this (emails already sent, responses already exist)
  const shouldSendEmails = previousStatus === "Draft";

  if (!shouldSendEmails) {
    return; // Skip vendor response creation and email sending
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

  // Create vendor responses and send emails
  for (const pv of projectVendors) {
    const mainContact = pv.vendor.VendorContactPerson.find((c) => c.isMainContact);
    if (!mainContact) {
      continue; // Skip vendors without main contacts
    }

    // Check if response already exists
    const existingResponse = await dbAny.rFPVendorResponse.findUnique({
      where: {
        rfpId_projectVendorId: {
          rfpId: rfp.id,
          projectVendorId: pv.id,
        },
      },
    });

    if (!existingResponse) {
      // Create vendor response
      await dbAny.rFPVendorResponse.create({
        data: {
          rfpId: rfp.id,
          projectVendorId: pv.id,
          contactPersonId: mainContact.id,
          status: "Sent",
        },
      });

      // Update vendor status
      if (pv.status === "Pending" || pv.status === "RFI_Received" || pv.status === "RFI_Started" || pv.status === "RFI_Answered") {
        await db.projectVendor.update({
          where: { id: pv.id },
          data: { status: "RFP_Received" },
        });
      }

      // Send email (development mode will log, production will send via SES)
      try {
        await sendRFPEmail(mainContact, rfp);
      } catch (error) {
        // Log error but don't fail the entire publishing process
        console.error(`Failed to send RFP email to ${mainContact.email}:`, error);
      }
    }
  }
}

/**
 * Unpublish RFI:
 * - Updates RFI status to Unpublished
 * - Sets unpublishedAt timestamp
 * - Note: Does not delete vendor responses (they remain for historical purposes)
 */
export async function unpublishRFI(rfiId: string): Promise<void> {
  await db.rFI.update({
    where: { id: rfiId },
    data: {
      status: "Unpublished",
      unpublishedAt: new Date(),
    },
  });
}

/**
 * Unpublish RFP:
 * - Updates RFP status to Unpublished
 * - Sets publishDate to null
 * - Note: Does not delete vendor responses (they remain for historical purposes)
 */
export async function unpublishRFP(rfpId: string): Promise<void> {
  await db.rFP.update({
    where: { id: rfpId },
    data: {
      status: "Unpublished",
      publishDate: null,
    },
  });
}

