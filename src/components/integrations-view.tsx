"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FlaskConical, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Input, Label, Modal, Select, Toggle } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

type Key = { id: string; provider: string; label: string; keyHint: string; status: string; priority: number; usageCount: number; lastUsedAt: string | null; lastError: string | null };
type Meta = { appId: string; pageId: string; igBusinessId: string; verifyToken: string; hasSecret: boolean; hasToken: boolean; connected: boolean; lastSyncAt: string | null };

const PROVIDERS = [
  { id: "META", name: "Meta (Instagram / Facebook)", blurb: "Page access tokens used for DMs, comments and lead ads when no page token is saved above.", color: "bg-blue-500" },
  { id: "CLAUDE", name: "Claude (Anthropic)", blurb: "Lead qualification, auto-assignment and reply suggestions. Keys rotate round-robin; rate-limited keys are skipped.", color: "bg-orange-500" },
  { id: "HIGGSFIELD", name: "Higgsfield", blurb: "Image generation in Creative Studio. Enter each key as KEY_ID:KEY_SECRET from your Higgsfield dashboard.", color: "bg-fuchsia-500" },
];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button aria-label={`Copy ${label}`} onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}>
          {done ? <Check size={15} /> : <Copy size={15} />}
        </Button>
      </div>
    </div>
  );
}

export function IntegrationsView({ keys, meta, webhookUrl, isAdmin, demoMode }: { keys: Key[]; meta: Meta; webhookUrl: string; isAdmin: boolean; demoMode: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState("");
  const [adding, setAdding] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ label: "", secret: "", priority: "0" });
  const [mf, setMf] = React.useState({ appId: meta.appId, appSecret: "", pageId: meta.pageId, igBusinessId: meta.igBusinessId, accessToken: "" });

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 5000); };
  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try { await fn(); } catch (e) { flash(false, (e as Error).message); }
    setBusy("");
  }

  const saveMeta = (e: React.FormEvent) => { e.preventDefault(); run("meta", async () => { await api("/api/meta/connection", "PUT", mf); setMf({ ...mf, appSecret: "", accessToken: "" }); flash(true, "Meta settings saved"); router.refresh(); }); };
  const sync = () => run("sync", async () => { const r = await api("/api/meta/sync", "POST"); flash(true, `Imported ${r.imported} new messages`); router.refresh(); });
  const simulate = (type: string) => run("sim-" + type, async () => { await api("/api/meta/simulate", "POST", { type }); flash(true, "Simulated event processed — check Leads, Inbox or Comments"); router.refresh(); });
  const addKey = (e: React.FormEvent) => { e.preventDefault(); run("add", async () => { await api("/api/keys", "POST", { provider: adding, label: form.label, secret: form.secret, priority: Number(form.priority) || 0 }); setAdding(null); setForm({ label: "", secret: "", priority: "0" }); router.refresh(); }); };
  const testKey = (k: Key) => run(k.id, async () => { const r = await api(`/api/keys/${k.id}/test`, "POST"); flash(r.ok, r.detail); router.refresh(); });
  const toggleKey = (k: Key) => run(k.id, async () => { await api(`/api/keys/${k.id}`, "PATCH", { status: k.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }); router.refresh(); });
  const delKey = (k: Key) => { if (confirm(`Delete key “${k.label}”?`)) run(k.id, async () => { await api(`/api/keys/${k.id}`, "DELETE"); router.refresh(); }); };

  return (
    <div className="space-y-6">
      {msg && <div role="status" className={cn("animate-in rounded-xl border px-4 py-3 text-sm", msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{msg.text}</div>}
      {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can change integrations.</p>}

      <Card>
        <CardHeader
          title="Meta · Instagram & Lead Ads"
          subtitle={meta.connected ? "Webhook verified by Meta" : "Not verified yet — complete the steps below"}
          action={<span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{meta.connected ? "Connected" : "Setup needed"}</span>}
        />
        <div className="grid gap-6 px-5 pb-5 lg:grid-cols-2">
          <form onSubmit={saveMeta} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>App ID</Label><Input value={mf.appId} onChange={(e) => setMf({ ...mf, appId: e.target.value })} disabled={!isAdmin} /></div>
              <div><Label>App secret {meta.hasSecret && <span className="text-emerald-600">· saved</span>}</Label><Input type="password" placeholder={meta.hasSecret ? "••••••••  (leave blank to keep)" : ""} value={mf.appSecret} onChange={(e) => setMf({ ...mf, appSecret: e.target.value })} disabled={!isAdmin} autoComplete="off" /></div>
              <div><Label>Facebook Page ID</Label><Input value={mf.pageId} onChange={(e) => setMf({ ...mf, pageId: e.target.value })} disabled={!isAdmin} /></div>
              <div><Label>Instagram business ID</Label><Input value={mf.igBusinessId} onChange={(e) => setMf({ ...mf, igBusinessId: e.target.value })} disabled={!isAdmin} /></div>
            </div>
            <div><Label>Page access token {meta.hasToken && <span className="text-emerald-600">· saved</span>}</Label><Input type="password" placeholder={meta.hasToken ? "••••••••  (leave blank to keep)" : "Long-lived page token"} value={mf.accessToken} onChange={(e) => setMf({ ...mf, accessToken: e.target.value })} disabled={!isAdmin} autoComplete="off" /></div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={!isAdmin || busy === "meta"}>Save Meta settings</Button>
              <Button type="button" onClick={sync} disabled={!isAdmin || busy === "sync" || demoMode}><RefreshCw size={14} className={busy === "sync" ? "animate-spin" : ""} /> Sync DMs now</Button>
            </div>
            {meta.lastSyncAt && <p className="text-xs text-muted">Last sync {timeAgo(meta.lastSyncAt)}</p>}
          </form>

          <div className="space-y-3">
            <CopyField label="Webhook callback URL" value={webhookUrl} />
            <CopyField label="Verify token" value={meta.verifyToken} />
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>Create a Meta app (Business type) and add Instagram + Webhooks products.</li>
              <li>Expose this app over HTTPS (ngrok / Cloudflare tunnel) and set APP_URL in .env.</li>
              <li>Paste the callback URL and verify token into Meta&apos;s webhook settings; subscribe to <code>messages</code>, <code>comments</code> and <code>leadgen</code>.</li>
              <li>Save your App secret above (used to verify Meta&apos;s signature), then turn off demo mode in Settings.</li>
            </ol>
          </div>
        </div>
        {demoMode && isAdmin && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-amber-500/5 px-5 py-3">
            <FlaskConical size={15} className="text-amber-600" />
            <span className="mr-2 text-xs font-medium">Demo mode — simulate incoming Meta events:</span>
            {[["dm", "Instagram DM"], ["comment", "Comment"], ["leadad", "Lead ad"]].map(([t, l]) => (
              <Button key={t} size="sm" disabled={busy === "sim-" + t} onClick={() => simulate(t)}>{l}</Button>
            ))}
          </div>
        )}
      </Card>

      {PROVIDERS.map((p) => {
        const list = keys.filter((k) => k.provider === p.id);
        return (
          <Card key={p.id}>
            <CardHeader
              title={p.name}
              subtitle={p.blurb}
              action={isAdmin && <Button size="sm" onClick={() => { setAdding(p.id); setMsg(null); }}><Plus size={14} /> Add key</Button>}
            />
            <div className="px-5 pb-5">
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted">No keys yet. Add one to enable this integration.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {list.map((k) => (
                    <li key={k.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white", p.color)}><KeyRound size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{k.label} <span className="font-mono text-xs font-normal text-muted">····{k.keyHint}</span></p>
                        <p className="text-xs text-muted">
                          Priority {k.priority} · {k.usageCount} uses{k.lastUsedAt ? ` · last ${timeAgo(k.lastUsedAt)}` : ""}
                        </p>
                        {k.lastError && <p className="mt-0.5 truncate text-xs text-rose-600" title={k.lastError}>{k.lastError}</p>}
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", k.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600" : k.status === "RATE_LIMITED" ? "bg-amber-500/10 text-amber-600" : "bg-slate-500/10 text-slate-500")}>
                        {k.status === "RATE_LIMITED" ? "Rate limited" : k.status === "ACTIVE" ? "Active" : "Disabled"}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" disabled={busy === k.id} onClick={() => testKey(k)}>Test</Button>
                          <Toggle label={`Enable ${k.label}`} checked={k.status === "ACTIVE"} onChange={() => toggleKey(k)} />
                          <button onClick={() => delKey(k)} aria-label={`Delete ${k.label}`} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        );
      })}

      <Modal open={!!adding} onClose={() => setAdding(null)} title={`Add ${PROVIDERS.find((p) => p.id === adding)?.name ?? ""} key`}>
        <form onSubmit={addKey} className="space-y-3">
          <div><Label>Label</Label><Input required autoFocus placeholder="e.g. Main account, Backup 1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div><Label>API key / token</Label><Input required type="password" autoComplete="off" placeholder={adding === "HIGGSFIELD" ? "KEY_ID:KEY_SECRET" : ""} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /></div>
          <div>
            <Label>Priority (lower is used first)</Label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 0 ? " — primary" : ""}</option>)}
            </Select>
          </div>
          <p className="text-xs text-muted">Keys are encrypted at rest and never shown again — only the last 4 characters are displayed.</p>
          <div className="flex justify-end gap-2"><Button type="button" onClick={() => setAdding(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy === "add"}>Save key</Button></div>
        </form>
      </Modal>
    </div>
  );
}
