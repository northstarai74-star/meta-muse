import { db } from "./db";
import { SERVICES, STAGES } from "./constants";

const DAY = 86400_000;

export async function dashboardStats(rangeDays: number) {
  const now = Date.now();
  const since = new Date(now - rangeDays * DAY);
  const prevSince = new Date(now - rangeDays * 2 * DAY);

  const [leads, prevLeads, deals, prevDeals, recent, activity, users] = await Promise.all([
    db.lead.findMany({ where: { createdAt: { gte: since } }, select: { id: true, service: true, stage: true, createdAt: true, source: true, assignedUserId: true } }),
    db.lead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    db.deal.findMany({ where: { paidAt: { gte: since }, status: "PAID" } }),
    db.deal.findMany({ where: { paidAt: { gte: prevSince, lt: since }, status: "PAID" } }),
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      include: { contact: true, assignedUser: { select: { name: true, avatarColor: true } } },
    }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { lead: { include: { contact: true } } } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  const revenue = deals.reduce((s, d) => s + d.amount, 0);
  const prevRevenue = prevDeals.reduce((s, d) => s + d.amount, 0);
  const customers = new Set(deals.map((d) => d.leadId)).size;
  const prevCustomers = new Set(prevDeals.map((d) => d.leadId)).size;
  const won = leads.filter((l) => l.stage === "WON").length;

  const byService = SERVICES.map((s) => ({
    service: s,
    leads: leads.filter((l) => l.service === s).length,
    revenue: deals.filter((d) => d.service === s).reduce((a, d) => a + d.amount, 0),
  }));

  // time series: daily up to 31 days, weekly beyond
  const bucket = rangeDays > 31 ? 7 : rangeDays > 14 ? 2 : 1;
  const buckets = Math.ceil(rangeDays / bucket);
  const series = Array.from({ length: buckets }, (_, i) => {
    const start = now - (buckets - i) * bucket * DAY;
    const end = start + bucket * DAY;
    const inB = leads.filter((l) => l.createdAt.getTime() >= start && l.createdAt.getTime() < end);
    return {
      label: new Date(end - DAY).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: inB.length,
      AI_VOICE: inB.filter((l) => l.service === "AI_VOICE").length,
      WEB_DEV: inB.filter((l) => l.service === "WEB_DEV").length,
      DROPSHIPPING: inB.filter((l) => l.service === "DROPSHIPPING").length,
    };
  });

  const funnel = STAGES.filter((s) => s !== "LOST").map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  // Team performance metrics
  const teamPerformance = users.map((u) => {
    const userLeads = leads.filter((l) => l.assignedUserId === u.id);
    const userWon = userLeads.filter((l) => l.stage === "WON").length;
    return {
      id: u.id,
      name: u.name,
      leadsAssigned: userLeads.length,
      leadsWon: userWon,
      conversionRate: userLeads.length ? Math.round((userWon / userLeads.length) * 100) : 0,
    };
  }).sort((a, b) => b.leadsWon - a.leadsWon);

  // Lead source effectiveness
  const bySource = SERVICES.reduce((acc, service) => {
    const serviceLeads = leads.filter((l) => l.service === service);
    const sources = new Set(serviceLeads.map((l) => l.source));
    sources.forEach((source) => {
      const sourceDeal = deals.find((d) => d.service === service && d.leadId === serviceLeads.find((l) => l.source === source)?.id);
      if (!acc[source]) acc[source] = { source, leads: 0, conversions: 0, revenue: 0 };
      acc[source].leads += serviceLeads.filter((l) => l.source === source).length;
      acc[source].conversions += sourceDeal ? 1 : 0;
      acc[source].revenue += sourceDeal?.amount ?? 0;
    });
    return acc;
  }, {} as Record<string, { source: string; leads: number; conversions: number; revenue: number }>);

  const sourceMetrics = Object.values(bySource).map((s) => ({
    ...s,
    conversionRate: s.leads ? Math.round((s.conversions / s.leads) * 100) : 0,
  }));

  const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

  return {
    kpis: {
      totalLeads: { value: leads.length, delta: delta(leads.length, prevLeads) },
      dropshipping: { value: byService.find((b) => b.service === "DROPSHIPPING")!.leads },
      aiVoice: { value: byService.find((b) => b.service === "AI_VOICE")!.leads },
      webDev: { value: byService.find((b) => b.service === "WEB_DEV")!.leads },
      customers: { value: customers, delta: delta(customers, prevCustomers) },
      revenue: { value: revenue, delta: delta(revenue, prevRevenue) },
      conversion: { value: leads.length ? Math.round((won / leads.length) * 100) : 0 },
    },
    byService,
    series,
    funnel,
    recent,
    activity,
    teamPerformance,
    sourceMetrics,
  };
}
