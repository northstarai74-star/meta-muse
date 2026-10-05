import { db } from "./db";
import { classifyText } from "./ai/classify";
import { getSettings } from "./settings";

export const DEFAULT_LEAD_VALUE: Record<string, number> = { AI_VOICE: 1500, WEB_DEV: 3000, DROPSHIPPING: 800, UNASSIGNED: 0 };

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
      estimatedValue: DEFAULT_LEAD_VALUE[cls.service],
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

export type ProspectInput = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  industry?: string;
  country?: string;
  instagramHandle?: string;
  message?: string;
};

export type ProspectOutcome =
  | { status: "created"; contactId: string; leadId: string }
  | { status: "duplicate"; contactId: string; leadId: string }
  | { status: "do_not_contact"; contactId: string };

/**
 * Adds an outbound prospect or an inbound API lead as contact + lead.
 * Skips anyone marked do-not-contact, and anyone who already has an open lead for the same service.
 * With a `service` the lead is created directly (no Claude call, so bulk imports cost nothing);
 * without one, the message is classified like any other inbound lead.
 */
export async function ingestProspect(
  input: ProspectInput,
  opts: { source: string; service?: string; stage?: string; lawfulBasis?: string },
): Promise<ProspectOutcome> {
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = input.phone?.trim() || undefined;
  let contact = email ? await db.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
  if (!contact && phone) contact = await db.contact.findFirst({ where: { phone } });
  if (contact?.doNotContact) return { status: "do_not_contact", contactId: contact.id };

  if (contact) {
    // fill in blanks only; never overwrite what is already known
    const fill: Record<string, string> = {};
    for (const k of ["phone", "company", "website", "industry", "country"] as const) {
      if (!contact[k] && input[k]) fill[k] = input[k]!;
    }
    if (!contact.lawfulBasis && opts.lawfulBasis) fill.lawfulBasis = opts.lawfulBasis;
    if (Object.keys(fill).length) contact = await db.contact.update({ where: { id: contact.id }, data: fill });
  } else {
    contact = await db.contact.create({
      data: {
        name: input.name?.trim() || input.company?.trim() || email?.split("@")[0] || "Unknown",
        email,
        phone: phone ?? null,
        company: input.company || null,
        website: input.website || null,
        industry: input.industry || null,
        country: input.country || null,
        instagramHandle: input.instagramHandle?.replace(/^@/, "") || null,
        lawfulBasis: opts.lawfulBasis || null,
        source: opts.source,
      },
    });
  }

  const service = opts.service ?? "UNASSIGNED";
  if (opts.service) {
    const open = await db.lead.findFirst({ where: { contactId: contact.id, service, stage: { notIn: ["WON", "LOST"] } } });
    if (open) return { status: "duplicate", contactId: contact.id, leadId: open.id };
  }

  const text = input.message?.trim() || `Outbound prospect${input.industry ? ` (${input.industry})` : ""}`;
  if (!opts.service) {
    const lead = await createLead({ contactId: contact.id, source: opts.source, text });
    if (opts.stage && opts.stage !== "NEW") await db.lead.update({ where: { id: lead.id }, data: { stage: opts.stage } });
    return { status: "created", contactId: contact.id, leadId: lead.id };
  }

  const settings = await getSettings();
  const assign = settings.autoAssign ? await pickAssignee(service) : { agent: "HUMAN", userId: null as string | null };
  const lead = await db.lead.create({
    data: {
      contactId: contact.id,
      source: opts.source,
      title: input.company || contact.company ? `${input.company ?? contact.company} — ${text}` : text,
      service,
      stage: opts.stage ?? "NEW",
      assignedAgent: assign.agent,
      assignedUserId: assign.userId,
      estimatedValue: DEFAULT_LEAD_VALUE[service] ?? 0,
    },
  });
  await db.activity.create({
    data: { leadId: lead.id, type: "CREATED", text: `Added from ${opts.source === "COLD_EMAIL" ? "cold email list" : opts.source === "IMPORT" ? "imported list" : "API"}` },
  });
  return { status: "created", contactId: contact.id, leadId: lead.id };
}
