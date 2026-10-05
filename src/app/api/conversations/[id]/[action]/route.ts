import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { sendInstagramMessage } from "@/lib/meta";
import { suggestReply } from "@/lib/ai/classify";
import { createLead } from "@/lib/ingest";

type Ctx = { params: Promise<{ id: string; action: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const { id, action } = await params;
  const convo = await db.conversation.findUnique({
    where: { id },
    include: { contact: true, messages: { orderBy: { sentAt: "asc" } } },
  });
  if (!convo) return json({ error: "Conversation not found" }, 404);

  switch (action) {
    case "read":
      await db.conversation.update({ where: { id }, data: { unread: 0 } });
      return json({ ok: true });

    case "suggest":
      return json({ text: await suggestReply(convo.messages) });

    case "send": {
      const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(await req.json());
      const settings = await getSettings();
      if (!settings.demoMode) {
        if (!convo.contact.igUserId) return json({ error: "This contact has no Instagram ID to message" }, 400);
        await sendInstagramMessage(convo.contact.igUserId, text);
      }
      const msg = await db.message.create({ data: { conversationId: id, direction: "OUT", text } });
      await db.conversation.update({ where: { id }, data: { lastMessageAt: msg.sentAt, unread: 0 } });
      return json(msg, 201);
    }

    case "lead": {
      const existing = await db.lead.findFirst({ where: { contactId: convo.contactId, stage: { notIn: ["WON", "LOST"] } } });
      if (existing) return json({ error: "This contact already has an open lead" }, 409);
      const text = convo.messages.filter((m) => m.direction === "IN").map((m) => m.text).join("\n") || convo.contact.name;
      return json(await createLead({ contactId: convo.contactId, source: "META_DM", text }), 201);
    }

    default:
      return json({ error: "Unknown action" }, 404);
  }
});
