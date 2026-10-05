import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader } from "./ui";
import type { Connectivity, ProviderHealth } from "@/lib/connectivity";
import { cn, timeAgo } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "idle";

const DOT: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500", idle: "bg-slate-400" };
const TEXT: Record<Tone, string> = { ok: "text-emerald-600", warn: "text-amber-600", bad: "text-rose-600", idle: "text-muted" };

const NAMES: Record<string, string> = { META: "Meta tokens", CLAUDE: "Claude AI", HIGGSFIELD: "Higgsfield" };

function Row({ name, tone, status, detail, href }: { name: string; tone: Tone; status: string; detail?: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT[tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name}</p>
          {detail && <p className="truncate text-xs text-muted" title={detail}>{detail}</p>}
        </div>
        <span className={cn("text-xs font-semibold", TEXT[tone])}>{status}</span>
        <ArrowRight size={14} className="text-muted opacity-0 transition group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function providerRow(p: ProviderHealth, demoMode: boolean) {
  const optional = p.provider === "HIGGSFIELD";
  let tone: Tone;
  let status: string;
  if (p.total === 0) {
    tone = optional || (demoMode && p.provider === "CLAUDE") ? "idle" : "warn";
    status = optional ? "Not used" : demoMode && p.provider === "CLAUDE" ? "Offline mode" : "No keys";
  } else if (p.active > 0) {
    tone = p.rateLimited || p.disabled ? "warn" : "ok";
    status = `${p.active}/${p.total} active`;
  } else if (p.rateLimited > 0) {
    tone = "warn";
    status = "Rate limited";
  } else {
    tone = "bad";
    status = "All disabled";
  }
  const parts = [p.rateLimited && `${p.rateLimited} rate limited`, p.disabled && `${p.disabled} disabled`].filter(Boolean);
  return <Row key={p.provider} name={NAMES[p.provider] ?? p.provider} tone={tone} status={status} detail={p.lastError && tone !== "ok" ? p.lastError : parts.join(" · ") || undefined} href="/integrations" />;
}

export function ConnectionStatus({ data }: { data: Connectivity }) {
  const { meta, providers, demoMode, agent, jobs } = data;

  let webhook: { tone: Tone; status: string; detail: string };
  if (meta.webhookVerified) {
    webhook = { tone: "ok", status: "Connected", detail: meta.lastEventAt ? `Last event ${timeAgo(meta.lastEventAt)}` : "Verified — waiting for the first event" };
  } else if (meta.hasCredentials && meta.hasSecret) {
    webhook = { tone: "warn", status: "Not verified", detail: "Credentials saved — finish the webhook step in Meta" };
  } else {
    webhook = { tone: demoMode ? "idle" : "bad", status: "Setup needed", detail: "Add your Meta app credentials in Integrations" };
  }

  let tokenRow: { tone: Tone; status: string; detail?: string } | null = null;
  if (meta.token) {
    const daysLeft = meta.token.daysLeft;
    if (!meta.token.valid) tokenRow = { tone: "bad", status: "Invalid", detail: meta.token.error ?? "Meta rejected the saved token — paste a new one" };
    else if (daysLeft !== null && daysLeft <= 7) tokenRow = { tone: "warn", status: `Expires in ${Math.max(daysLeft, 0)}d`, detail: "Generate a new long-lived token" };
    else tokenRow = { tone: "ok", status: "Valid", detail: daysLeft === null ? "Does not expire" : `Expires in ${daysLeft} days` };
  }

  const agentTone: Tone = !agent.enabled ? "idle" : !jobs.workerAlive ? "bad" : agent.approvals ? "warn" : "ok";
  const agentStatus = !agent.enabled ? "Paused" : !jobs.workerAlive ? "Worker stopped" : agent.approvals ? `${agent.approvals} to approve` : "Active";
  const jobsTone: Tone = jobs.failed ? "bad" : jobs.workerAlive ? "ok" : "bad";

  return (
    <Card>
      <CardHeader
        title="Connections"
        subtitle={demoMode ? "Demo mode — events are simulated" : "Live — receiving real Meta events"}
        action={<Link href="/integrations" className="text-xs font-medium text-accent hover:underline">Manage</Link>}
      />
      <ul className="px-2 pb-3">
        <Row name="Meta webhook" href="/integrations" {...webhook} />
        <Row
          name="Meta DM sync"
          href="/integrations"
          tone={meta.lastSyncAt ? "ok" : "idle"}
          status={meta.lastSyncAt ? timeAgo(meta.lastSyncAt) : "Never synced"}
          detail={demoMode ? "Disabled in demo mode" : undefined}
        />
        {tokenRow && <Row name="Meta page token" href="/integrations" {...tokenRow} />}
        {providers.map((p) => providerRow(p, demoMode))}
        <Row name="AI agent" href="/agent" tone={agentTone} status={agentStatus} detail={agent.enabled ? undefined : "Turn on in AI Agent → Controls"} />
        <Row
          name="Background jobs"
          href="/agent"
          tone={jobsTone}
          status={jobs.failed ? `${jobs.failed} failed` : jobs.workerAlive ? "Running" : "Not running"}
          detail={jobs.workerAlive ? `${jobs.pending} queued` : "No heartbeat from the worker"}
        />
      </ul>
    </Card>
  );
}
