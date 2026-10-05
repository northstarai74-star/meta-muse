"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Input, Label, Toggle } from "./ui";

type S = { demoMode: boolean; autoAssign: boolean; claudeModel: string };

export function SettingsView({ settings, isAdmin }: { settings: S; isAdmin: boolean }) {
  const router = useRouter();
  const [s, setS] = React.useState(settings);
  const [model, setModel] = React.useState(settings.claudeModel);
  const [err, setErr] = React.useState("");

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
    { key: "demoMode", title: "Demo mode", desc: "Uses built-in heuristics instead of calling the AI model, and never sends messages through Meta. Turn off once Meta and an OpenRouter key are connected." },
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
        <CardHeader title="AI model" subtitle="OpenRouter model used to classify leads and draft replies" />
        <div className="px-5 pb-5">
          <Label>OpenRouter model slug</Label>
          <Input value={model} disabled={!isAdmin} onChange={(e) => setModel(e.target.value)} onBlur={() => model !== s.claudeModel && model.trim() && save({ claudeModel: model.trim() })} />
          <p className="mt-2 text-xs text-muted">Default: anthropic/claude-sonnet-5.5. Changes save when you click away.</p>
        </div>
      </Card>
    </div>
  );
}
