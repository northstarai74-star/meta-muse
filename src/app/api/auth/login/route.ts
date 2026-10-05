import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60_000;

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
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !ok) return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  resetRateLimit(ipKey);
  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true });
}
