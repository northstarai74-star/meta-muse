"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Empty, Input, Label, Select } from "./ui";
import { EXPENSE_CATEGORIES, SERVICE_META } from "@/lib/constants";
import { CURRENCIES, formatMoney, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Row = { id: string; category: string; description: string | null; amount: number; currency: string; service: string; incurredAt: string };

export function ExpensesView({ rows, byCategory, currency, capInr, monthSpentInr, monthSpentShown, isAdmin }: {
  rows: Row[]; byCategory: { key: string; label: string; amount: number }[]; currency: Currency;
  capInr: number; monthSpentInr: number; monthSpentShown: number; isAdmin: boolean;
}) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-CA");
  const [f, setF] = React.useState({ category: "TOOLS", description: "", amount: "", currency: "INR", service: "GENERAL", date: today });
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const pct = Math.round((monthSpentInr / capInr) * 100);
  const tone = pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const top = byCategory[0]?.amount || 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, amount: Number(f.amount), description: f.description || undefined }),
    });
    if (res.ok) { setF({ ...f, description: "", amount: "" }); router.refresh(); }
    else setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-1">
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Spent this month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatMoney(monthSpentShown, currency)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly budget used">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{pct}% of the {formatMoney(capInr, "INR")} monthly budget ({formatMoney(monthSpentInr, "INR")} spent)</p>
        </Card>

        <Card>
          <CardHeader title="This month by category" />
          {byCategory.length === 0 ? <Empty title="Nothing logged this month" hint="Add your tools, domains, inboxes and ads as you pay for them." /> : (
            <ul className="space-y-3 px-5 pb-5">
              {byCategory.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex justify-between"><span>{c.label}</span><span className="font-medium tabular-nums">{formatMoney(c.amount, currency)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(c.amount / top) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader title="Add a cost" />
            <form onSubmit={submit} className="space-y-3 px-5 pb-5">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Select id="exp-category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
                <div><Label>For</Label><Select id="exp-service" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="GENERAL">Whole business</option>{["AI_VOICE", "WEB_DEV", "DROPSHIPPING"].map((s) => <option key={s} value={s}>{SERVICE_META[s].short}</option>)}</Select></div>
                <div><Label>Amount</Label><Input id="exp-amount" type="number" min="0.01" step="any" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
                <div><Label>Currency</Label><Select id="exp-currency" value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
              </div>
              <div><Label>What was it?</Label><Input id="exp-description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Google Workspace inbox" /></div>
              <div><Label>Date</Label><Input id="exp-date" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
              <Button type="submit" variant="primary" className="w-full" disabled={busy}>Add cost</Button>
            </form>
          </Card>
        ) : <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can add or remove costs.</p>}
      </div>

      <Card className="overflow-hidden xl:col-span-2">
        <CardHeader title="All costs" subtitle="Most recent 200" />
        {rows.length === 0 ? <Empty title="No costs yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-y bg-surface-2/60 text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Date</th><th className="px-3 py-2.5 font-medium">Category</th><th className="px-3 py-2.5 font-medium">Details</th><th className="px-3 py-2.5 font-medium">For</th><th className="px-3 py-2.5 text-right font-medium">Amount</th><th className="w-10" /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2/50">
                    <td className="px-5 py-2.5 text-xs tabular-nums text-muted">{r.incurredAt.slice(0, 10)}</td>
                    <td className="px-3 py-2.5">{EXPENSE_CATEGORIES[r.category] ?? r.category}</td>
                    <td className="px-3 py-2.5 text-muted">{r.description ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs">{r.service === "GENERAL" ? "Whole business" : SERVICE_META[r.service]?.short}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatMoney(r.amount, r.currency as Currency)}</td>
                    <td className="px-2">{isAdmin && <button onClick={() => remove(r.id)} aria-label="Delete cost" className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
