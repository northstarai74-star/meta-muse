import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { queueStats, RECURRING } from "@/lib/jobs";
import { hasClaudeKey } from "@/lib/agent/planner";
import { tokensUsedToday } from "@/lib/agent/runner";
import { PageHeader } from "@/components/shell";
import { AgentView } from "@/components/agent-view";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => d?.toISOString() ?? null;

export default async function AgentPage() {
  const me = await getCurrentUser();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [settings, queue, claudeKey, tokens, open, log, runs, executedToday, autoToday] = await Promise.all([
    getSettings(),
    queueStats(),
    hasClaudeKey(),
    tokensUsedToday(),
    db.agentAction.findMany({
      where: { status: { in: ["PENDING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { lead: { include: { contact: { select: { name: true, instagramHandle: true } } } }, run: { select: { trigger: true, engine: true } } },
    }),
    db.agentAction.findMany({
      where: { status: { in: ["EXECUTED", "REJECTED", "SKIPPED"] } },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { lead: { include: { contact: { select: { name: true } } } }, run: { select: { trigger: true, engine: true } } },
    }),
    db.agentRun.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.agentAction.count({ where: { status: "EXECUTED", executedAt: { gte: dayStart } } }),
    db.agentAction.count({ where: { status: "EXECUTED", autonomy: "AUTO", executedAt: { gte: dayStart } } }),
  ]);

  // What the agent is responding to: latest inbound DM per conversation / the comment text.
  const convoIds = [...new Set(open.map((a) => a.conversationId).filter((x): x is string => !!x))];
  const commentIds = [...new Set(open.map((a) => a.commentId).filter((x): x is string => !!x))];
  const [inbound, comments, users] = await Promise.all([
    convoIds.length ? db.message.findMany({ where: { conversationId: { in: convoIds }, direction: "IN" }, orderBy: { sentAt: "desc" }, take: 200 }) : [],
    commentIds.length ? db.comment.findMany({ where: { id: { in: commentIds } } }) : [],
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const lastIn = new Map<string, string>();
  for (const m of inbound) if (!lastIn.has(m.conversationId)) lastIn.set(m.conversationId, m.text);
  const commentText = new Map(comments.map((c) => [c.id, c.text]));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const shape = (a: (typeof open)[number] | (typeof log)[number]) => ({
    id: a.id,
    tool: a.tool,
    summary: a.summary,
    input: JSON.parse(a.input || "{}") as Record<string, unknown>,
    reasoning: a.reasoning,
    confidence: a.confidence,
    status: a.status,
    autonomy: a.autonomy,
    note: a.note,
    createdAt: a.createdAt.toISOString(),
    decidedBy: a.decidedById ? (userName.get(a.decidedById) ?? null) : null,
    trigger: a.run.trigger,
    engine: a.run.engine,
    leadId: a.leadId,
    contact: a.lead?.contact.name ?? null,
    service: a.lead?.service ?? null,
    score: a.lead?.score ?? null,
    replyingTo: (a.conversationId && lastIn.get(a.conversationId)) || (a.commentId && commentText.get(a.commentId)) || null,
  });

  return (
    <>
      <PageHeader title="AI Agent" subtitle="What the agent proposes, what it did on its own, and the controls that keep it safe" />
      <AgentView
        isAdmin={me?.role === "ADMIN"}
        settings={settings}
        engine={!settings.demoMode && claudeKey ? "CLAUDE" : "OFFLINE"}
        stats={{ executedToday, autoToday, tokens }}
        open={open.map(shape)}
        log={log.map(shape)}
        runs={runs.map((r) => ({ id: r.id, trigger: r.trigger, status: r.status, engine: r.engine, tokens: r.inputTokens + r.outputTokens, summary: r.summary, error: r.error, createdAt: r.createdAt.toISOString() }))}
        queue={{
          pending: queue.pending,
          running: queue.running,
          failed: queue.failed,
          workerAlive: queue.workerAlive,
          heartbeatAt: iso(queue.heartbeatAt),
          failedJobs: queue.failedJobs.map((j) => ({ id: j.id, type: j.type, attempts: j.attempts, error: j.lastError, at: iso(j.finishedAt) })),
          recurring: RECURRING.map((r) => ({ type: r.type, everyMin: Math.round(r.everyMs / 60_000) })),
        }}
      />
    </>
  );
}
