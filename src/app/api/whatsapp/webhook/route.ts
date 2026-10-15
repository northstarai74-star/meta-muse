import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getConnection, safeEqual, verifySignature } from "@/lib/meta";
import { sendWhatsAppText } from "@/lib/providers";
import { agentDecision } from "@/lib/ai/classify";
import { getSettings } from "@/lib/settings";

// Public endpoint (excluded from the login proxy). Protected by the verify token (GET) and Meta's HMAC signature (POST).
export const maxDuration = 60;

/** Meta's webhook handshake. The verify token is set in the WHATSAPP_VERIFY_TOKEN environment variable. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  if (
    expected &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    safeEqual(url.searchParams.get("hub.verify_token"), expected)
  ) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type WaMessage = { from: string; id: string; type: string; text?: { body: string }; timestamp?: string };
type WaValue = { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] };

export async function POST(req: Request) {
  const raw = await req.text();
  const conn = await getConnection();
  const appSecret = conn.appSecretEnc ? decrypt(conn.appSecretEnc) : null;
  // Signature is checked against the Meta app secret saved in Integrations (same app as Instagram).
  if (!appSecret || !verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(raw) as { object?: string; entry?: { changes?: { field: string; value: WaValue }[] }[] };
  if (body.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });

  const jobs: Promise<unknown>[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const names = Object.fromEntries((change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of change.value.messages ?? []) {
        if (m.type !== "text" || !m.text?.body) continue;
        jobs.push(handleInbound(m, names[m.from]));
      }
    }
  }
  // Reply after responding so Meta does not retry on slow Claude calls.
  after(() => Promise.allSettled(jobs));
  return NextResponse.json({ ok: true });
}

/** Stores one inbound WhatsApp message and, if the AI agent is on and the chat has no human, answers it. */
async function handleInbound(m: WaMessage, profileName?: string) {
  if (await db.message.findUnique({ where: { externalId: m.id } })) return;

  const contact =
    (await db.contact.findFirst({ where: { phone: m.from } })) ??
    (await db.contact.create({ data: { name: profileName ?? `+${m.from}`, phone: m.from, source: "WHATSAPP" } }));

  const convo =
    (await db.conversation.findFirst({ where: { contactId: contact.id, platform: "WHATSAPP" } })) ??
    (await db.conversation.create({ data: { contactId: contact.id, platform: "WHATSAPP" } }));

  await db.message.create({
    data: { conversationId: convo.id, externalId: m.id, direction: "IN", text: m.text!.body },
  });
  await db.conversation.update({ where: { id: convo.id }, data: { unread: { increment: 1 }, lastMessageAt: new Date() } });

  const settings = await getSettings();
  if (!settings.aiAgent) return;

  const history = await db.message.findMany({
    where: { conversationId: convo.id },
    orderBy: { sentAt: "desc" },
    take: 20,
  });
  const decision = await agentDecision(history.reverse());
  // A handoff leaves the chat unread so a person picks it up in the Inbox; no automatic reply is sent.
  if (decision.handoff || !decision.reply) return;

  if (settings.demoMode) {
    await db.message.create({ data: { conversationId: convo.id, direction: "OUT", text: decision.reply, byAi: true } });
    return;
  }
  try {
    const externalId = await sendWhatsAppText(m.from, decision.reply);
    await db.message.create({ data: { conversationId: convo.id, direction: "OUT", text: decision.reply, byAi: true, externalId: externalId ?? undefined } });
    await db.conversation.update({ where: { id: convo.id }, data: { unread: 0, lastMessageAt: new Date() } });
  } catch (err) {
    console.error("[whatsapp] could not send AI reply", err);
  }
}
