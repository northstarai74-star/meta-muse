import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });

  try {
    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal valid emails
    const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await bcrypt.compare(parsed.data.password, hash);
    if (!user || !ok) return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

    await createSession({ uid: user.id, role: user.role });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[login] failed:", err);
    return NextResponse.json({ error: setupHint(err) }, { status: 500 });
  }
}

/** Server-side setup problems get a short, secret-free hint so they can be fixed without digging through logs. */
function setupHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  const code = (err as { code?: string })?.code;
  if (msg.includes("SESSION_SECRET")) return "Server setup problem: SESSION_SECRET is not set.";
  if (code === "P2021" || code === "P2022" || /does not exist/i.test(msg))
    return "Server setup problem: database tables are missing. Run `npx prisma migrate deploy` and `npm run db:seed`.";
  if (code === "P1000") return "Server setup problem: the database rejected the username or password in DATABASE_URL.";
  if (code === "P1001" || code === "P1002" || /reach database|Environment variable not found|DATABASE_URL|must start with the protocol/i.test(msg))
    return "Server setup problem: cannot reach the database. Check DATABASE_URL.";
  return "Server error while signing in. Check the server logs.";
}
