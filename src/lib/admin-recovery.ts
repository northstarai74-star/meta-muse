import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { db } from "./db";

/** The example password from .env.example / the README. It may create the first admin, never recover one. */
export const PUBLISHED_DEFAULT_PASSWORD = "ChangeMe123!";

const DEFAULT_ADMIN_EMAIL = "admin@vanita.local";

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sign-in with the deployment's own ADMIN_EMAIL + ADMIN_PASSWORD (environment variables).
 *
 * - Empty database: creates the first admin (so a fresh deploy works without the seed script).
 * - Otherwise it is the recovery login: the ADMIN_EMAIL account is created, or reset to ADMIN_PASSWORD and
 *   the ADMIN role, so changing the variables in Vercel and redeploying always gets the owner back in.
 *   Refused while ADMIN_PASSWORD is still the published example password or shorter than 8 characters.
 *
 * `email` may be empty (password-only sign-in); if given it must be ADMIN_EMAIL.
 * Returns the admin user, or null when this isn't an environment-credential sign-in.
 */
export async function signInWithEnvAdmin(email: string | undefined, password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !sameSecret(password, expected)) return null;

  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  if (email && email.trim().toLowerCase() !== adminEmail) return null;

  const firstRun = (await db.user.count()) === 0;
  if (!firstRun && (expected === PUBLISHED_DEFAULT_PASSWORD || expected.length < 8)) {
    console.warn("[login] recovery login is disabled while ADMIN_PASSWORD is the example password or under 8 characters");
    return null;
  }

  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    // Already in sync: a normal sign-in, nothing to write.
    if (existing.role === "ADMIN" && (await bcrypt.compare(password, existing.passwordHash))) return existing;
    console.warn(`[login] recovery login: reset ${adminEmail} to ADMIN_PASSWORD`);
    return db.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  if (!firstRun) console.warn(`[login] recovery login: created admin ${adminEmail}`);
  return db.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      avatarColor: "#6366f1",
    },
  });
}
