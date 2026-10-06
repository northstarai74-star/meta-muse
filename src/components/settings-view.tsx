"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Input, Label, Toggle } from "./ui";

type S = { demoMode: boolean; autoAssign: boolean; aiAgent: boolean; claudeModel: string };

export function SettingsView({ settings, isAdmin, email }: { settings: S; isAdmin: boolean; email: string }) {
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

  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwMsg, setPwMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return setPwMsg({ ok: false, text: "New passwords don't match" });
    const res = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    if (res.ok) {
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password updated" });
    } else setPwMsg({ ok: false, text: (await res.json().catch(() => ({}))).error ?? "Could not change password" });
  }

  const rows: { key: "demoMode" | "autoAssign" | "aiAgent"; title: string; desc: string }[] = [
    { key: "demoMode", title: "Demo mode", desc: "Uses built-in heuristics instead of calling Claude, and never sends messages through Meta. Turn off once Meta and a Claude key are connected." },
    { key: "autoAssign", title: "Auto-assign new leads", desc: "Route every new lead to an AI agent or team member using the rules on the Team page." },
    { key: "aiAgent", title: "AI agent auto-replies", desc: "Leads assigned to the AI agent get an automatic DM reply. It hands the lead to a person when asked, when it's unsure, or after 4 replies. In demo mode replies are recorded but not sent." },
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
        <CardHeader title="Claude" subtitle="Model used to classify leads and draft replies" />
        <div className="px-5 pb-5">
          <Label>Model ID</Label>
          <Input value={model} disabled={!isAdmin} onChange={(e) => setModel(e.target.value)} onBlur={() => model !== s.claudeModel && model.trim() && save({ claudeModel: model.trim() })} />
          <p className="mt-2 text-xs text-muted">Default: claude-sonnet-5-5. Changes save when you click away.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Your account" subtitle={`Signed in as ${email}`} />
        <form onSubmit={changePassword} className="space-y-3 px-5 pb-5">
          <div><Label>Current password</Label><Input required type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>New password (min 8)</Label><Input required type="password" minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
            <div><Label>Confirm new password</Label><Input required type="password" minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          {pwMsg && <p role="status" className={pwMsg.ok ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>{pwMsg.text}</p>}
          <div className="flex justify-end"><Button type="submit" variant="primary">Change password</Button></div>
        </form>
      </Card>
    </div>
  );
}
