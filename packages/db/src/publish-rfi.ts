import { db } from "./index";

async function main() {
  console.log("Publishing RFI for 'Neste prosjekt' project...");

  // Find the project
  const project = await db.project.findFirst({
    where: { name: { contains: "Neste prosjekt", mode: "insensitive" } },
    include: {
      RFI: true,
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

  const rfi = project.RFI;

  // Check if deadline is set
  if (!rfi.deadline) {
    console.error("RFI deadline is not set. Please set a deadline first.");
    process.exit(1);
  }

  // Publish the RFI
  await db.rFI.update({
    where: { id: rfi.id },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      unpublishedAt: null,
    },
  });

  console.log("RFI published successfully!");
  console.log(`Published at: ${new Date().toISOString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });




