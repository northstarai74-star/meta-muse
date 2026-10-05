"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";
import { Button, Card, CardHeader, Empty, Input, Label, Modal } from "./ui";
import { EntityDialog, RowActions, StatCard, Tabs, dlgKey, ops } from "./biz";
import { IncomeExpenseBars } from "./charts";
import { FIELDS, today } from "@/lib/fields";
import { LINE_LABEL } from "@/lib/constants";
import { cn, money } from "@/lib/utils";

type Entry = { id: string; type: "INCOME" | "EXPENSE"; category: string; amount: number; businessLine: string; note: string; occurredAt: string };
type Reserve = { id: string; name: string; target: number; balance: number; moves: { id: string; delta: number; note: string; at: string }[] };

export function FinanceView({ days, kpis, breakdown, lines, months, entries, reserves }: {
  days: number;
  kpis: { income: number; expenses: number; net: number; margin: number; reserveBalance: number; reserveTarget: number; reservePct: number; monthlyBurn: number; runwayMonths: number | null };
  breakdown: { label: string; income: number; expenses: number }[];
  lines: { line: string; income: number; expenses: number; net: number }[];
  months: { label: string; income: number; expenses: number }[];
  entries: Entry[]; reserves: Reserve[];
}) {
  const [tab, setTab] = React.useState<"ledger" | "reserves">("ledger");
  const [entryDlg, setEntryDlg] = React.useState<{ type: "INCOME" | "EXPENSE"; id?: string } | null>(null);
  const [reserveDlg, setReserveDlg] = React.useState<{ id?: string } | null>(null);
  const [move, setMove] = React.useState<{ reserve: Reserve; direction: "DEPOSIT" | "WITHDRAW" } | null>(null);
  const editing = entryDlg?.id ? entries.find((e) => e.id === entryDlg.id) : undefined;
  const editingReserve = reserveDlg?.id ? reserves.find((r) => r.id === reserveDlg.id) : undefined;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-xl border bg-surface p-1">
          {[30, 90, 365].map((d) => (
            <Link key={d} href={`/finance?range=${d}`} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", days === d ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}>{d === 365 ? "12 months" : `${d} days`}</Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Income" value={money(kpis.income)} />
        <StatCard label="Expenses" value={money(kpis.expenses)} />
        <StatCard label="Net profit" value={money(kpis.net)} tone={kpis.net >= 0 ? "good" : "bad"} sub={`${kpis.margin}% margin`} />
        <StatCard label="Reserves" value={money(kpis.reserveBalance)} sub={kpis.reserveTarget ? `${kpis.reservePct}% of ${money(kpis.reserveTarget)} target` : "No targets set"} />
        <StatCard label="Monthly spend" value={money(kpis.monthlyBurn)} sub="avg over this period" />
        <StatCard label="Runway" value={kpis.runwayMonths === null ? "—" : `${kpis.runwayMonths.toFixed(1)} mo`} tone={kpis.runwayMonths !== null && kpis.runwayMonths < 3 ? "bad" : undefined} sub="reserves ÷ monthly spend" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Income vs expenses" subtitle="By month" />
          <div className="px-3 pb-4">{months.length ? <IncomeExpenseBars data={months} /> : <Empty title="No money recorded in this period" />}</div>
        </Card>
        <Card>
          <CardHeader title="Where it comes from" subtitle="Income and costs by source" />
          <table className="w-full text-sm">
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.label} className="border-t">
                  <td className="px-5 py-2.5">{b.label}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-emerald-600">{b.income ? money(b.income) : ""}</td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-rose-600">{b.expenses ? `−${money(b.expenses)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-5 py-3 text-xs text-muted">Marketing spend comes from Campaigns, store costs from Orders — don&apos;t log them again here.</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="By business line" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y bg-surface-2/60 text-left text-xs text-muted"><th className="px-5 py-2.5 font-medium">Line</th><th className="px-3 py-2.5 text-right font-medium">Income</th><th className="px-3 py-2.5 text-right font-medium">Expenses</th><th className="px-5 py-2.5 text-right font-medium">Net</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.line} className="border-b last:border-0">
                  <td className="px-5 py-3 font-medium">{LINE_LABEL[l.line]}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(l.income)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{money(l.expenses)}</td>
                  <td className={cn("px-5 py-3 text-right font-medium tabular-nums", l.net < 0 ? "text-rose-600" : "text-emerald-600")}>{money(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs value={tab} onChange={setTab} items={[{ id: "ledger", label: "Ledger", count: entries.length }, { id: "reserves", label: "Reserves", count: reserves.length }]} />
          {tab === "ledger" ? (
            <div className="flex gap-2">
              <Button onClick={() => setEntryDlg({ type: "INCOME" })}><ArrowUpCircle size={16} className="text-emerald-600" /> Add income</Button>
              <Button onClick={() => setEntryDlg({ type: "EXPENSE" })}><ArrowDownCircle size={16} className="text-rose-600" /> Add expense</Button>
            </div>
          ) : <Button variant="primary" onClick={() => setReserveDlg({})}><Plus size={16} /> New reserve</Button>}
        </div>

        {tab === "ledger" ? (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", e.type === "INCOME" ? "bg-emerald-500" : "bg-rose-500")} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{e.category}{e.note && <span className="font-normal text-muted"> — {e.note}</span>}</p><p className="text-xs text-muted">{e.occurredAt} · {LINE_LABEL[e.businessLine]}</p></div>
                  <span className={cn("font-medium tabular-nums", e.type === "INCOME" ? "text-emerald-600" : "text-rose-600")}>{e.type === "INCOME" ? "+" : "−"}{money(e.amount)}</span>
                  <RowActions resource="finance" id={e.id} label={e.category} onEdit={() => setEntryDlg({ type: e.type, id: e.id })} />
                </li>
              ))}
            </ul>
            {entries.length === 0 && <Empty title="No manual entries in this period" hint="Log income and expenses that aren't already tracked by deals, the store or campaigns." />}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reserves.map((r) => {
              const pct = r.target ? Math.min(100, Math.round((r.balance / r.target) * 100)) : 0;
              return (
                <Card key={r.id} className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">Target {money(r.target)}</p></div>
                    <RowActions resource="reserves" id={r.id} label={r.name} onEdit={() => setReserveDlg({ id: r.id })} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{money(r.balance)}</p>
                  <div className="mt-2 h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} funded`}><div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-xs text-muted">{pct}% funded</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => setMove({ reserve: r, direction: "DEPOSIT" })}>Add money</Button>
                    <Button size="sm" onClick={() => setMove({ reserve: r, direction: "WITHDRAW" })} disabled={r.balance <= 0}>Withdraw</Button>
                  </div>
                  {r.moves.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted">
                      {r.moves.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="truncate">{m.at}{m.note && ` · ${m.note}`}</span><span className={cn("tabular-nums", m.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>{m.delta >= 0 ? "+" : "−"}{money(Math.abs(m.delta))}</span></li>)}
                    </ul>
                  )}
                </Card>
              );
            })}
            {reserves.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><Empty title="No reserves yet" hint="Create pots like Tax, Emergency or Ad budget and track how funded each one is." /></Card>}
          </div>
        )}
      </div>

      <EntityDialog
        key={dlgKey(entryDlg?.id, !!entryDlg) + (entryDlg?.type ?? "")}
        open={!!entryDlg}
        onClose={() => setEntryDlg(null)}
        title={`${entryDlg?.id ? "Edit" : "Add"} ${entryDlg?.type === "INCOME" ? "income" : "expense"}`}
        resource="finance"
        fields={FIELDS.finance(entryDlg?.type ?? "EXPENSE")}
        id={entryDlg?.id}
        extra={{ type: entryDlg?.type ?? "EXPENSE" }}
        initial={editing ? { amount: String(editing.amount), occurredAt: editing.occurredAt, category: editing.category, businessLine: editing.businessLine, note: editing.note } : { occurredAt: today(), businessLine: "GENERAL" }}
      />
      <EntityDialog
        key={"r" + dlgKey(reserveDlg?.id, !!reserveDlg)}
        open={!!reserveDlg}
        onClose={() => setReserveDlg(null)}
        title={reserveDlg?.id ? "Edit reserve" : "New reserve"}
        resource="reserves"
        fields={FIELDS.reserves}
        id={reserveDlg?.id}
        initial={editingReserve ? { name: editingReserve.name, target: String(editingReserve.target) } : { target: "0" }}
      />
      <MoveDialog key={move ? move.reserve.id + move.direction : "none"} move={move} onClose={() => setMove(null)} />
    </>
  );
}

function MoveDialog({ move, onClose }: { move: { reserve: Reserve; direction: "DEPOSIT" | "WITHDRAW" } | null; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [err, setErr] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await ops("POST", `/api/reserves/${move!.reserve.id}/move`, { amount: Number(amount), direction: move!.direction, note });
      onClose();
      router.refresh();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  }
  const dep = move?.direction === "DEPOSIT";
  return (
    <Modal open={!!move} onClose={onClose} title={`${dep ? "Add money to" : "Withdraw from"} ${move?.reserve.name ?? ""}`}>
      <form onSubmit={submit} className="space-y-3">
        <div><Label htmlFor="move-amount">Amount ($)</Label><Input id="move-amount" type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></div>
        <div><Label htmlFor="move-note">Note (optional)</Label><Input id="move-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={dep ? "e.g. 20% of October profit" : "e.g. Paid quarterly tax"} /></div>
        {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">{dep ? "Add money" : "Withdraw"}</Button></div>
      </form>
    </Modal>
  );
}
