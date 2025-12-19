import { db } from "./index";
import { RFIVendorResponseStatus } from "@prisma/client";

async function main() {
  console.log("Creating mock RFI data for 'Neste prosjekt' project...");

  // Find the project
  const project = await db.project.findFirst({
    where: { name: { contains: "Neste prosjekt", mode: "insensitive" } },
    include: {
      RFI: {
        include: {
          questions: {
            include: {
              options: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      ProjectVendor: {
        include: {
          vendor: {
            include: {
              VendorContactPerson: {
                where: { isMainContact: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    console.error("Project 'Neste prosjekt' not found. Please create it first.");
    process.exit(1);
  }

  if (!project.RFI) {
    console.error("RFI not found for project. Please create RFI first.");
    process.exit(1);
  }

  if (project.RFI.questions.length === 0) {
    console.error("No questions found in RFI. Please add questions first.");
    process.exit(1);
  }

  if (project.ProjectVendor.length === 0) {
    console.error("No vendors found in project. Please add vendors first.");
    process.exit(1);
  }

  const rfi = project.RFI;
  const vendors = project.ProjectVendor;

  console.log(`Found ${vendors.length} vendors and ${rfi.questions.length} questions`);

  // Create vendor responses with different statuses
  const statuses: RFIVendorResponseStatus[] = ["Sent", "Sent", "Answered", "Answered", "Received"];
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    const mainContact = vendor.vendor.VendorContactPerson.find(c => c.isMainContact);

    if (!mainContact) {
      console.log(`Skipping vendor ${vendor.vendor.name} - no main contact`);
      continue;
    }

    // Check if response already exists
    const existingResponse = await db.rFIVendorResponse.findUnique({
      where: {
        rfiId_projectVendorId: {
          rfiId: rfi.id,
          projectVendorId: vendor.id,
        },
      },
    });

    if (existingResponse) {
      console.log(`Vendor response already exists for ${vendor.vendor.name}, skipping...`);
      continue;
    }

    const status = statuses[i % statuses.length];
    const sentAt = i < 2 ? twoDaysAgo : oneDayAgo;
    const answeredAt = status === "Answered" ? new Date(sentAt.getTime() + 12 * 60 * 60 * 1000) : null;

    // Create vendor response
    const vendorResponse = await db.rFIVendorResponse.create({
      data: {
        rfiId: rfi.id,
        projectVendorId: vendor.id,
        contactPersonId: mainContact.id,
        status,
        sentAt,
        answeredAt,
      },
    });

    console.log(`Created vendor response for ${vendor.vendor.name} with status ${status}`);

    // If answered, create mock answers for each question
    if (status === "Answered" && answeredAt) {
      for (const question of rfi.questions) {
        let answer: any = null;

        switch (question.type) {
          case "YesNo":
            answer = Math.random() > 0.5;
            break;
          case "SingleText":
            answer = `Sample answer for ${vendor.vendor.name} - ${question.title}`;
            break;
          case "MultilineText":
            answer = `This is a detailed response from ${vendor.vendor.name}.\n\nWe have experience in this area and can provide the following:\n- Point 1\n- Point 2\n- Point 3`;
            break;
          case "Dropdown":
            if (question.options && question.options.length > 0) {
              const randomOption = question.options[Math.floor(Math.random() * question.options.length)];
              answer = randomOption.value || randomOption.label;
            }
            break;
          case "MultipleChoice":
            if (question.options && question.options.length > 0) {
              const selectedOptions = question.options
                .filter(() => Math.random() > 0.5)
                .slice(0, Math.min(3, question.options.length))
                .map(opt => opt.value || opt.label);
              answer = selectedOptions.length > 0 ? selectedOptions : [question.options[0].value || question.options[0].label];
            }
            break;
          case "Scale":
            // Random scale value between 1 and 5 (or use scaleLabels if available)
            answer = Math.floor(Math.random() * 5) + 1;
            break;
          case "ContactDetails":
            answer = {
              name: `${mainContact.firstName} ${mainContact.lastName}`,
              email: mainContact.email,
              phone: mainContact.phone || "+47 123 45 678",
            };
            break;
        }

        if (answer !== null) {
          await db.rFIResponse.create({
            data: {
              vendorResponseId: vendorResponse.id,
              questionId: question.id,
              answer,
            },
          });
        }
      }
      console.log(`  Created answers for ${vendor.vendor.name}`);
    }
  }

  console.log("Mock RFI data creation complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });



