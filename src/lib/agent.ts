import { db } from "./db";
import { getSettings } from "./settings";
import { agentDecision, type AgentDecision } from "./ai/classify";
import { pickHuman } from "./ingest";
import { sendDirectMessage } from "./outbox";

/** After this many automatic replies on one lead, the agent stops and hands over to a person. */
export const MAX_AI_REPLIES = 4;

type Lead = { id: string; service: string; assignedUserId: string | null };

/** Moves a lead from the AI agent to a person (`ownerId`, else its current owner, else the routing rules) and logs why. */
export async function handOffToHuman(lead: Lead, reason: string, ownerId?: string) {
  const userId = ownerId ?? lead.assignedUserId ?? (await pickHuman(lead.service));
  await db.lead.update({ where: { id: lead.id }, data: { assignedAgent: "HUMAN", assignedUserId: userId } });
  const owner = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  await db.activity.create({
    data: {
      leadId: lead.id,
      type: "ASSIGNED",
      text: `AI agent handed off to ${owner?.name ?? "the team"}${reason ? ` — ${reason}` : ""}`,
    },
  });
}

/**
 * The AI agent: when the open lead behind a conversation is assigned to "AI", it answers the latest
 * inbound DM and decides whether a person should take over. Returns what it did (null = not its turn).
 */
export async function runAiAgent(conversationId: string): Promise<(AgentDecision & { sent: boolean }) | null> {
  const settings = await getSettings();
  if (!settings.aiAgent) return null;

  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { sentAt: "desc" }, take: 20 } },
  });
  if (!convo) return null;
  const history = [...convo.messages].reverse();
  if (history.at(-1)?.direction !== "IN") return null;

  const lead = await db.lead.findFirst({
    where: { contactId: convo.contactId, stage: { notIn: ["WON", "LOST"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead || lead.assignedAgent !== "AI") return null;

  const aiReplies = await db.message.count({ where: { conversationId, byAi: true, sentAt: { gte: lead.createdAt } } });
  let decision: AgentDecision =
    aiReplies >= MAX_AI_REPLIES
      ? { reply: "", handoff: true, reason: `reached the ${MAX_AI_REPLIES}-reply limit` }
      : await agentDecision(history);

  let sent = false;
  if (decision.reply) {
    try {
      await sendDirectMessage(conversationId, decision.reply, { byAi: true });
      sent = true;
    } catch (err) {
      console.error("[agent] could not send reply", err);
      decision = { ...decision, handoff: true, reason: `reply could not be sent (${err instanceof Error ? err.message : "error"})` };
    }
  }

  if (decision.handoff) await handOffToHuman(lead, decision.reason);
  else await db.activity.create({ data: { leadId: lead.id, type: "AI", text: `AI agent replied: “${decision.reply.slice(0, 120)}”` } });

  if (lead.stage === "NEW" && sent) {
    await db.lead.update({ where: { id: lead.id }, data: { stage: "CONTACTED" } });
  }
  return { ...decision, sent };
}
