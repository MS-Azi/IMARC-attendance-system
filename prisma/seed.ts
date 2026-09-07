import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@imarcprojects.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (!existing) {
    await prisma.admin.create({
      data: { email, passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Created admin ${email} — sign in and change the password.`);
  } else {
    console.log("Admin already exists, skipping.");
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, officeLat: 0, officeLng: 0, radiusMeters: 100, lateThreshold: "08:21", reportEmail: "imarcprojects1@gmail.com" },
    update: {},
  });
}

main().finally(() => prisma.$disconnect());
