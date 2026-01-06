import { db } from "./index";

async function main() {
  console.log("Finding project 'Neste prosjekt'...");

  // Find the project
  const project = await db.project.findFirst({
    where: {
      name: "Neste prosjekt",
    },
    include: {
      RFP: true,
    },
  });

  if (!project) {
    console.error("Project 'Neste prosjekt' not found");
    process.exit(1);
  }

  if (!project.RFP) {
    console.error("RFP not found for project 'Neste prosjekt'");
    process.exit(1);
  }

  console.log(`Found RFP: ${project.RFP.id}`);

  // Find all StartDate items
  const startDateItems = await db.rFPScheduleItem.findMany({
    where: {
      rfpId: project.RFP.id,
      type: "StartDate",
    },
    orderBy: {
      createdAt: "asc", // Keep the oldest one
    },
  });

  console.log(`Found ${startDateItems.length} StartDate items`);

  if (startDateItems.length <= 1) {
    console.log("No duplicates found. Exiting.");
    process.exit(0);
  }

  // Keep the first one, delete the rest
  const toKeep = startDateItems[0];
  const toDelete = startDateItems.slice(1);

  console.log(`Keeping item: ${toKeep.id} (created at ${toKeep.createdAt})`);
  console.log(`Deleting ${toDelete.length} duplicate(s)...`);

  for (const item of toDelete) {
    await db.rFPScheduleItem.delete({
      where: { id: item.id },
    });
    console.log(`Deleted item: ${item.id}`);
  }

  console.log("Cleanup complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });






