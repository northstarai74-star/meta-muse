import { NextResponse } from "next/server";
import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { getConnection, safeEqual } from "@/lib/meta";
import { syncFromMeta } from "@/lib/sync";

export const maxDuration = 60;

/** Manual "Sync now" from Integrations. */
export const POST = route(
  async () => {
    const settings = await getSettings();
    if (settings.demoMode) return json({ error: "Turn off demo mode in Settings to sync from Meta" }, 400);
    return json(await syncFromMeta());
  },
  { admin: true },
);

/**
 * Scheduled sync (Vercel Cron, or any external scheduler). Catches DMs whose webhook delivery was lost.
 * Authenticated with `Authorization: Bearer $CRON_SECRET`, which Vercel Cron sends automatically.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, conn] = await Promise.all([getSettings(), getConnection()]);
  if (settings.demoMode) return NextResponse.json({ skipped: "demo mode" });
  if (!conn.pageId) return NextResponse.json({ skipped: "Meta page is not connected" });
  try {
    return NextResponse.json(await syncFromMeta());
  } catch (err) {
    console.error("[meta sync] scheduled sync failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
