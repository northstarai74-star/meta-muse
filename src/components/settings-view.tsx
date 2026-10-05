"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Input, Label, Select, Toggle } from "./ui";
import { CURRENCIES, type Currency } from "@/lib/currency";

type S = { demoMode: boolean; autoAssign: boolean; claudeModel: string; displayCurrency: Currency; fxInrPerGbp: number; fxInrPerUsd: number; monthlyBudgetInr: number };

export function SettingsView({ settings, isAdmin }: { settings: S; isAdmin: boolean }) {
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [model, setModel] = React.useState(settings.claudeModel);
  const [err, setErr] = React.useState("");
  const [money, setMoney] = React.useState({ fxInrPerGbp: String(settings.fxInrPerGbp), fxInrPerUsd: String(settings.fxInrPerUsd), monthlyBudgetInr: String(settings.monthlyBudgetInr) });
  const saveNumber = (k: "fxInrPerGbp" | "fxInrPerUsd" | "monthlyBudgetInr") => {
    const n = Number(money[k]);
    if (Number.isFinite(n) && n > 0 && n !== s[k]) save({ [k]: n });
  };

  async function save(patch: Partial<S>) {
    setErr("");
    setS((cur) => ({ ...cur, ...patch }));
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) {
      setS(settings);
      setErr((await res.json().catch(() => ({}))).error ?? "Could not save");
    } else router.refresh();
  }

  const rows: { key: "demoMode" | "autoAssign"; title: string; desc: string }[] = [
    { key: "demoMode", title: "Demo mode", desc: "Uses built-in heuristics instead of calling Claude, and never sends messages through Meta. Turn off once Meta and a Claude key are connected." },
    { key: "autoAssign", title: "Auto-assign new leads", desc: "Route every new lead to an AI agent or team member using the rules on the Team page." },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can change settings.</p>}
      {err && <p role="alert" className="text-sm text-rose-600">{err}</p>}
      <Card>
        <CardHeader title="Workspace" />
        <ul className="divide-y px-5 pb-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-6 py-4">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted">{r.desc}</p>
              </div>
              <Toggle label={r.title} checked={s[r.key]} onChange={(v) => isAdmin && save({ [r.key]: v })} />
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Money" subtitle="Currency for dashboard totals, exchange rates and your monthly spending cap" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <div>
            <Label>Show dashboard totals in</Label>
            <Select id="set-currency" value={s.displayCurrency} disabled={!isAdmin} onChange={(e) => save({ displayCurrency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <Label>Monthly budget (₹)</Label>
            <Input id="set-budget" type="number" min="1" step="any" disabled={!isAdmin} value={money.monthlyBudgetInr} onChange={(e) => setMoney({ ...money, monthlyBudgetInr: e.target.value })} onBlur={() => saveNumber("monthlyBudgetInr")} />
          </div>
          <div>
            <Label>₹ per £1</Label>
            <Input id="set-fx-gbp" type="number" min="0.01" step="any" disabled={!isAdmin} value={money.fxInrPerGbp} onChange={(e) => setMoney({ ...money, fxInrPerGbp: e.target.value })} onBlur={() => saveNumber("fxInrPerGbp")} />
          </div>
          <div>
            <Label>₹ per $1</Label>
            <Input id="set-fx-usd" type="number" min="0.01" step="any" disabled={!isAdmin} value={money.fxInrPerUsd} onChange={(e) => setMoney({ ...money, fxInrPerUsd: e.target.value })} onBlur={() => saveNumber("fxInrPerUsd")} />
          </div>
          <p className="text-xs text-muted sm:col-span-2">Client payments are recorded in pounds (£). Exchange rates are manual: update them when the rate moves enough to matter. Changes save when you click away.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Claude" subtitle="Model used to classify leads and draft replies" />
        <div className="px-5 pb-5">
          <Label>Model ID</Label>
          <Input value={model} disabled={!isAdmin} onChange={(e) => setModel(e.target.value)} onBlur={() => model !== s.claudeModel && model.trim() && save({ claudeModel: model.trim() })} />
          <p className="mt-2 text-xs text-muted">Default: claude-sonnet-5-5. Changes save when you click away.</p>
        </div>
      </Card>
    </div>
  );
}
