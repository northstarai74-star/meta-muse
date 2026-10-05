import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, DollarSign, Package, Mic, Globe, Users, BadgeCheck, TrendingUp } from "lucide-react";
import { dashboardStats } from "@/lib/stats";
import { connectivityStatus } from "@/lib/connectivity";
import { PageHeader } from "@/components/shell";
import { ConnectionStatus } from "@/components/connection-status";
import { LiveRefresh } from "@/components/live-refresh";
import { Avatar, Card, CardHeader, Empty, ScoreBadge, ServiceBadge } from "@/components/ui";
import { Funnel, LeadsAreaChart, RevenueBars, ServiceDonut } from "@/components/charts";
import { SERVICE_META } from "@/lib/constants";
import { cn, money, timeAgo } from "@/lib/utils";

const RANGES = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
];

function Kpi({ label, value, delta, icon: Icon, tone, hint, href }: { label: string; value: string; delta?: number; icon: typeof Users; tone: string; hint?: string; href: string }) {
  return (
    <Link href={href} aria-label={`${label}: ${value}`} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
    <Card className="animate-in h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
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
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const rangeDays = [7, 30, 90].includes(Number(range)) ? Number(range) : 30;
  const [s, conn] = await Promise.all([dashboardStats(rangeDays), connectivityStatus()]);
  const k = s.kpis;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Leads, conversions and revenue across all three business lines"
        actions={
          <>
          <LiveRefresh />
          <div className="inline-flex rounded-xl border bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r.v}
                href={`/?range=${r.v}`}
                scroll={false}
                className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", rangeDays === r.v ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}
              >
                {r.label}
              </Link>
            ))}
          </div>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total leads" value={String(k.totalLeads.value)} delta={k.totalLeads.delta} icon={Users} tone="bg-indigo-500/10 text-indigo-600" href="/leads" />
        <Kpi label="Dropshipping leads" value={String(k.dropshipping.value)} icon={Package} tone="bg-amber-500/10 text-amber-600" hint="in selected period" href="/leads?service=DROPSHIPPING" />
        <Kpi label="Converted customers" value={String(k.customers.value)} delta={k.customers.delta} icon={BadgeCheck} tone="bg-emerald-500/10 text-emerald-600" href="/contacts" />
        <Kpi label="Revenue" value={money(k.revenue.value)} delta={k.revenue.delta} icon={DollarSign} tone="bg-sky-500/10 text-sky-600" href="/leads?stage=WON" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Kpi label="AI Voice leads" value={String(k.aiVoice.value)} icon={Mic} tone="bg-violet-500/10 text-violet-600" hint="in selected period" href="/leads?service=AI_VOICE" />
        <Kpi label="Web Dev leads" value={String(k.webDev.value)} icon={Globe} tone="bg-blue-500/10 text-blue-600" hint="in selected period" href="/leads?service=WEB_DEV" />
        <Kpi label="Lead → customer rate" value={`${k.conversion.value}%`} icon={TrendingUp} tone="bg-fuchsia-500/10 text-fuchsia-600" hint="leads marked won" href="/leads?stage=WON" />
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
                <li key={b.service}>
                  <Link href={`/leads?service=${b.service}`} className="-mx-2 flex items-center justify-between rounded-lg px-2 py-1 text-sm transition hover:bg-surface-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERVICE_META[b.service].color }} />
                      {SERVICE_META[b.service].label}
                    </span>
                    <span className="font-medium tabular-nums">{b.leads}</span>
                  </Link>
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
            <RevenueBars data={s.byService} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Pipeline" subtitle="Where leads are in the funnel" />
          <div className="px-5 pb-5">
            <Funnel data={s.funnel} hrefBase="/leads?stage=" />
          </div>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Recent activity" />
          <ul className="space-y-4 px-5 pb-5">
            {s.activity.length === 0 && <Empty title="No activity yet" />}
            {s.activity.map((a) => (
              <li key={a.id}>
                <Link href={`/leads?open=${a.leadId}`} className="flex gap-3 text-sm hover:text-accent">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0">
                    <p className="leading-snug">
                      <span className="font-medium">{a.lead.contact.name}</span> <span className="text-muted">— {a.text}</span>
                    </p>
                    <p className="text-xs text-muted">{timeAgo(a.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
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
                  <td className="whitespace-nowrap px-3 py-3">
                    {l.assignedAgent === "AI" ? (
                      <span className="text-xs font-medium text-violet-600">AI agent</span>
                    ) : l.assignedUser ? (
                      <span className="flex items-center gap-2"><Avatar name={l.assignedUser.name} color={l.assignedUser.avatarColor} size={22} />{l.assignedUser.name}</span>
                    ) : (
                      <span className="text-xs text-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-muted">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ConnectionStatus data={conn} />
      </div>
    </>
  );
}
