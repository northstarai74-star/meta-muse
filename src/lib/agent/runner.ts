import { db } from "../db";
import { UserError } from "../errors";
import { getSettings, type AppSettings } from "../settings";
import { loadContext, type AgentContext } from "./context";
import { TOOLS, TOOL_META, type ToolName } from "./meta";
import { hasClaudeKey, planOffline, planWithClaude, type Plan, type Proposal } from "./planner";
import { EXECUTORS, SCHEMAS, availableTools, summarize } from "./tools";
import type { RunInput } from "./trigger";

const MAX_ACTIONS_PER_RUN = 4;
/** Hard ceiling on automatic DMs to one conversation per rolling 24h, regardless of the daily cap. */
const MAX_AUTO_DMS_PER_CONVERSATION = 4;

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const isTool = (t: string): t is ToolName => (TOOLS as readonly string[]).includes(t);

export async function tokensUsedToday() {
  const r = await db.agentRun.aggregate({ _sum: { inputTokens: true, outputTokens: true }, where: { createdAt: { gte: startOfDay() } } });
  return (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0);
}

async function autoSendsToday() {
  return db.agentAction.count({
    where: { status: "EXECUTED", autonomy: "AUTO", tool: { in: ["send_dm", "reply_comment"] }, executedAt: { gte: startOfDay() } },
  });
}

/**
 * Decides how a proposed action is handled. This is the single gate between "the model wants to do X"
 * and "X happens": per-tool autonomy level, confidence threshold, daily caps and per-conversation limits.
 */
async function route(tool: ToolName, confidence: number, settings: AppSettings, ctx: AgentContext) {
  const level = settings.agentAutonomy[tool];
  if (level === "OFF") return { status: "SKIPPED" as const, autonomy: "APPROVAL", note: "This tool is turned off in Controls" };
  if (level === "APPROVAL") return { status: "PENDING" as const, autonomy: "APPROVAL", note: "Waiting for approval" };

  if (confidence < settings.agentMinConfidence) {
    return { status: "PENDING" as const, autonomy: "APPROVAL", note: `Confidence ${confidence}% is below the ${settings.agentMinConfidence}% auto-act threshold` };
  }
  if (TOOL_META[tool].outbound) {
    if ((await autoSendsToday()) >= settings.agentDailySendCap) {
      return { status: "PENDING" as const, autonomy: "APPROVAL", note: `Daily auto-send cap (${settings.agentDailySendCap}) reached` };
    }
    if (tool === "send_dm" && ctx.conversation) {
      const recent = await db.agentAction.count({
        where: { conversationId: ctx.conversation.id, tool: "send_dm", status: "EXECUTED", autonomy: "AUTO", executedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      });
      if (recent >= MAX_AUTO_DMS_PER_CONVERSATION) {
        return { status: "PENDING" as const, autonomy: "APPROVAL", note: `Already sent ${recent} automatic DMs to this person in 24h` };
      }
    }
  }
  return { status: "PENDING" as const, autonomy: "AUTO", note: null as string | null };
}

export async function runAgent(input: RunInput, opts: { manual?: boolean } = {}) {
  const settings = await getSettings();
  if (!settings.agentEnabled) {
    if (opts.manual) throw new UserError("The AI agent is paused. Turn it on in Controls first.");
    return null;
  }

  const ctx = await loadContext(input);
  const ids = { leadId: ctx.lead?.id ?? input.leadId ?? null, conversationId: ctx.conversation?.id ?? input.conversationId ?? null, commentId: input.commentId ?? null };
  const skip = (summary: string) => db.agentRun.create({ data: { trigger: input.trigger, ...ids, status: "SKIPPED", engine: "-", summary } });

  if (!ctx.lead && !ctx.conversation && !ctx.comment) return skip("Nothing to act on (record was deleted)");
  if (!opts.manual) {
    if (ctx.lead && ctx.lead.assignedAgent !== "AI") return skip("Lead is owned by a human");
    if (input.trigger === "COMMENT" && ctx.comment?.handled) return skip("Comment was already handled");
    if (input.trigger === "DM") {
      const last = ctx.conversation?.messages.at(-1);
      if (!last || last.direction !== "IN") return skip("Nothing new from the prospect — already answered");
    }
  }
  if (await tokensUsedToday().then((used) => used >= settings.agentDailyTokenCap)) return skip(`Daily token cap (${settings.agentDailyTokenCap.toLocaleString()}) reached`);

  let plan: Plan;
  try {
    plan = (await hasClaudeKey()) && !settings.demoMode ? await planWithClaude(ctx, input, settings) : await planOffline(ctx, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.agentRun.create({ data: { trigger: input.trigger, ...ids, status: "ERROR", engine: "CLAUDE", model: settings.claudeModel, error: message.slice(0, 500), summary: "Planning failed" } });
    throw err; // the job queue retries with backoff
  }

  const run = await db.agentRun.create({
    data: { trigger: input.trigger, ...ids, status: "OK", engine: plan.engine, model: plan.model, inputTokens: plan.inputTokens, outputTokens: plan.outputTokens, summary: plan.summary },
  });

  const allowed = availableTools(ctx);
  let sent = false;
  const recorded: { id: string; status: string }[] = [];

  for (const p of plan.actions.slice(0, MAX_ACTIONS_PER_RUN)) {
    const base = { runId: run.id, leadId: ctx.lead?.id ?? null, conversationId: ctx.conversation?.id ?? null, commentId: p.input?.comment_id ? String(p.input.comment_id) : ctx.comment?.id ?? null };
    const reject = async (note: string, confidence = 0) =>
      db.agentAction.create({ data: { ...base, tool: p.tool.slice(0, 40), input: JSON.stringify(p.input ?? {}).slice(0, 4000), summary: `Rejected proposal: ${p.tool}`, confidence, status: "SKIPPED", autonomy: "APPROVAL", note } });

    if (!isTool(p.tool) || !allowed.includes(p.tool)) {
      await reject("Tool is not available in this context");
      continue;
    }
    const parsed = SCHEMAS[p.tool].safeParse(p.input);
    if (!parsed.success) {
      await reject(`Invalid tool input: ${parsed.error.issues.map((i) => i.message).join("; ").slice(0, 200)}`);
      continue;
    }
    const input2 = parsed.data as Record<string, unknown>;
    const confidence = Number(input2.confidence);
    const outbound = TOOL_META[p.tool].outbound;
    if (outbound && sent) {
      await reject("Only one outbound message per run", confidence);
      continue;
    }
    if (p.tool === "reply_comment" && !ctx.comments.some((c) => c.id === input2.comment_id)) {
      await reject("Comment does not belong to this prospect", confidence);
      continue;
    }

    const decision = await route(p.tool, confidence, settings, ctx);

    // A newer suggestion replaces an older one still waiting on the same thread.
    if (decision.status === "PENDING" && outbound) {
      await db.agentAction.updateMany({
        where: {
          status: "PENDING",
          tool: p.tool,
          ...(p.tool === "send_dm" ? { conversationId: base.conversationId } : { commentId: base.commentId }),
        },
        data: { status: "SKIPPED", note: "Superseded by a newer suggestion", decidedAt: new Date() },
      });
    }

    const action = await db.agentAction.create({
      data: {
        ...base,
        tool: p.tool,
        input: JSON.stringify(input2),
        summary: summarize(p.tool, input2),
        reasoning: String(input2.reasoning ?? ""),
        confidence,
        status: decision.status,
        autonomy: decision.autonomy,
        note: decision.note,
      },
    });
    if (outbound) sent = true;
    if (decision.status === "PENDING" && decision.autonomy === "AUTO") {
      const r = await executeAction(action.id, null);
      recorded.push({ id: action.id, status: r.status });
    } else recorded.push({ id: action.id, status: decision.status });
  }
  return { ...run, actions: recorded };
}

/** Executes a queued action (automatically, or on a human's approval). Never throws for execution failures — they are recorded. */
export async function executeAction(id: string, actor: { id: string; name: string } | null) {
  const a = await db.agentAction.findUnique({ where: { id } });
  if (!a) throw new UserError("Action not found", 404);
  if (a.status !== "PENDING" && a.status !== "FAILED") throw new UserError(`This action is already ${a.status.toLowerCase()}`, 409);
  if (!isTool(a.tool)) throw new UserError("Unknown tool");

  const ctx = await loadContext(a);
  const decided = actor ? { decidedById: actor.id, decidedAt: new Date() } : {};

  // A human replied (or the thread moved on) while this suggestion sat in the queue: don't talk over them.
  if (actor && a.tool === "send_dm" && ctx.conversation) {
    const talkedOver = ctx.conversation.messages.some((m) => m.direction === "OUT" && m.sentAt > a.createdAt);
    if (talkedOver) {
      return db.agentAction.update({ where: { id }, data: { ...decided, status: "SKIPPED", note: "A reply was already sent after this suggestion" } });
    }
  }

  try {
    const result = await EXECUTORS[a.tool](ctx, JSON.parse(a.input), actor, {});
    return await db.agentAction.update({ where: { id }, data: { ...decided, status: "EXECUTED", executedAt: new Date(), note: result } });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    console.error(`[agent] action ${id} (${a.tool}) failed:`, message);
    return db.agentAction.update({ where: { id }, data: { ...decided, status: "FAILED", note: message } });
  }
}

export async function rejectAction(id: string, actor: { id: string }) {
  const { count } = await db.agentAction.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "REJECTED", decidedById: actor.id, decidedAt: new Date(), note: "Rejected by a team member" },
  });
  if (!count) throw new UserError("This action can no longer be rejected", 409);
}

/** Lets a reviewer edit the outgoing text before approving. */
export async function editActionText(id: string, text: string) {
  const a = await db.agentAction.findUnique({ where: { id } });
  if (!a || (a.status !== "PENDING" && a.status !== "FAILED")) throw new UserError("This action can no longer be edited", 409);
  if (a.tool !== "send_dm" && a.tool !== "reply_comment") throw new UserError("Only messages can be edited");
  const input = { ...JSON.parse(a.input), text };
  const parsed = SCHEMAS[a.tool].safeParse(input);
  if (!parsed.success) throw new UserError(parsed.error.issues.map((i) => i.message).join("; "));
  await db.agentAction.update({ where: { id }, data: { input: JSON.stringify(parsed.data), summary: summarize(a.tool, parsed.data as Record<string, unknown>) } });
}

export type { Proposal };
