/**
 * Email service for sending RFI/RFP notifications via AWS SES
 * In development mode, skips actual sending and logs email details
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = !isProduction;

// Initialize SES client only in production
let sesClient: SESClient | null = null;
if (isProduction) {
  sesClient = new SESClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

interface VendorContactPerson {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface RFI {
  id: string;
  projectId: string;
  emailSubject: string | null;
  emailText: string | null;
}

interface RFP {
  id: string;
  projectId: string;
  // Add other RFP fields as needed for email
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

interface RFPQuestion {
  id: string;
  question: string;
  rfpId: string;
  rfp: {
    projectId: string;
    project: {
      name: string;
    };
  };
}

/**
 * Send RFI email to vendor contact
 */
export async function sendRFIEmail(
  vendorContact: VendorContactPerson,
  rfi: RFI,
  magicLinkToken: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
  const magicLinkUrl = `${baseUrl}/rfi/${magicLinkToken}`;

  const subject = rfi.emailSubject || "RFI Invitation";
  const bodyText = rfi.emailText || "You have been invited to respond to an RFI.";
  const emailBody = `${bodyText}\n\nPlease use the following link to access the RFI:\n${magicLinkUrl}`;

  const toEmail = vendorContact.email;
  const toName = `${vendorContact.firstName} ${vendorContact.lastName}`.trim() || vendorContact.email;

  if (isDevelopment) {
    // Log email details in development
    console.log("\n📧 RFI Email (DEV MODE - Not Sent):");
    console.log(`To: ${toName} <${toEmail}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${emailBody}`);
    console.log(`Magic Link: ${magicLinkUrl}\n`);
    return;
  }

  // Send via AWS SES in production
  if (!sesClient) {
    throw new Error("SES client not initialized. Check AWS credentials.");
  }

  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@example.com";
  
  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: emailBody,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(command);
    console.log(`RFI email sent to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send RFI email to ${toEmail}:`, error);
    throw error;
  }
}

/**
 * Send RFP email to vendor contact
 */
export async function sendRFPEmail(
  vendorContact: VendorContactPerson,
  rfp: RFP
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
  const rfpUrl = `${baseUrl}/portal/rfp/${rfp.projectId}`;

  const subject = "RFP Invitation";
  const emailBody = `You have been invited to participate in an RFP.\n\nPlease use the following link to access the RFP:\n${rfpUrl}`;

  const toEmail = vendorContact.email;
  const toName = `${vendorContact.firstName} ${vendorContact.lastName}`.trim() || vendorContact.email;

  if (isDevelopment) {
    // Log email details in development
    console.log("\n📧 RFP Email (DEV MODE - Not Sent):");
    console.log(`To: ${toName} <${toEmail}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${emailBody}`);
    console.log(`RFP Link: ${rfpUrl}\n`);
    return;
  }

  // Send via AWS SES in production
  if (!sesClient) {
    throw new Error("SES client not initialized. Check AWS credentials.");
  }

  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@example.com";
  
  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: emailBody,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(command);
    console.log(`RFP email sent to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send RFP email to ${toEmail}:`, error);
    throw error;
  }
}

/**
 * Send RFP question notification email to project contact
 */
export async function sendRFPQuestionEmail(
  user: User,
  rfpQuestion: RFPQuestion
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";
  const projectUrl = `${baseUrl}/projects/${rfpQuestion.rfp.projectId}/rfp`;

  const subject = `New RFP Question: ${rfpQuestion.rfp.project.name}`;
  const emailBody = `A vendor has posted a new question for the RFP "${rfpQuestion.rfp.project.name}":\n\n"${rfpQuestion.question}"\n\nPlease review and answer the question:\n${projectUrl}`;

  const toEmail = user.email;
  const toName = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  if (isDevelopment) {
    // Log email details in development
    console.log("\n📧 RFP Question Email (DEV MODE - Not Sent):");
    console.log(`To: ${toName} <${toEmail}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${emailBody}`);
    console.log(`Project Link: ${projectUrl}\n`);
    return;
  }

  // Send via AWS SES in production
  if (!sesClient) {
    throw new Error("SES client not initialized. Check AWS credentials.");
  }

  const fromEmail = process.env.AWS_SES_FROM_EMAIL || "noreply@example.com";
  
  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [toEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: emailBody,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(command);
    console.log(`RFP question email sent to ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send RFP question email to ${toEmail}:`, error);
    throw error;
  }
}

