import Link from "next/link";
import { reportData } from "@/lib/reports";
import { PageHeader } from "@/components/shell";
import { Avatar, Card, CardHeader, Empty } from "@/components/ui";
import { RevenueTrend } from "@/components/charts";
import { SERVICE_META, SOURCE_META } from "@/lib/constants";
import { cn, money } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
  { v: 365, label: "12 months" },
];

type PerfRow = { key: string; leads: number; won: number; lost: number; rate: number; revenue: number; avgDeal: number };

function PerfTable({ title, subtitle, rows, label }: { title: string; subtitle: string; rows: PerfRow[]; label: (r: PerfRow) => React.ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {rows.length === 0 ? <Empty title="No leads in this period" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y bg-surface-2/60 text-left text-xs text-muted">
                <th className="px-5 py-2.5 font-medium"> </th>
                <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                <th className="px-3 py-2.5 text-right font-medium">Won</th>
                <th className="px-3 py-2.5 text-right font-medium">Win rate</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg deal</th>
                <th className="px-5 py-2.5 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{label(r)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.leads}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.won}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.rate}%</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.avgDeal ? money(r.avgDeal) : "—"}</td>
                  <td className="min-w-40 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-surface-2"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
                      <span className="w-16 text-right text-xs font-medium tabular-nums">{money(r.revenue)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const days = RANGES.some((r) => r.v === Number(range)) ? Number(range) : 30;
  const r = await reportData(days);
  const lostTotal = r.lostReasons.reduce((s, x) => s + x.count, 0);

  const stats = [
    { label: "Leads captured", value: String(r.totals.leads) },
    { label: "Won", value: String(r.totals.won), sub: `${r.totals.rate}% win rate` },
    { label: "Lost", value: String(r.totals.lost), sub: `${r.totals.open} still open` },
    { label: "Revenue", value: money(r.totals.revenue), sub: r.totals.avgDeal ? `${money(r.totals.avgDeal)} avg deal` : undefined },
    { label: "Avg days to win", value: r.avgDaysToWin === null ? "—" : String(r.avgDaysToWin), sub: "capture → first payment" },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="What's working: sources, services, team and why deals are lost"
        actions={
          <div className="inline-flex rounded-xl border bg-surface p-1">
            {RANGES.map((x) => (
              <Link key={x.v} href={`/reports?range=${x.v}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", days === x.v ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}>
                {x.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm font-medium text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</p>
            {s.sub && <p className="mt-1 text-xs text-muted">{s.sub}</p>}
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Revenue" subtitle="Payments received in this period" />
        <div className="px-3 pb-4"><RevenueTrend data={r.series} /></div>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PerfTable title="By source" subtitle="Which channel brings customers, not just leads" rows={r.bySource} label={(x) => SOURCE_META[x.key] ?? x.key} />
        <PerfTable title="By service" subtitle="Your three business lines" rows={r.byService} label={(x) => SERVICE_META[x.key]?.label ?? x.key} />
        <PerfTable
          title="By owner"
          subtitle="Leads currently assigned to each person or the AI agent"
          rows={r.byOwner}
          label={(x) => {
            const o = r.byOwner.find((y) => y.key === x.key)!;
            return <span className="flex items-center gap-2">{o.color && <Avatar name={o.name} color={o.color} size={22} />}{o.name}</span>;
          }}
        />
        <Card>
          <CardHeader title="Why leads are lost" subtitle="Recorded when a lead is moved to Lost" />
          {lostTotal === 0 ? <Empty title="No lost leads in this period" /> : (
            <ul className="space-y-3 px-5 pb-5">
              {r.lostReasons.map((x) => (
                <li key={x.reason}>
                  <div className="mb-1 flex justify-between text-sm"><span>{x.reason}</span><span className="font-medium tabular-nums">{x.count}</span></div>
                  <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-rose-500" style={{ width: `${(x.count / lostTotal) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
