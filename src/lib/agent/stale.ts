import { db } from "../db";
import { getSettings } from "../settings";
import { scheduleAgent } from "./trigger";

const MAX_PER_SCAN = 10;

/** Recurring: wakes the agent on AI-owned open leads that have been silent for longer than the stale threshold. */
export async function scanStaleLeads() {
  const settings = await getSettings();
  if (!settings.agentEnabled) return { skipped: true };
  const cutoff = new Date(Date.now() - settings.agentStaleHours * 3600_000);

  const candidates = await db.lead.findMany({
    where: { assignedAgent: "AI", stage: { notIn: ["WON", "LOST"] }, updatedAt: { lt: cutoff } },
    include: { contact: { include: { conversations: { select: { id: true, lastMessageAt: true }, take: 1 } } } },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });

  let queued = 0;
  for (const lead of candidates) {
    if (queued >= MAX_PER_SCAN) break;
    const convo = lead.contact.conversations[0];
    if (convo && convo.lastMessageAt > cutoff) continue; // still chatting
    const lastRun = await db.agentRun.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (lastRun && lastRun.createdAt > cutoff) continue; // the agent already looked recently
    await scheduleAgent({ trigger: "STALE", leadId: lead.id, conversationId: convo?.id }, { delayMs: 0 });
    queued++;
  }
  return { queued };
}

/** Recurring: prunes finished jobs so the queue table stays small. */
export async function maintenance() {
  const day = 86400_000;
  const [done, failed] = await Promise.all([
    db.job.deleteMany({ where: { status: "DONE", finishedAt: { lt: new Date(Date.now() - 7 * day) } } }),
    db.job.deleteMany({ where: { status: "FAILED", finishedAt: { lt: new Date(Date.now() - 30 * day) } } }),
  ]);
  return { deleted: done.count + failed.count };
}
