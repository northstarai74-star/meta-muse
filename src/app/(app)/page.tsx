import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Banknote, Package, Mic, Globe, Users, BadgeCheck, TrendingUp, Wallet, PiggyBank, UserCheck } from "lucide-react";
import { dashboardStats } from "@/lib/stats";
import { PageHeader } from "@/components/shell";
import { Avatar, Card, CardHeader, Empty, ScoreBadge, ServiceBadge } from "@/components/ui";
import { Funnel, LeadsAreaChart, RevenueBars, ServiceDonut } from "@/components/charts";
import { FollowUps } from "@/components/follow-ups";
import { formatMoney } from "@/lib/currency";
import { SERVICE_META } from "@/lib/constants";
import { cn, money, timeAgo } from "@/lib/utils";

const RANGES = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
];

function Kpi({ label, value, delta, icon: Icon, tone, hint }: { label: string; value: string; delta?: number; icon: typeof Users; tone: string; hint?: string }) {
  return (
    <Card className="animate-in p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {delta !== undefined ? (
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(delta)}%
          </span>
        ) : null}
        <span className="text-muted">{hint ?? "vs previous period"}</span>
      </div>
    </Card>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const rangeDays = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;
  const s = await dashboardStats(rangeDays);
  const k = s.kpis;
  const f = s.finance;
  const cur = f.currency;
  const budgetTone = f.budget.pct >= 100 ? "bg-rose-500" : f.budget.pct >= 80 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Leads, revenue and spend across all three business lines"
        actions={
          <div className="inline-flex rounded-xl border bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r.v}
                href={`/?range=${r.v}`}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", rangeDays === r.v ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total leads" value={String(k.totalLeads.value)} delta={k.totalLeads.delta} icon={Users} tone="bg-indigo-500/10 text-indigo-600" />
        <Kpi label="Dropshipping leads" value={String(k.dropshipping.value)} icon={Package} tone="bg-amber-500/10 text-amber-600" hint="in selected period" />
        <Kpi label="Converted customers" value={String(k.customers.value)} delta={k.customers.delta} icon={BadgeCheck} tone="bg-emerald-500/10 text-emerald-600" />
        <Kpi label="Revenue" value={money(k.revenue.value, false, cur)} delta={k.revenue.delta} icon={Banknote} tone="bg-sky-500/10 text-sky-600" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="AI Voice leads" value={String(k.aiVoice.value)} icon={Mic} tone="bg-violet-500/10 text-violet-600" hint="in selected period" />
        <Kpi label="Web Dev leads" value={String(k.webDev.value)} icon={Globe} tone="bg-blue-500/10 text-blue-600" hint="in selected period" />
        <Kpi label="Lead → customer rate" value={`${k.conversion.value}%`} icon={TrendingUp} tone="bg-fuchsia-500/10 text-fuchsia-600" hint="leads marked won" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Spend" value={money(f.spend, false, cur)} icon={Wallet} tone="bg-rose-500/10 text-rose-600" hint="in selected period" />
        <Kpi label="Profit" value={money(f.profit, false, cur)} icon={PiggyBank} tone="bg-emerald-500/10 text-emerald-600" hint="revenue minus spend" />
        <Kpi label="Cost per client" value={f.costPerClient === null ? "—" : money(f.costPerClient, false, cur)} icon={UserCheck} tone="bg-orange-500/10 text-orange-600" hint="spend ÷ converted customers" />
        <Card className="animate-in p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Budget used this month</span>
            <Link href="/expenses" className="text-xs font-medium text-accent hover:underline">Costs</Link>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{f.budget.pct}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.min(f.budget.pct, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly budget used">
            <div className={cn("h-full rounded-full", budgetTone)} style={{ width: `${Math.min(f.budget.pct, 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{formatMoney(f.budget.spentInr, "INR")} of {formatMoney(f.budget.capInr, "INR")}</p>
        </Card>
      </div>

      <div className="mt-4">
        <FollowUps tasks={s.tasks} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Lead volume" subtitle="New leads per service" />
          <div className="px-3 pb-4">
            <LeadsAreaChart data={s.series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Leads by service" />
          <div className="px-4 pb-5">
            <ServiceDonut data={s.byService} />
            <ul className="mt-2 space-y-2">
              {s.byService.map((b) => (
                <li key={b.service} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVICE_META[b.service].color }} />
                    {SERVICE_META[b.service].label}
                  </span>
                  <span className="font-medium tabular-nums">{b.leads}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Revenue by service" />
          <div className="px-3 pb-4">
            <RevenueBars data={s.byService} currency={cur} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Pipeline" subtitle="Where leads are in the funnel" />
          <div className="px-5 pb-5">
            <Funnel data={s.funnel} />
          </div>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Recent activity" />
          <ul className="space-y-4 px-5 pb-5">
            {s.activity.length === 0 && <Empty title="No activity yet" />}
            {s.activity.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="leading-snug">
                    <span className="font-medium">{a.lead.contact.name}</span> <span className="text-muted">— {a.text}</span>
                  </p>
                  <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Latest leads" action={<Link href="/leads" className="text-xs font-medium text-accent hover:underline">View all</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-surface-2/60 text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Assigned</th>
                <th className="px-5 py-2.5 text-right font-medium">Captured</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-surface-2/50">
                  <td className="px-5 py-3">
                    <Link href={`/leads?open=${l.id}`} className="font-medium hover:text-accent">{l.contact.name}</Link>
                    <p className="max-w-xs truncate text-xs text-muted">{l.title}</p>
                  </td>
                  <td className="px-3 py-3"><ServiceBadge service={l.service} /></td>
                  <td className="px-3 py-3"><ScoreBadge score={l.score} /></td>
                  <td className="px-3 py-3">
                    {l.assignedAgent === "AI" ? (
                      <span className="text-xs font-medium text-violet-600">AI agent</span>
                    ) : l.assignedUser ? (
                      <span className="flex items-center gap-2"><Avatar name={l.assignedUser.name} color={l.assignedUser.avatarColor} size={22} />{l.assignedUser.name}</span>
                    ) : (
                      <span className="text-xs text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
