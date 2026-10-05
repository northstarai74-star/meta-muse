import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().email().optional().or(z.literal("")), password: z.string().min(1) });

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;

const DUMMY_HASH = "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";

async function verifyWithEmail(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
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

export async function POST(req: Request) {
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

  const { email, password } = parsed.data;
  const user = email ? await verifyWithEmail(email, password) : await verifyPasswordOnly(password);
  if (!user) {
    return NextResponse.json({ error: email ? "Incorrect email or password" : "Incorrect password" }, { status: 401 });
  }

  resetRateLimit(ipKey);
  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true });
}
