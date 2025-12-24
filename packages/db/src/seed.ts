import { db } from "./index";
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";

async function main() {
  console.log("Seeding database...");

  // Create a global admin user (for development)
  const adminEmail = "admin@example.com";
  const adminPassword = "admin123";

  const existingAdmin = await db.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Global Admin",
        passwordHash,
        role: Role.GlobalAdministrator,
      },
    });
    console.log(`Created global admin: ${adminEmail} / ${adminPassword}`);
  }

  // Create default RFI email template
  const emailTemplateId = "rfi-default-email-template";
  const existingEmailTemplate = await db.template.findUnique({
    where: { id: emailTemplateId },
  });

  if (!existingEmailTemplate) {
    await db.template.create({
      data: {
        id: emailTemplateId,
        name: "Default RFI Email Template",
        content: `Dear Vendor,

We would like to invite you to participate in our Request for Information (RFI) for {PROJECT_NAME}.

Please review the information below and complete the questionnaire by the deadline specified.

Thank you for your participation.`,
        isGlobal: true,
      },
    });
    console.log("Created default RFI email template");
  }

  // Create default RFI information template
  const rfiInfoTemplateId = "rfi-default-information-template";
  const existingRfiInfoTemplate = await db.template.findUnique({
    where: { id: rfiInfoTemplateId },
  });

  if (!existingRfiInfoTemplate) {
    await db.template.create({
      data: {
        id: rfiInfoTemplateId,
        name: "Default RFI Information Template",
        content: `<h2>Project Overview</h2>
<p>{PROJECT_DESCRIPTION}</p>

<h2>Purpose of this RFI</h2>
<p>This Request for Information is designed to gather preliminary information about your organization and capabilities.</p>

<h2>Instructions</h2>
<p>Please answer all questions thoroughly and submit your response by the deadline.</p>`,
        isGlobal: true,
      },
    });
    console.log("Created default RFI information template");
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

