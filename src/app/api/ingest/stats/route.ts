import { json, tokenRoute } from "@/lib/api";
import { dashboardStats } from "@/lib/stats";

/** Read-only snapshot for automations: `GET /api/ingest/stats?range=30` (7, 30 or 90 days). */
export const GET = tokenRoute(async (req) => {
  const range = Number(new URL(req.url).searchParams.get("range"));
  const s = await dashboardStats([7, 30, 90].includes(range) ? range : 30);
  return json({ kpis: s.kpis, byService: s.byService, funnel: s.funnel, finance: s.finance, tasksDue: s.tasksDueCount });
});
