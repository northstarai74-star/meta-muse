"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Empty, Input, Label, Select } from "./ui";
import { cn } from "@/lib/utils";

type Txn = { id: string; type: "INCOME" | "EXPENSE"; amount: number; category: string; note: string | null; date: string };
type Totals = { income: number; expenses: number; net: number };
type Data = { transactions: Txn[]; all: Totals; month: Totals };

const CATEGORIES = ["Client payment", "Subscriptions", "Ads", "Software", "Salaries", "Hosting", "Supplies", "Other"];
const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function FinanceView() {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ type: "EXPENSE", amount: "", category: CATEGORIES[0], note: "", date: new Date().toISOString().slice(0, 10) });

  const load = React.useCallback(async () => {
    const res = await fetch("/api/finance");
    if (res.ok) setData(await res.json());
  }, []);
  React.useEffect(() => {
    let live = true;
    fetch("/api/finance").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setData(d); });
    return () => { live = false; };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? "Could not save");
    setForm({ ...form, amount: "", note: "" });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/finance/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="This month" subtitle="Income, expenses and what's left" />
          <div className="grid grid-cols-3 gap-3 px-5 pb-5">
            {data && (
              <>
                <Stat label="Income" value={money(data.month.income)} className="text-emerald-600" />
                <Stat label="Expenses" value={money(data.month.expenses)} className="text-rose-600" />
                <Stat label="Net" value={money(data.month.net)} className={data.month.net >= 0 ? "text-emerald-600" : "text-rose-600"} />
              </>
            )}
          </div>
          {data && (
            <p className="px-5 pb-5 text-xs text-muted">All time: income {money(data.all.income)} · expenses {money(data.all.expenses)} · net {money(data.all.net)}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Add transaction" />
          <form onSubmit={add} className="space-y-3 px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </Select>
              </div>
              <div>
                <Label>Amount *</Label>
                <Input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full">Save transaction</Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transactions" subtitle="Most recent first" />
        <div className="overflow-x-auto px-5 pb-5">
          {data && data.transactions.length === 0 ? (
            <Empty title="No transactions yet" hint="Add income or an expense to start tracking." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-2 font-medium">Date</th><th className="font-medium">Category</th><th className="font-medium">Note</th><th className="text-right font-medium">Amount</th><th /></tr>
              </thead>
              <tbody>
                {data?.transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-2 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                    <td>{t.category}</td>
                    <td className="text-muted">{t.note}</td>
                    <td className={cn("text-right font-medium whitespace-nowrap", t.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>
                      {t.type === "INCOME" ? "+" : "−"}{money(t.amount)}
                    </td>
                    <td className="pl-2">
                      <button onClick={() => remove(t.id)} aria-label="Delete transaction" className="rounded p-1 text-muted hover:text-rose-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-base font-semibold", className)}>{value}</p>
    </div>
  );
}
