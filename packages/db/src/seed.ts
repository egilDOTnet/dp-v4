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

