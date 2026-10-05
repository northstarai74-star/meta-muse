import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { beat, ensureRecurring, processDue } from "@/lib/jobs";
import { handlers } from "@/lib/worker";

export const maxDuration = 60;

// For hosts without a long-lived process (serverless): point a cron at this every minute.
// Authenticated with `Authorization: Bearer $CRON_SECRET`; excluded from the login proxy like the other /api routes.
async function tick(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await beat();
  await ensureRecurring();
  return NextResponse.json(await processDue(handlers, { budgetMs: 45_000 }));
}
export { tick as GET, tick as POST };
