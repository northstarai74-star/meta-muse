import { z } from "zod";
import { db } from "../db";
import { enqueue } from "../jobs";
import { getSettings } from "../settings";
import { pickHuman } from "../ingest";
import { replyToCommentById, sendDirectMessage } from "../messaging";
import { UserError } from "../errors";
import { STAGES, SERVICES } from "../constants";
import type { ToolName } from "./meta";
import type { AgentContext } from "./context";

/** Fields every tool call carries so the policy layer can gate it and the audit log can explain it. */
const common = {
  confidence: z.number().int().min(0).max(100).describe("0-100: how sure you are this action is correct, appropriate and safe to take without human review"),
  reasoning: z.string().max(300).describe("One or two sentences on why you are taking this action"),
};

const AGENT_STAGES = STAGES.filter((s) => s !== "WON") as unknown as [string, ...string[]];

export const SCHEMAS = {
  send_dm: z.object({
    text: z.string().min(1).max(900).describe("The Instagram DM to send. Max 3 short sentences, friendly, end with a clear next step."),
    ...common,
  }),
  reply_comment: z.object({
    comment_id: z.string().describe("The id of the comment (from the context) to reply to"),
    text: z.string().min(1).max(300).describe("Short public reply (1-2 sentences). Never put prices or personal details in public replies."),
    ...common,
  }),
  update_lead: z.object({
    stage: z.enum(AGENT_STAGES).optional().describe("New pipeline stage. WON is not allowed — a human records payment."),
    service: z.enum([...SERVICES, "UNASSIGNED"] as [string, ...string[]]).optional(),
    score: z.number().int().min(0).max(100).optional().describe("Purchase-intent score"),
    note: z.string().max(300).optional().describe("Internal note for the team"),
    ...common,
  }),
  schedule_followup: z.object({
    in_hours: z.number().int().min(1).max(168).describe("Wake the agent on this lead again in this many hours"),
    reason: z.string().max(200).describe("What to check or do when it wakes up"),
    ...common,
  }),
  escalate_to_human: z.object({
    reason: z.string().max(300).describe("Why a person must take over (what the prospect needs, deal size, sentiment…)"),
    ...common,
  }),
} satisfies Record<ToolName, z.ZodType>;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  send_dm: "Send an Instagram DM to the prospect in the current conversation.",
  reply_comment: "Reply publicly to one of the prospect's Instagram comments.",
  update_lead: "Update the lead's stage, service, score or add an internal note.",
  schedule_followup: "Schedule the agent to look at this lead again later (e.g. if the prospect goes quiet).",
  escalate_to_human: "Hand the lead over to a human team member. Use for high-value deals, complaints, requests for a person, legal/refund topics, or anything you are unsure about.",
};

export function availableTools(ctx: AgentContext): ToolName[] {
  const t: ToolName[] = [];
  if (ctx.conversation) t.push("send_dm");
  if (ctx.comments.length) t.push("reply_comment");
  if (ctx.lead) t.push("update_lead", "schedule_followup", "escalate_to_human");
  return t;
}

export function summarize(tool: ToolName, input: Record<string, unknown>): string {
  switch (tool) {
    case "send_dm":
      return `Send DM: “${input.text}”`;
    case "reply_comment":
      return `Reply to comment: “${input.text}”`;
    case "update_lead": {
      const bits = [input.stage && `stage → ${input.stage}`, input.service && `service → ${input.service}`, input.score !== undefined && `score → ${input.score}`, input.note && `note “${input.note}”`].filter(Boolean);
      return `Update lead: ${bits.join(", ") || "no change"}`;
    }
    case "schedule_followup":
      return `Follow up in ${input.in_hours}h: ${input.reason}`;
    case "escalate_to_human":
      return `Escalate to a human: ${input.reason}`;
  }
}

type Actor = { id: string; name: string } | null;
const by = (actor: Actor) => (actor ? ` (approved by ${actor.name})` : "");
const clip = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function note(leadId: string | undefined, type: string, text: string, userId?: string) {
  if (leadId) await db.activity.create({ data: { leadId, type, text, userId } });
}

type Executor = (ctx: AgentContext, input: Record<string, unknown>, actor: Actor, meta: { runLeadId?: string | null }) => Promise<string>;

export const EXECUTORS: Record<ToolName, Executor> = {
  async send_dm(ctx, input, actor) {
    if (!ctx.conversation) throw new UserError("No conversation to reply in");
    const settings = await getSettings();
    if (!settings.demoMode) {
      // Meta only allows free-form replies within 24h of the prospect's last message.
      const lastIn = [...ctx.conversation.messages].reverse().find((m) => m.direction === "IN");
      if (!lastIn || Date.now() - lastIn.sentAt.getTime() > 24 * 3600_000) {
        throw new UserError("Instagram only allows replies within 24 hours of the prospect's last message");
      }
    }
    const text = String(input.text);
    await sendDirectMessage(ctx.conversation.id, text);
    if (ctx.lead) {
      await note(ctx.lead.id, "AI", `AI agent sent a DM${by(actor)}: “${clip(text)}”`, actor?.id);
      if (ctx.lead.stage === "NEW") {
        await db.lead.update({ where: { id: ctx.lead.id }, data: { stage: "CONTACTED" } });
        await note(ctx.lead.id, "STAGE", "Stage → Contacted (first reply sent)");
      }
    }
    return "Message sent";
  },

  async reply_comment(ctx, input, actor) {
    const id = String(input.comment_id);
    if (!ctx.comments.some((c) => c.id === id)) throw new UserError("That comment is not part of this conversation");
    await replyToCommentById(id, String(input.text));
    await note(ctx.lead?.id, "AI", `AI agent replied to a comment${by(actor)}: “${clip(String(input.text))}”`, actor?.id);
    return "Reply posted";
  },

  async update_lead(ctx, input, actor) {
    const lead = ctx.lead;
    if (!lead) throw new UserError("No lead to update");
    const data: { stage?: string; service?: string; score?: number } = {};
    if (typeof input.stage === "string" && lead.stage !== "WON") data.stage = input.stage;
    if (typeof input.service === "string") data.service = input.service;
    if (typeof input.score === "number") data.score = input.score;
    if (Object.keys(data).length) await db.lead.update({ where: { id: lead.id }, data });
    const bits = [data.stage && `stage ${lead.stage} → ${data.stage}`, data.service && `service → ${data.service}`, data.score !== undefined && `score → ${data.score}`].filter(Boolean);
    if (bits.length) await note(lead.id, "AI", `AI agent updated lead${by(actor)}: ${bits.join(", ")}`, actor?.id);
    if (typeof input.note === "string" && input.note.trim()) await note(lead.id, "NOTE", `AI note: ${input.note.trim()}`);
    return bits.length ? `Updated ${bits.join(", ")}` : "Note added";
  },

  async schedule_followup(ctx, input, actor) {
    const lead = ctx.lead;
    if (!lead) throw new UserError("No lead to follow up on");
    const hours = Number(input.in_hours);
    await enqueue(
      "AGENT_RUN",
      { trigger: "FOLLOWUP", leadId: lead.id, conversationId: ctx.conversation?.id, reason: String(input.reason) },
      { runAt: new Date(Date.now() + hours * 3600_000), dedupeKey: `agent:followup:${lead.id}` },
    );
    await note(lead.id, "AI", `AI agent scheduled a follow-up in ${hours}h${by(actor)}: ${input.reason}`, actor?.id);
    return `Follow-up scheduled in ${hours}h`;
  },

  async escalate_to_human(ctx, input, actor) {
    const lead = ctx.lead;
    if (!lead) throw new UserError("No lead to escalate");
    const human = await pickHuman();
    await db.lead.update({ where: { id: lead.id }, data: { assignedAgent: "HUMAN", assignedUserId: human.userId } });
    await note(lead.id, "ASSIGNED", `AI agent escalated to ${human.name ?? "the team"}${by(actor)}: ${input.reason}`, actor?.id);
    return `Handed to ${human.name ?? "the team"}`;
  },
};
