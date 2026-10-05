import { db } from "./db";
import { classifyText } from "./ai/classify";
import { getSettings } from "./settings";

type ContactInput = { igUserId?: string; name?: string; handle?: string; email?: string; phone?: string };

export async function upsertContact(input: ContactInput, source: string) {
  if (input.igUserId) {
    const existing = await db.contact.findUnique({ where: { igUserId: input.igUserId } });
    if (existing) return existing;
  }
  if (input.email) {
    const byEmail = await db.contact.findFirst({ where: { email: input.email } });
    if (byEmail) return byEmail;
  }
  return db.contact.create({
    data: {
      name: input.name || input.handle || "Instagram user",
      instagramHandle: input.handle,
      igUserId: input.igUserId,
      email: input.email,
      phone: input.phone,
      source,
    },
  });
}

/** Picks who should own a lead: the service's assignment rule, else the least-loaded team member. */
export async function pickAssignee(service: string) {
  const rule = await db.assignmentRule.findUnique({ where: { service } });
  if (rule) return { agent: rule.agent, userId: rule.userId };
  const users = await db.user.findMany({ include: { _count: { select: { leads: { where: { stage: { notIn: ["WON", "LOST"] } } } } } } });
  users.sort((a, b) => a._count.leads - b._count.leads);
  return { agent: "HUMAN", userId: users[0]?.id ?? null };
}

/** Creates a lead, classifies it with Claude (or heuristics) and auto-assigns it. */
export async function createLead(opts: { contactId: string; source: string; text: string; title?: string }) {
  const [cls, settings] = await Promise.all([classifyText(opts.text), getSettings()]);
  const assign =
    settings.autoAssign && cls.service !== "UNASSIGNED"
      ? await pickAssignee(cls.service)
      : { agent: "HUMAN", userId: null as string | null };

  const lead = await db.lead.create({
    data: {
      contactId: opts.contactId,
      source: opts.source,
      title: opts.title ?? (opts.text.length > 60 ? opts.text.slice(0, 57) + "…" : opts.text),
      service: cls.service,
      score: cls.score,
      aiSummary: cls.summary,
      assignedAgent: assign.agent,
      assignedUserId: assign.userId,
      estimatedValue: { AI_VOICE: 1500, WEB_DEV: 3000, DROPSHIPPING: 800, UNASSIGNED: 0 }[cls.service],
    },
  });
  await db.activity.createMany({
    data: [
      { leadId: lead.id, type: "CREATED", text: `Lead captured from ${opts.source.replace("META_", "").replace("_", " ").toLowerCase()}` },
      {
        leadId: lead.id,
        type: "AI",
        text: `Claude classified as ${cls.service.replace("_", " ")} (score ${cls.score}) and assigned to ${assign.agent === "AI" ? "AI agent" : "team"}`,
      },
    ],
  });
  return lead;
}

export async function ingestMessage(m: ContactInput & { text: string; externalId?: string; direction?: "IN" | "OUT"; threadId?: string; at?: Date }) {
  if (m.externalId && (await db.message.findUnique({ where: { externalId: m.externalId } }))) return null;
  const contact = await upsertContact(m, "META_DM");
  const direction = m.direction ?? "IN";

  const convo =
    (m.threadId && (await db.conversation.findUnique({ where: { externalId: m.threadId } }))) ||
    (await db.conversation.findFirst({ where: { contactId: contact.id } })) ||
    (await db.conversation.create({ data: { contactId: contact.id, externalId: m.threadId } }));

  await db.message.create({
    data: { conversationId: convo.id, externalId: m.externalId, direction, text: m.text, sentAt: m.at ?? new Date() },
  });
  await db.conversation.update({
    where: { id: convo.id },
    data: { lastMessageAt: m.at ?? new Date(), unread: direction === "IN" ? { increment: 1 } : undefined },
  });

  if (direction === "IN") {
    const open = await db.lead.findFirst({ where: { contactId: contact.id, stage: { notIn: ["WON", "LOST"] } } });
    if (!open) await createLead({ contactId: contact.id, source: "META_DM", text: m.text });
  }
  return { contactId: contact.id, conversationId: convo.id };
}

export async function ingestComment(c: ContactInput & { text: string; externalId?: string; postRef?: string }) {
  if (c.externalId && (await db.comment.findUnique({ where: { externalId: c.externalId } }))) return null;
  const contact = await upsertContact(c, "META_COMMENT");
  return db.comment.create({
    data: {
      externalId: c.externalId,
      contactId: contact.id,
      author: c.handle || c.name || "instagram_user",
      text: c.text,
      postRef: c.postRef,
    },
  });
}

export async function ingestLeadAd(e: {
  externalId?: string;
  formName?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  raw?: unknown;
}) {
  if (e.externalId && (await db.enquiry.findUnique({ where: { externalId: e.externalId } }))) return null;
  const contact = await upsertContact({ name: e.name, email: e.email, phone: e.phone }, "META_LEAD_AD");
  const text = [e.formName, e.message].filter(Boolean).join(" — ") || `Lead ad form from ${e.name ?? "unknown"}`;
  const lead = await createLead({ contactId: contact.id, source: "META_LEAD_AD", text });
  return db.enquiry.create({
    data: {
      externalId: e.externalId,
      leadId: lead.id,
      formName: e.formName,
      name: e.name,
      email: e.email,
      phone: e.phone,
      message: e.message,
      raw: e.raw ? JSON.stringify(e.raw) : null,
      handled: true,
    },
  });
}
