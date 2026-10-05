import { db } from "./db";
import { SERVICES, STAGES } from "./constants";
import { convert, REVENUE_CURRENCY, toInr } from "./currency";
import { getSettings } from "./settings";

const DAY = 86400_000;

export async function dashboardStats(rangeDays: number) {
  const now = Date.now();
  const since = new Date(now - rangeDays * DAY);
  const prevSince = new Date(now - rangeDays * 2 * DAY);
  const today = new Date(now);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  // follow-ups are stored at noon UTC on their due date; fetch through the end of tomorrow so any timezone's "today" is covered
  const taskHorizon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2));
  const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

  const settings = await getSettings();
  const cur = settings.displayCurrency;
  const inCur = (n: number) => convert(n, REVENUE_CURRENCY, cur, settings);

  const [leads, prevLeads, deals, prevDeals, recent, activity, expenses, monthExpenses, openTasks] = await Promise.all([
    db.lead.findMany({ where: { createdAt: { gte: since } }, select: { service: true, stage: true, createdAt: true } }),
    db.lead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    db.deal.findMany({ where: { paidAt: { gte: since }, status: "PAID" } }),
    db.deal.findMany({ where: { paidAt: { gte: prevSince, lt: since }, status: "PAID" } }),
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      include: { contact: true, assignedUser: { select: { name: true, avatarColor: true } } },
    }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { lead: { include: { contact: true } } } }),
    db.expense.findMany({ where: { incurredAt: { gte: since } } }),
    db.expense.findMany({ where: { incurredAt: { gte: monthStart } } }),
    db.task.findMany({
      where: { done: false, dueAt: { lt: taskHorizon } },
      orderBy: { dueAt: "asc" },
      take: 30,
      include: { lead: { select: { id: true, title: true, contact: { select: { name: true } } } } },
    }),
  ]);

  const revenue = deals.reduce((s, d) => s + d.amount, 0);
  const prevRevenue = prevDeals.reduce((s, d) => s + d.amount, 0);
  const customers = new Set(deals.map((d) => d.leadId)).size;
  const prevCustomers = new Set(prevDeals.map((d) => d.leadId)).size;
  const won = leads.filter((l) => l.stage === "WON").length;

  const byService = SERVICES.map((s) => ({
    service: s,
    leads: leads.filter((l) => l.service === s).length,
    revenue: inCur(deals.filter((d) => d.service === s).reduce((a, d) => a + d.amount, 0)),
  }));

  const revenueShown = inCur(revenue);
  const spend = expenses.reduce((s, e) => s + convert(e.amount, e.currency, cur, settings), 0);
  const monthSpentInr = monthExpenses.reduce((s, e) => s + toInr(e.amount, e.currency, settings), 0);
  const finance = {
    currency: cur,
    revenue: revenueShown,
    spend,
    profit: revenueShown - spend,
    costPerClient: customers > 0 ? spend / customers : null,
    budget: {
      capInr: settings.monthlyBudgetInr,
      spentInr: monthSpentInr,
      pct: Math.round((monthSpentInr / settings.monthlyBudgetInr) * 100),
    },
  };
  const todayStr = today.toISOString().slice(0, 10);
  const tasks = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueAt.toISOString().slice(0, 10),
    when: (t.dueAt.toISOString().slice(0, 10) < todayStr ? "overdue" : t.dueAt.toISOString().slice(0, 10) === todayStr ? "today" : "soon") as "overdue" | "today" | "soon",
    leadId: t.lead.id,
    leadTitle: t.lead.title,
    contactName: t.lead.contact.name,
  }));
  const tasksDueCount = openTasks.filter((t) => t.dueAt < endOfToday).length;

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

  const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

  return {
    kpis: {
      totalLeads: { value: leads.length, delta: delta(leads.length, prevLeads) },
      dropshipping: { value: byService.find((b) => b.service === "DROPSHIPPING")!.leads },
      aiVoice: { value: byService.find((b) => b.service === "AI_VOICE")!.leads },
      webDev: { value: byService.find((b) => b.service === "WEB_DEV")!.leads },
      customers: { value: customers, delta: delta(customers, prevCustomers) },
      revenue: { value: revenueShown, delta: delta(revenue, prevRevenue) },
      conversion: { value: leads.length ? Math.round((won / leads.length) * 100) : 0 },
    },
    byService,
    finance,
    tasks,
    tasksDueCount,
    series,
    funnel,
    recent,
    activity,
  };
}
