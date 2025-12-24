/**
 * Background scheduler service for RFI/RFP publishing
 * Runs every 5 minutes to check publish dates and automatically publish when dates are reached
 */

import { db } from "@dp/db";
import { FastifyInstance } from "fastify";
import { normalizePublishDate, shouldPublishNow } from "../utils/date-utils";
import { publishRFI, publishRFP } from "./publishing";
import { sendRFPQuestionEmail } from "./email";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the scheduler
 */
export function startScheduler(fastify: FastifyInstance): void {
  if (intervalId) {
    console.log("Scheduler is already running");
    return;
  }

  console.log("Starting background scheduler for RFI/RFP publishing and email notifications (checks every 5 minutes)");
  
  // Run immediately on start
  checkAndPublish(fastify).catch((error) => {
    console.error("Error in initial scheduler check:", error);
  });
  checkAndSendEmailNotifications(fastify).catch((error) => {
    console.error("Error in initial email notification check:", error);
  });

  // Then run every 5 minutes
  intervalId = setInterval(() => {
    checkAndPublish(fastify).catch((error) => {
      console.error("Error in scheduler check:", error);
    });
    checkAndSendEmailNotifications(fastify).catch((error) => {
      console.error("Error in email notification check:", error);
    });
  }, INTERVAL_MS);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Background scheduler stopped");
  }
}

/**
 * Check for RFIs and RFPs that should be published and publish them
 */
async function checkAndPublish(fastify: FastifyInstance): Promise<void> {
  const now = new Date();
  
  try {
    // Check RFIs that should be auto-published (ONLY from Draft status)
    const rfisToPublish = await db.rFI.findMany({
      where: {
        autoPublishDate: {
          not: null,
        },
        status: "Draft",
      },
      include: {
        project: true,
      },
    });

    for (const rfi of rfisToPublish) {
      if (!rfi.autoPublishDate) continue;

      try {
        // Normalize the publish date
        const normalizedDate = normalizePublishDate(rfi.autoPublishDate, true, false);
        
        // Check if it's time to publish
        if (shouldPublishNow(normalizedDate, now)) {
          console.log(`Auto-publishing RFI ${rfi.id} (project ${rfi.projectId})`);
          await publishRFI(rfi.id, rfi.projectId, fastify);
          console.log(`Successfully auto-published RFI ${rfi.id}`);
        }
      } catch (error) {
        // Log error but continue processing other RFIs
        console.error(`Error auto-publishing RFI ${rfi.id}:`, error);
      }
    }

    // Check RFPs that should be published (based on StartDate schedule item)
    // Query schedule items directly for efficiency
    const startDateScheduleItems = await db.rFPScheduleItem.findMany({
      where: {
        type: "StartDate",
        date: {
          not: null,
        },
        rfp: {
          status: "Draft",
        },
      },
      include: {
        rfp: true,
      },
    });

    for (const startDateItem of startDateScheduleItems) {
      if (!startDateItem.date || !startDateItem.rfp) continue;
      
      const rfp = startDateItem.rfp;

      try {
        // Normalize the publish date (use disregardTimestamp from the schedule item)
        const normalizedDate = normalizePublishDate(
          startDateItem.date,
          startDateItem.disregardTimestamp,
          false
        );
        
        // Check if it's time to publish
        if (shouldPublishNow(normalizedDate, now)) {
          console.log(`Auto-publishing RFP ${rfp.id} (project ${rfp.projectId})`);
          await publishRFP(rfp.id, rfp.projectId, fastify);
          console.log(`Successfully auto-published RFP ${rfp.id}`);
        }
      } catch (error) {
        // Log error but continue processing other RFPs
        console.error(`Error auto-publishing RFP ${rfp.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in scheduler check:", error);
  }
}

/**
 * Check for pending email notifications that should be sent
 * Only sends if the question hasn't been answered yet
 */
async function checkAndSendEmailNotifications(fastify: FastifyInstance): Promise<void> {
  const now = new Date();
  
  try {
    // Find pending email notifications that are due and haven't been sent
    const pendingNotifications = await db.pendingEmailNotification.findMany({
      where: {
        scheduledFor: {
          lte: now, // Scheduled time has passed
        },
        sentAt: null, // Not yet sent
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
        rfpQuestion: {
          include: {
            rfp: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const notification of pendingNotifications) {
      try {
        // Check if the question has been answered - if so, skip sending email
        if (notification.rfpQuestion.answeredAt) {
          // Mark as sent (even though we didn't send it) to avoid retrying
          await db.pendingEmailNotification.update({
            where: { id: notification.id },
            data: { sentAt: now },
          });
          console.log(`Skipping email notification ${notification.id} - question already answered`);
          continue;
        }

        // Send the email
        await sendRFPQuestionEmail(notification.user, {
          id: notification.rfpQuestion.id,
          question: notification.rfpQuestion.question,
          rfpId: notification.rfpQuestion.rfpId,
          rfp: {
            projectId: notification.rfpQuestion.rfp.projectId,
            project: {
              name: notification.rfpQuestion.rfp.project.name,
            },
          },
        });

        // Mark as sent
        await db.pendingEmailNotification.update({
          where: { id: notification.id },
          data: { sentAt: now },
        });

        console.log(`Sent RFP question email notification ${notification.id} to ${notification.user.email}`);
      } catch (error) {
        // Log error but continue processing other notifications
        console.error(`Error sending email notification ${notification.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in email notification check:", error);
  }
}

