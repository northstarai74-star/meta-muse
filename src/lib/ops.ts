import { db } from "./db";

const DAY = 86400_000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const LOW_STOCK = 5;

const orderProfit = (o: { status: string; revenue: number; cost: number }) =>
  o.status === "REFUNDED" ? -o.cost : o.revenue - o.cost;

/** Dropshipping store: products, orders, profit. Refunded orders earn nothing and lose their cost. */
export async function storeStats() {
  const [products, orders] = await Promise.all([
    db.product.findMany({ orderBy: { createdAt: "desc" } }),
    db.storeOrder.findMany({ orderBy: { placedAt: "desc" }, take: 500 }),
  ]);
  const counted = orders.filter((o) => o.status !== "REFUNDED");
  const revenue = sum(counted.map((o) => o.revenue));
  const profit = sum(orders.map(orderProfit));
  const byStatus = Object.fromEntries(["PENDING", "SHIPPED", "DELIVERED", "REFUNDED"].map((s) => [s, orders.filter((o) => o.status === s).length]));

  const perProduct = new Map<string, { name: string; units: number; profit: number }>();
  for (const o of orders) {
    const k = o.productId ?? o.productName;
    const r = perProduct.get(k) ?? { name: o.productName, units: 0, profit: 0 };
    if (o.status !== "REFUNDED") r.units += o.quantity;
    r.profit += orderProfit(o);
    perProduct.set(k, r);
  }
  return {
    products,
    orders,
    kpis: {
      revenue,
      profit,
      margin: pct(profit, revenue),
      orders: orders.length,
      toShip: byStatus.PENDING,
      stockValue: sum(products.map((p) => p.stock * p.cost)),
      refundRate: pct(byStatus.REFUNDED, orders.length),
    },
    byStatus,
    lowStock: products.filter((p) => p.status !== "PAUSED" && p.stock <= LOW_STOCK),
    top: [...perProduct.values()].sort((a, b) => b.profit - a.profit).slice(0, 5),
  };
}

export async function marketingStats() {
  const [campaigns, content] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.contentItem.findMany({ orderBy: [{ scheduledFor: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 200 }),
  ]);
  const spend = sum(campaigns.map((c) => c.spend));
  const leads = sum(campaigns.map((c) => c.leadsGenerated));
  const byChannel = new Map<string, { channel: string; spend: number; leads: number }>();
  for (const c of campaigns) {
    const r = byChannel.get(c.channel) ?? { channel: c.channel, spend: 0, leads: 0 };
    r.spend += c.spend;
    r.leads += c.leadsGenerated;
    byChannel.set(c.channel, r);
  }
  return {
    campaigns,
    content,
    kpis: {
      active: campaigns.filter((c) => c.status === "ACTIVE").length,
      spend,
      budget: sum(campaigns.filter((c) => c.status !== "DONE").map((c) => c.budget)),
      leads,
      cpl: leads ? spend / leads : 0,
      scheduled: content.filter((c) => c.status === "SCHEDULED").length,
    },
    byChannel: [...byChannel.values()].sort((a, b) => b.leads - a.leads),
  };
}

export async function clientStats() {
  const clients = await db.client.findMany({
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: { contact: { select: { id: true, name: true, email: true, company: true } } },
  });
  const active = clients.filter((c) => c.status === "ACTIVE");
  const soon = Date.now() + 30 * DAY;
  const byService = new Map<string, { service: string; clients: number; mrr: number }>();
  for (const c of active) {
    const r = byService.get(c.service) ?? { service: c.service, clients: 0, mrr: 0 };
    r.clients++;
    r.mrr += c.monthlyFee;
    byService.set(c.service, r);
  }
  return {
    clients,
    kpis: {
      active: active.length,
      mrr: sum(active.map((c) => c.monthlyFee)),
      arr: sum(active.map((c) => c.monthlyFee)) * 12,
      avgFee: active.length ? sum(active.map((c) => c.monthlyFee)) / active.length : 0,
      paused: clients.filter((c) => c.status === "PAUSED").length,
      churned: clients.filter((c) => c.status === "CHURNED").length,
      churnRate: pct(clients.filter((c) => c.status === "CHURNED").length, clients.length),
    },
    renewals: active.filter((c) => c.renewsAt && c.renewsAt.getTime() <= soon).sort((a, b) => a.renewsAt!.getTime() - b.renewsAt!.getTime()),
    byService: [...byService.values()],
  };
}

/**
 * Money in/out across the whole business over the last `rangeDays`.
 *   Income  = service revenue (paid deals) + store sales + manual income entries
 *   Expense = store product cost + marketing spend + manual expense entries
 * (Marketing spend is taken from Campaigns, so don't also log ad spend as a manual expense.)
 */
export async function financeStats(rangeDays: number) {
  const since = new Date(Date.now() - rangeDays * DAY);
  const [deals, orders, campaigns, entries, reserves] = await Promise.all([
    db.deal.findMany({ where: { status: "PAID", paidAt: { gte: since } }, select: { amount: true, service: true, paidAt: true } }),
    db.storeOrder.findMany({ where: { placedAt: { gte: since } }, select: { revenue: true, cost: true, status: true, placedAt: true } }),
    db.campaign.findMany({ where: { OR: [{ startsAt: { gte: since } }, { startsAt: null, createdAt: { gte: since } }] }, select: { spend: true, service: true, startsAt: true, createdAt: true } }),
    db.financeEntry.findMany({ where: { occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" } }),
    db.reserve.findMany({ orderBy: { createdAt: "asc" }, include: { moves: { orderBy: { createdAt: "desc" }, take: 5 } } }),
  ]);

  const manualIncome = sum(entries.filter((e) => e.type === "INCOME").map((e) => e.amount));
  const manualExpense = sum(entries.filter((e) => e.type === "EXPENSE").map((e) => e.amount));
  const serviceRevenue = sum(deals.map((d) => d.amount));
  const storeSales = sum(orders.filter((o) => o.status !== "REFUNDED").map((o) => o.revenue));
  // every order's product cost is spent, including refunded ones (the goods are gone)
  const storeCost = sum(orders.map((o) => o.cost));
  const marketing = sum(campaigns.map((c) => c.spend));

  const income = serviceRevenue + storeSales + manualIncome;
  const expenses = storeCost + marketing + manualExpense;

  // Per business line
  const line = (key: string) => {
    const inc =
      sum(deals.filter((d) => d.service === key).map((d) => d.amount)) +
      (key === "DROPSHIPPING" ? storeSales : 0) +
      sum(entries.filter((e) => e.type === "INCOME" && e.businessLine === key).map((e) => e.amount));
    const exp =
      (key === "DROPSHIPPING" ? storeCost : 0) +
      sum(campaigns.filter((c) => c.service === key).map((c) => c.spend)) +
      sum(entries.filter((e) => e.type === "EXPENSE" && e.businessLine === key).map((e) => e.amount));
    return { line: key, income: inc, expenses: exp, net: inc - exp };
  };
  const lines = ["AI_VOICE", "WEB_DEV", "DROPSHIPPING", "GENERAL"].map(line);
  // Campaigns for "ALL" services aren't tied to a line
  const sharedMarketing = sum(campaigns.filter((c) => c.service === "ALL").map((c) => c.spend));
  if (sharedMarketing) {
    const g = lines.find((l) => l.line === "GENERAL")!;
    g.expenses += sharedMarketing;
    g.net -= sharedMarketing;
  }

  // Monthly series (UTC months) for the chart
  const months = new Map<string, { label: string; income: number; expenses: number }>();
  const bucket = (d: Date) => {
    const k = d.toISOString().slice(0, 7);
    if (!months.has(k)) months.set(k, { label: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), income: 0, expenses: 0 });
    return months.get(k)!;
  };
  for (const d of deals) bucket(d.paidAt).income += d.amount;
  for (const o of orders) {
    if (o.status !== "REFUNDED") bucket(o.placedAt).income += o.revenue;
    bucket(o.placedAt).expenses += o.cost;
  }
  for (const c of campaigns) bucket(c.startsAt ?? c.createdAt).expenses += c.spend;
  for (const e of entries) bucket(e.occurredAt)[e.type === "INCOME" ? "income" : "expenses"] += e.amount;

  const reserveBalance = sum(reserves.map((r) => r.balance));
  const reserveTarget = sum(reserves.map((r) => r.target));
  const monthlyBurn = expenses / Math.max(1, rangeDays / 30);

  return {
    entries,
    reserves,
    kpis: {
      income, expenses, net: income - expenses, margin: pct(income - expenses, income),
      reserveBalance, reserveTarget, reservePct: pct(reserveBalance, reserveTarget),
      monthlyBurn,
      runwayMonths: monthlyBurn > 0 ? reserveBalance / monthlyBurn : null,
    },
    breakdown: [
      { label: "Service revenue (paid deals)", income: serviceRevenue, expenses: 0 },
      { label: "Dropshipping store", income: storeSales, expenses: storeCost },
      { label: "Marketing spend (campaigns)", income: 0, expenses: marketing },
      { label: "Other entries (manual)", income: manualIncome, expenses: manualExpense },
    ],
    lines,
    months: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
  };
}
