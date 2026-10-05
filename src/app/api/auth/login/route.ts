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
    // Usually a setup problem (missing .env / SESSION_SECRET, or an unmigrated / unseeded database)
    console.error("Login failed:", err);
    return NextResponse.json(
      { error: "Server error — check the DATABASE_URL and SESSION_SECRET environment variables and that migrations have been applied" },
      { status: 500 },
    );
  }
}
