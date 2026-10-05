import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Runs on every Vercel build (after `prisma migrate deploy`). Creates the first admin from
// ADMIN_EMAIL / ADMIN_PASSWORD only when the database has no users. Never modifies or wipes
// existing data, so it is safe to run repeatedly.
const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("bootstrap-admin: ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping");
    return;
  }
  if ((await db.user.count()) > 0) {
    console.log("bootstrap-admin: users already exist, skipping");
    return;
  }
  await db.user.create({
    data: { name: "Admin", email, passwordHash: await bcrypt.hash(password, 10), role: "ADMIN", title: "Founder" },
  });
  console.log(`bootstrap-admin: created admin ${email}`);
}

main().finally(() => db.$disconnect());
