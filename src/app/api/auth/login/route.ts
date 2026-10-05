import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().email().optional().or(z.literal("")), password: z.string().min(1), remember: z.boolean().optional() });

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;

const DUMMY_HASH = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

async function verifyWithEmail(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
}

/**
 * First run on an empty database: ADMIN_PASSWORD (from the environment) creates the admin on first sign-in,
 * so a fresh deploy works without running the seed script.
 */
async function bootstrapAdmin(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || (await db.user.count()) > 0) return null;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return db.user.create({
    data: {
      name: "Admin",
      email: (process.env.ADMIN_EMAIL || "admin@vanita.local").toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      avatarColor: "#6366f1",
    },
  });
}

/** Email-less sign-in: the password alone identifies the account (admins are tried first). */
async function verifyPasswordOnly(password: string) {
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  let match: (typeof users)[number] | null = null;
  // Check every account (no early exit) so timing doesn't reveal which one matched
  for (const u of users) {
    if ((await bcrypt.compare(password, u.passwordHash)) && !match) match = u;
  }
  if (users.length === 0) await bcrypt.compare(password, DUMMY_HASH);
  return match;
}

async function handle(req: Request) {
  const ipKey = `login:ip:${clientIp(req)}`;
  const limited = rateLimit(ipKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your password (and a valid email if you use one)" }, { status: 400 });

  const { email, password, remember } = parsed.data;
  const user =
    (await bootstrapAdmin(password)) ?? (email ? await verifyWithEmail(email, password) : await verifyPasswordOnly(password));
  if (!user) {
    return NextResponse.json({ error: email ? "Incorrect email or password" : "Incorrect password" }, { status: 401 });
  }

  resetRateLimit(ipKey);
  await createSession({ uid: user.id, role: user.role }, remember ?? true);
  return NextResponse.json({ ok: true });
}

/** Turns setup problems (missing secret, unmigrated database) into a readable JSON error instead of an empty 500. */
export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("[login] failed", err);
    const msg = err instanceof Error ? err.message : "";
    const code = (err as { code?: string })?.code ?? "";
    let error = "Server error while signing in";
    if (msg.includes("SESSION_SECRET")) error = "Server setup incomplete: SESSION_SECRET is not set";
    else if (/^P(1|2021|2022)/.test(code) || /PrismaClientInitializationError/.test(String((err as Error)?.name)) || /DATABASE_URL/.test(msg))
      error = "Database isn't ready: check DATABASE_URL and run `npx prisma migrate deploy`";
    return NextResponse.json({ error }, { status: 500 });
  }
}
