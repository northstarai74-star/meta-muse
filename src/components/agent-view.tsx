"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, CircleSlash, Pencil, RefreshCw, ShieldAlert, X, Zap } from "lucide-react";
import { Button, Card, CardHeader, Empty, Input, Label, ScoreBadge, ServiceBadge, Textarea, Toggle } from "./ui";
import { cn, timeAgo } from "@/lib/utils";
import { LEVELS, TOOLS, TOOL_META, type Level, type ToolName } from "@/lib/agent/meta";
import type { AppSettings } from "@/lib/settings";

type Action = {
  id: string; tool: string; summary: string; input: Record<string, unknown>; reasoning: string | null; confidence: number; status: string; autonomy: string;
  note: string | null; createdAt: string; decidedBy: string | null; trigger: string; engine: string; leadId: string | null; contact: string | null;
  service: string | null; score: number | null; replyingTo: string | null;
};
type Run = { id: string; trigger: string; status: string; engine: string; tokens: number; summary: string | null; error: string | null; createdAt: string };
type Queue = {
  pending: number; running: number; failed: number; workerAlive: boolean; heartbeatAt: string | null;
  failedJobs: { id: string; type: string; attempts: number; error: string | null; at: string | null }[];
  recurring: { type: string; everyMin: number }[];
};
type Props = { isAdmin: boolean; settings: AppSettings; engine: "CLAUDE" | "OFFLINE"; stats: { executedToday: number; autoToday: number; tokens: number }; open: Action[]; log: Action[]; runs: Run[]; queue: Queue };

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

const TABS = ["approvals", "log", "controls", "system"] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLE: Record<string, string> = {
  EXECUTED: "bg-emerald-500/10 text-emerald-600",
  PENDING: "bg-amber-500/10 text-amber-600",
  FAILED: "bg-rose-500/10 text-rose-600",
  REJECTED: "bg-slate-500/10 text-slate-500",
  SKIPPED: "bg-slate-500/10 text-slate-500",
};
const TRIGGER_LABEL: Record<string, string> = { DM: "New DM", COMMENT: "New comment", LEAD: "New lead", STALE: "Gone quiet", FOLLOWUP: "Follow-up due", MANUAL: "Run manually" };
const LEVEL_LABEL: Record<Level, string> = { OFF: "Off", APPROVAL: "Ask me", AUTO: "Auto" };

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function Confidence({ value, min }: { value: number; min?: number }) {
  const low = min !== undefined && value < min;
  return (
    <span title={min !== undefined ? `Auto-act threshold: ${min}%` : undefined} className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums", low ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600")}>
      {value}% sure
    </span>
  );
}

export function AgentView({ isAdmin, settings, engine, stats, open, log, runs, queue }: Props) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("approvals");
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);
  const [s, setS] = React.useState(settings);
  const [seen, setSeen] = React.useState(settings);
  if (settings !== seen) {
    // fresh server props win over optimistic local edits
    setSeen(settings);
    setS(settings);
  }

  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 5000); };
  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try { await fn(); } catch (e) { flash(false, (e as Error).message); }
    setBusy("");
  }

  const decide = (a: Action, decision: "approve" | "reject", text?: string) =>
    run(a.id, async () => {
      const r = await api(`/api/agent/actions/${a.id}`, "POST", { decision, text });
      setEditing(null);
      if (r.status === "FAILED") flash(false, `Could not run: ${r.note}`);
      else if (r.status === "SKIPPED") flash(false, r.note);
      else flash(true, decision === "approve" ? "Approved and executed" : "Rejected");
      router.refresh();
    });

  async function save(patch: Partial<AppSettings>) {
    setS((c) => ({ ...c, ...patch, agentAutonomy: { ...c.agentAutonomy, ...patch.agentAutonomy } }));
    try { await api("/api/settings", "PUT", patch); router.refresh(); }
    catch (e) { setS(settings); flash(false, (e as Error).message); }
  }

  const pendingCount = open.filter((a) => a.status === "PENDING").length;
  const tabLabel: Record<Tab, string> = { approvals: `Approvals${pendingCount ? ` (${pendingCount})` : ""}`, log: "Activity log", controls: "Controls", system: "System" };
  const tokenPct = s.agentDailyTokenCap ? Math.min(100, Math.round((stats.tokens / s.agentDailyTokenCap) * 100)) : 0;

  return (
    <div className="space-y-5">
      {msg && <div role="status" className={cn("animate-in rounded-xl border px-4 py-3 text-sm", msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{msg.text}</div>}

      <Card className={cn("flex flex-wrap items-center gap-4 p-4", s.agentEnabled ? "border-emerald-500/30" : "border-amber-500/30")}>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.agentEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
          {s.agentEnabled ? <Zap size={18} /> : <CircleSlash size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{s.agentEnabled ? "Agent is on" : "Agent is paused"}</p>
          <p className="text-xs text-muted">
            {s.agentEnabled ? "Working AI-owned leads as messages arrive." : "Nothing runs and nothing new is queued. Pending approvals stay available."} Engine:{" "}
            <span className="font-medium text-fg">{engine === "CLAUDE" ? "Claude" : "Offline rules"}</span>
            {engine === "OFFLINE" && " (demo mode or no Claude key — confidence is conservative)"}
          </p>
        </div>
        <Toggle label="Agent enabled" checked={s.agentEnabled} onChange={(v) => isAdmin && save({ agentEnabled: v })} />
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Awaiting approval" value={String(pendingCount)} hint={pendingCount ? "Needs a decision" : "All clear"} tone={pendingCount ? "text-amber-600" : undefined} />
        <Stat label="Actions today" value={String(stats.executedToday)} hint={`${stats.autoToday} automatic · ${stats.executedToday - stats.autoToday} approved`} />
        <Stat label="Tokens today" value={stats.tokens.toLocaleString()} hint={`${tokenPct}% of ${s.agentDailyTokenCap.toLocaleString()} cap`} tone={tokenPct >= 90 ? "text-rose-600" : undefined} />
        <Stat label="Background jobs" value={`${queue.pending} queued`} hint={queue.failed ? `${queue.failed} failed` : queue.workerAlive ? "Worker running" : "Worker not running"} tone={queue.failed || !queue.workerAlive ? "text-rose-600" : undefined} />
      </div>

      <div role="tablist" className="inline-flex flex-wrap rounded-xl border bg-surface p-1">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("rounded-lg px-3.5 py-1.5 text-xs font-medium transition", tab === t ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg")}>
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {tab === "approvals" && (
        <div className="space-y-3">
          {open.length === 0 && <Card><Empty title="Nothing waiting" hint={s.agentEnabled ? "Proposals that need a human decision will show up here." : "Turn the agent on to start receiving proposals."} /></Card>}
          {open.map((a) => {
            const isMsg = a.tool === "send_dm" || a.tool === "reply_comment";
            const text = String(a.input.text ?? "");
            const isEditing = editing?.id === a.id;
            return (
              <Card key={a.id} className="animate-in p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 font-semibold text-accent">{TOOL_META[a.tool as ToolName]?.label ?? a.tool}</span>
                  {a.contact && (a.leadId ? <Link href={`/leads?open=${a.leadId}`} className="font-medium hover:text-accent">{a.contact}</Link> : <span className="font-medium">{a.contact}</span>)}
                  {a.service && <ServiceBadge service={a.service} />}
                  {a.score !== null && <ScoreBadge score={a.score} />}
                  <Confidence value={a.confidence} min={s.agentMinConfidence} />
                  <span className="text-muted">{TRIGGER_LABEL[a.trigger] ?? a.trigger} · {timeAgo(a.createdAt)}</span>
                  {a.status === "FAILED" && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-600">Failed</span>}
                </div>

                {a.replyingTo && (
                  <p className="mt-3 rounded-lg border-l-2 bg-surface-2/60 px-3 py-2 text-xs text-muted"><span className="font-medium text-fg">They said:</span> {a.replyingTo}</p>
                )}

                {isMsg ? (
                  isEditing ? (
                    <Textarea className="mt-3" rows={3} autoFocus value={editing.text} onChange={(e) => setEditing({ id: a.id, text: e.target.value })} />
                  ) : (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-accent/5 px-4 py-3 text-sm">{text}</p>
                  )
                ) : (
                  <p className="mt-3 text-sm">{a.summary}</p>
                )}

                {a.reasoning && <p className="mt-2 text-xs text-muted"><span className="font-medium">Why:</span> {a.reasoning}</p>}
                {a.note && <p className={cn("mt-1 flex items-center gap-1 text-xs", a.status === "FAILED" ? "text-rose-600" : "text-amber-600")}><AlertTriangle size={12} />{a.note}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="primary" disabled={busy === a.id || !editing.text.trim()} onClick={() => decide(a, "approve", editing.text.trim())}><Check size={14} /> Send edited</Button>
                      <Button size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" disabled={busy === a.id} onClick={() => decide(a, "approve")}><Check size={14} /> {a.status === "FAILED" ? "Retry" : "Approve"}</Button>
                      {isMsg && <Button size="sm" onClick={() => setEditing({ id: a.id, text })}><Pencil size={14} /> Edit</Button>}
                      <Button size="sm" disabled={busy === a.id} onClick={() => decide(a, "reject")}><X size={14} /> Reject</Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "log" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Actions" subtitle="Everything the agent did or proposed, newest first" />
            {log.length === 0 ? <Empty title="No activity yet" /> : (
              <ul className="divide-y border-t">
                {log.map((a) => (
                  <li key={a.id} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[a.status])}>{a.status === "EXECUTED" ? (a.autonomy === "AUTO" ? "Auto" : `Approved${a.decidedBy ? ` by ${a.decidedBy}` : ""}`) : a.status.charAt(0) + a.status.slice(1).toLowerCase()}</span>
                      <span className="font-medium">{a.contact ?? "—"}</span>
                      <Confidence value={a.confidence} />
                      <span className="ml-auto text-xs text-muted">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="mt-1 break-words">{a.summary}</p>
                    {(a.reasoning || a.note) && <p className="mt-0.5 text-xs text-muted">{[a.reasoning && `Why: ${a.reasoning}`, a.note].filter(Boolean).join(" · ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Runs" subtitle="Each time the agent looked at a lead" />
            {runs.length === 0 ? <Empty title="No runs yet" /> : (
              <ul className="divide-y border-t">
                {runs.map((r) => (
                  <li key={r.id} className="px-5 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", r.status === "OK" ? "bg-emerald-500" : r.status === "ERROR" ? "bg-rose-500" : "bg-slate-400")} />
                      <span className="font-medium">{TRIGGER_LABEL[r.trigger] ?? r.trigger}</span>
                      <span className="ml-auto text-muted">{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-muted">{r.error ?? r.summary}</p>
                    {r.tokens > 0 && <p className="text-muted">{r.tokens.toLocaleString()} tokens</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "controls" && (
        <div className="max-w-3xl space-y-5">
          {!isAdmin && <p className="rounded-xl border bg-surface-2 px-4 py-3 text-sm text-muted">Only admins can change agent controls.</p>}
          <Card>
            <CardHeader title="Autonomy per action" subtitle="Off: never used · Ask me: queued for approval · Auto: runs immediately (if confident enough and within limits)" />
            <ul className="divide-y border-t">
              {TOOLS.map((t) => (
                <li key={t} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">{TOOL_META[t].label}{TOOL_META[t].outbound && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">talks to customers</span>}</p>
                    <p className="text-xs text-muted">{TOOL_META[t].desc}</p>
                  </div>
                  <div role="radiogroup" aria-label={TOOL_META[t].label} className="inline-flex rounded-lg border bg-surface p-0.5">
                    {LEVELS.map((l) => (
                      <button key={l} role="radio" aria-checked={s.agentAutonomy[t] === l} disabled={!isAdmin} onClick={() => save({ agentAutonomy: { [t]: l } as Record<ToolName, Level> })}
                        className={cn("rounded-md px-3 py-1 text-xs font-medium transition disabled:opacity-60", s.agentAutonomy[t] === l ? (l === "AUTO" ? "bg-emerald-600 text-white" : l === "OFF" ? "bg-slate-500 text-white" : "bg-accent text-accent-fg") : "text-muted hover:text-fg")}>
                        {LEVEL_LABEL[l]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Safety limits" subtitle="Applied on top of the levels above. Hitting a limit never drops an action — it moves it to the approval queue." />
            <div className="grid gap-4 border-t px-5 py-4 sm:grid-cols-2">
              <NumberField label="Auto-act confidence threshold (%)" hint="Below this, Auto actions wait for approval" value={s.agentMinConfidence} min={0} max={100} disabled={!isAdmin} onSave={(v) => save({ agentMinConfidence: v })} />
              <NumberField label="Max automatic sends per day" hint="DMs + comment replies" value={s.agentDailySendCap} min={0} max={10000} disabled={!isAdmin} onSave={(v) => save({ agentDailySendCap: v })} />
              <NumberField label="Daily token budget" hint="The agent pauses planning when reached" value={s.agentDailyTokenCap} min={0} max={50000000} step={10000} disabled={!isAdmin} onSave={(v) => save({ agentDailyTokenCap: v })} />
              <NumberField label="Re-check silent leads after (hours)" hint="Stale-lead scan runs every 15 min" value={s.agentStaleHours} min={1} max={720} disabled={!isAdmin} onSave={(v) => save({ agentStaleHours: v })} />
            </div>
            <p className="border-t px-5 py-3 text-xs text-muted">Always on: max 4 automatic DMs per person per 24h, one outbound message per run, Instagram&apos;s 24-hour reply window (live mode), and the agent only works leads assigned to <em>AI agent</em> — change that per service on the Team page.</p>
          </Card>
        </div>
      )}

      {tab === "system" && (
        <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Background worker" subtitle="Runs webhook events, agent runs and scheduled jobs" action={<span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", queue.workerAlive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>{queue.workerAlive ? "Running" : "Not running"}</span>} />
            <dl className="grid grid-cols-3 gap-3 border-t px-5 py-4 text-center text-sm">
              <div><dt className="text-xs text-muted">Queued</dt><dd className="text-lg font-semibold tabular-nums">{queue.pending}</dd></div>
              <div><dt className="text-xs text-muted">Running</dt><dd className="text-lg font-semibold tabular-nums">{queue.running}</dd></div>
              <div><dt className="text-xs text-muted">Failed</dt><dd className={cn("text-lg font-semibold tabular-nums", queue.failed && "text-rose-600")}>{queue.failed}</dd></div>
            </dl>
            <div className="space-y-2 border-t px-5 py-4 text-xs text-muted">
              <p>Last heartbeat: {queue.heartbeatAt ? timeAgo(queue.heartbeatAt) : "never"}</p>
              <p>Scheduled: {queue.recurring.map((r) => `${r.type.toLowerCase().replace("_", " ")} every ${r.everyMin >= 60 ? `${r.everyMin / 60}h` : `${r.everyMin}m`}`).join(" · ")}</p>
              {!queue.workerAlive && <p className="text-rose-600">The worker starts with the server. On serverless hosting set <code>WORKER_DISABLED=1</code> and call <code>POST /api/jobs/tick</code> every minute with <code>Authorization: Bearer $CRON_SECRET</code>.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Failed jobs" subtitle="Retried automatically with backoff; these ran out of attempts" />
            {queue.failedJobs.length === 0 ? <div className="flex items-center gap-2 border-t px-5 py-6 text-sm text-muted"><CheckCircle2 size={16} className="text-emerald-600" /> No failed jobs</div> : (
              <ul className="divide-y border-t">
                {queue.failedJobs.map((j) => (
                  <li key={j.id} className="flex items-start gap-3 px-5 py-3 text-xs">
                    <ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{j.type} <span className="font-normal text-muted">· {j.attempts} attempts{j.at ? ` · ${timeAgo(j.at)}` : ""}</span></p>
                      <p className="break-words text-rose-600">{j.error}</p>
                    </div>
                    {isAdmin && <Button size="sm" disabled={busy === j.id} onClick={() => run(j.id, async () => { await api(`/api/jobs/${j.id}/retry`, "POST"); flash(true, "Job re-queued"); router.refresh(); })}><RefreshCw size={13} /> Retry</Button>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, hint, value, min, max, step = 1, disabled, onSave }: { label: string; hint: string; value: number; min: number; max: number; step?: number; disabled: boolean; onSave: (v: number) => void }) {
  const [v, setV] = React.useState(String(value));
  const [seen, setSeen] = React.useState(value);
  if (value !== seen) {
    setSeen(value);
    setV(String(value));
  }
  const commit = () => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < min || n > max) return setV(String(value));
    if (n !== value) onSave(n);
  };
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" min={min} max={max} step={step} value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

