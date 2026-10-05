import { db } from "../db";

export type LoadInput = { leadId?: string | null; conversationId?: string | null; commentId?: string | null };

/** Everything the agent can see and act on for one run. Loaded fresh for planning and again for execution. */
export async function loadContext(i: LoadInput) {
  const conversation0 = i.conversationId
    ? await db.conversation.findUnique({ where: { id: i.conversationId }, include: { contact: true, messages: { orderBy: { sentAt: "desc" }, take: 20 } } })
    : null;
  const comment = i.commentId ? await db.comment.findUnique({ where: { id: i.commentId }, include: { contact: true } }) : null;
  let lead = i.leadId ? await db.lead.findUnique({ where: { id: i.leadId }, include: { contact: true, assignedUser: { select: { name: true } } } }) : null;

  const contactId = lead?.contactId ?? conversation0?.contactId ?? comment?.contactId ?? null;
  if (!lead && contactId) {
    lead = await db.lead.findFirst({
      where: { contactId, stage: { notIn: ["WON", "LOST"] } },
      orderBy: { createdAt: "desc" },
      include: { contact: true, assignedUser: { select: { name: true } } },
    });
  }
  const conversation =
    conversation0 ??
    (contactId
      ? await db.conversation.findFirst({ where: { contactId }, include: { contact: true, messages: { orderBy: { sentAt: "desc" }, take: 20 } } })
      : null);
  const contact = lead?.contact ?? conversation?.contact ?? comment?.contact ?? null;

  const comments = contactId
    ? await db.comment.findMany({ where: { contactId, OR: [{ handled: false }, { id: comment?.id ?? "" }] }, orderBy: { createdAt: "desc" }, take: 5 })
    : comment
      ? [comment]
      : [];
  const activities = lead ? await db.activity.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 8 }) : [];

  const pending = await db.agentAction.findMany({
    where: {
      status: "PENDING",
      OR: [
        ...(lead ? [{ leadId: lead.id }] : []),
        ...(conversation ? [{ conversationId: conversation.id }] : []),
        ...(comment ? [{ commentId: comment.id }] : []),
      ],
    },
    take: 10,
  });

  return {
    lead,
    contact,
    comment,
    comments,
    activities,
    pending,
    conversation: conversation ? { id: conversation.id, messages: [...conversation.messages].reverse() } : null,
  };
}
export type AgentContext = Awaited<ReturnType<typeof loadContext>>;
