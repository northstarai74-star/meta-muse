import { db } from "./db";
import { SERVICES } from "./constants";

const DAY = 86400_000;

type Row = { leads: number; won: number; lost: number; revenue: number };
const blank = (): Row => ({ leads: 0, won: 0, lost: 0, revenue: 0 });
const rate = (won: number, leads: number) => (leads ? Math.round((won / leads) * 100) : 0);

/** Performance of the leads captured in the last `rangeDays` days. */
export async function reportData(rangeDays: number) {
  const since = new Date(Date.now() - rangeDays * DAY);
  const [leads, users] = await Promise.all([
    db.lead.findMany({
      where: { createdAt: { gte: since } },
      select: {
        source: true, service: true, stage: true, createdAt: true, assignedAgent: true, assignedUserId: true, lostReason: true,
        deals: { where: { status: "PAID" }, select: { amount: true, paidAt: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true, avatarColor: true } }),
  ]);

  const bySource = new Map<string, Row>();
  const byService = new Map<string, Row>(SERVICES.map((s) => [s, blank()]));
  const byOwner = new Map<string, Row>();
  const lost = new Map<string, number>();
  const winDays: number[] = [];
  const totals = blank();

  const add = (m: Map<string, Row>, key: string, l: (typeof leads)[number], revenue: number) => {
    const r = m.get(key) ?? blank();
    r.leads++;
    if (l.stage === "WON") r.won++;
    if (l.stage === "LOST") r.lost++;
    r.revenue += revenue;
    m.set(key, r);
  };

  for (const l of leads) {
    const revenue = l.deals.reduce((s, d) => s + d.amount, 0);
    add(bySource, l.source, l, revenue);
    if (l.service !== "UNASSIGNED") add(byService, l.service, l, revenue);
    add(byOwner, l.assignedAgent === "AI" ? "AI" : (l.assignedUserId ?? "NONE"), l, revenue);
    totals.leads++;
    totals.revenue += revenue;
    if (l.stage === "WON") totals.won++;
    if (l.stage === "LOST") {
      totals.lost++;
      const k = l.lostReason || "Not recorded";
      lost.set(k, (lost.get(k) ?? 0) + 1);
    }
    const firstPaid = l.deals.map((d) => d.paidAt.getTime()).sort((a, b) => a - b)[0];
    if (l.stage === "WON" && firstPaid) winDays.push(Math.max(0, (firstPaid - l.createdAt.getTime()) / DAY));
  }

  // Revenue trend uses payments made in the period (regardless of when the lead was captured).
  const deals = await db.deal.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { amount: true, paidAt: true } });
  const bucket = rangeDays > 31 ? 7 : 1;
  const buckets = Math.ceil(rangeDays / bucket);
  const series = Array.from({ length: buckets }, (_, i) => {
    const start = Date.now() - (buckets - i) * bucket * DAY;
    const end = start + bucket * DAY;
    const revenue = deals.filter((d) => d.paidAt.getTime() >= start && d.paidAt.getTime() < end).reduce((s, d) => s + d.amount, 0);
    return { label: new Date(end - DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue };
  });

  const withRate = (key: string, r: Row) => ({ key, ...r, rate: rate(r.won, r.leads), avgDeal: r.won ? Math.round(r.revenue / r.won) : 0 });
  const userName = new Map(users.map((u) => [u.id, u]));

  return {
    totals: { ...totals, rate: rate(totals.won, totals.leads), open: totals.leads - totals.won - totals.lost, avgDeal: totals.won ? Math.round(totals.revenue / totals.won) : 0 },
    avgDaysToWin: winDays.length ? Math.round((winDays.reduce((a, b) => a + b, 0) / winDays.length) * 10) / 10 : null,
    bySource: [...bySource].map(([k, r]) => withRate(k, r)).sort((a, b) => b.leads - a.leads),
    byService: [...byService].map(([k, r]) => withRate(k, r)),
    byOwner: [...byOwner]
      .map(([k, r]) => ({ ...withRate(k, r), name: k === "AI" ? "AI agent" : k === "NONE" ? "Unassigned" : (userName.get(k)?.name ?? "Removed member"), color: userName.get(k)?.avatarColor }))
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads),
    lostReasons: [...lost].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    series,
  };
}
