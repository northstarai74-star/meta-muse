import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { convert, toInr } from "@/lib/currency";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { PageHeader } from "@/components/shell";
import { ExpensesView } from "@/components/expenses-view";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [me, settings, rows] = await Promise.all([
    getCurrentUser(),
    getSettings(),
    db.expense.findMany({ orderBy: { incurredAt: "desc" }, take: 200 }),
  ]);

  const month = rows.filter((e) => e.incurredAt >= monthStart);
  const cur = settings.displayCurrency;
  const byCategory = Object.entries(EXPENSE_CATEGORIES)
    .map(([key, label]) => ({
      key,
      label,
      amount: month.filter((e) => e.category === key).reduce((s, e) => s + convert(e.amount, e.currency, cur, settings), 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <PageHeader title="Costs" subtitle="Track what you spend so the dashboard can show profit, cost per client and how much of the monthly budget is left" />
      <ExpensesView
        isAdmin={me?.role === "ADMIN"}
        currency={cur}
        capInr={settings.monthlyBudgetInr}
        monthSpentInr={month.reduce((s, e) => s + toInr(e.amount, e.currency, settings), 0)}
        monthSpentShown={month.reduce((s, e) => s + convert(e.amount, e.currency, cur, settings), 0)}
        byCategory={byCategory}
        rows={rows.map((e) => ({ id: e.id, category: e.category, description: e.description, amount: e.amount, currency: e.currency, service: e.service, incurredAt: e.incurredAt.toISOString() }))}
      />
    </>
  );
}
