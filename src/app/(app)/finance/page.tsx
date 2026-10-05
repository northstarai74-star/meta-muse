import { getCurrentUser } from "@/lib/session";
import { financeStats } from "@/lib/ops";
import { PageHeader } from "@/components/shell";
import { Card, Empty } from "@/components/ui";
import { FinanceView } from "@/components/finance-view";

export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const me = await getCurrentUser();
  if (me?.role !== "ADMIN") {
    return (
      <>
        <PageHeader title="Finance & reserves" />
        <Card><Empty title="Admins only" hint="Ask an admin if you need access to the finance numbers." /></Card>
      </>
    );
  }
  const { range } = await searchParams;
  const days = [30, 90, 365].includes(Number(range)) ? Number(range) : 90;
  const s = await financeStats(days);

  return (
    <>
      <PageHeader title="Finance & reserves" subtitle="Income, expenses and the money you're setting aside" />
      <FinanceView
        days={days}
        kpis={s.kpis}
        breakdown={s.breakdown}
        lines={s.lines}
        months={s.months}
        entries={s.entries.map((e) => ({ id: e.id, type: e.type as "INCOME" | "EXPENSE", category: e.category, amount: e.amount, businessLine: e.businessLine, note: e.note ?? "", occurredAt: e.occurredAt.toISOString().slice(0, 10) }))}
        reserves={s.reserves.map((r) => ({ id: r.id, name: r.name, target: r.target, balance: r.balance, moves: r.moves.map((m) => ({ id: m.id, delta: m.delta, note: m.note ?? "", at: m.createdAt.toISOString().slice(0, 10) })) }))}
      />
    </>
  );
}
