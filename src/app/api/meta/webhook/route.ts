import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { fetchFormName, fetchLeadgen, fetchProfile, getConnection, safeEqual, verifySignature } from "@/lib/meta";
import { ingestComment, ingestLeadAd, ingestMessage } from "@/lib/ingest";
import { runAiAgent } from "@/lib/agent";

// Public endpoint (excluded from the login proxy). Protected by Meta's verify token + HMAC signature.

// AI agent replies run after the response (see `after` below); give them room to finish.
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const conn = await getConnection();
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    safeEqual(url.searchParams.get("hub.verify_token"), conn.verifyToken)
  ) {
    await db.metaConnection.update({ where: { id: "singleton" }, data: { connected: true } });
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type ChangeValue = {
  id?: string;
  comment_id?: string;
  post_id?: string;
  text?: string;
  message?: string;
  from?: { id?: string; username?: string; name?: string };
  media?: { id?: string };
  leadgen_id?: string;
};
type Change = { field: string; value: ChangeValue };
type Messaging = { sender?: { id: string }; recipient?: { id: string }; message?: { mid: string; text?: string; is_echo?: boolean }; timestamp?: number };
type Entry = { id: string; time?: number; messaging?: Messaging[]; changes?: Change[] };

/**
 * Inbound DMs and echoes. An echo is a message the page itself sent — from this app (already stored,
 * deduplicated by `mid`) or typed in the Instagram app, which would otherwise never show up in the inbox.
 * Returns the conversation the AI agent should answer, if any.
 */
async function processMessaging(ev: Messaging) {
  if (!ev.message?.text) return null;
  const echo = ev.message.is_echo === true;
  const igUserId = echo ? ev.recipient?.id : ev.sender?.id;
  if (!igUserId) return null;

  let profile: { name?: string; username?: string } = {};
  if (!(await db.contact.findUnique({ where: { igUserId }, select: { id: true } }))) {
    try {
      profile = await fetchProfile(igUserId);
    } catch {}
  }
  const r = await ingestMessage({
    igUserId,
    name: profile.name,
    handle: profile.username,
    text: ev.message.text,
    externalId: ev.message.mid,
    direction: echo ? "OUT" : "IN",
    at: ev.timestamp ? new Date(ev.timestamp) : undefined,
  });
  return r && !echo ? r.conversationId : null;
}

async function processChange(ch: Change) {
  if (ch.field === "comments" || ch.field === "feed") {
    const v = ch.value;
    const text = v.text ?? v.message;
    if (!text) return;
    await ingestComment({
      igUserId: v.from?.id,
      handle: v.from?.username ?? v.from?.name,
      text,
      externalId: v.id ?? v.comment_id,
      postRef: v.media?.id ?? v.post_id,
    });
  } else if (ch.field === "leadgen") {
    if (!ch.value.leadgen_id) return;
    const lead = await fetchLeadgen(ch.value.leadgen_id);
    const f = Object.fromEntries((lead.field_data ?? []).map((x) => [x.name, x.values?.[0]]));
    let formName: string | undefined;
    if (lead.form_id) formName = (await fetchFormName(lead.form_id).catch(() => undefined)) ?? `Form ${lead.form_id}`;
    await ingestLeadAd({
      externalId: ch.value.leadgen_id,
      formName,
      name: f.full_name ?? f.name,
      email: f.email,
      phone: f.phone_number ?? f.phone,
      message: f.message ?? f.what_service_are_you_interested_in,
      raw: lead,
    });
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const conn = await getConnection();
  const secret = conn.appSecretEnc ? decrypt(conn.appSecretEnc) : null;

  if (!secret || !verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  let payload: { object?: string; entry?: Entry[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Ingestion runs inline so nothing is lost; each event is isolated so one failure is logged
  // without dropping the rest of the batch (we don't rely on Meta retrying).
  const toAnswer = new Set<string>();
  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const convoId = await processMessaging(ev).catch((err) => {
        console.error("[meta webhook] message failed", ev.message?.mid, err);
        return null;
      });
      if (convoId) toAnswer.add(convoId);
    }
    for (const ch of entry.changes ?? []) {
      await processChange(ch).catch((err) => console.error("[meta webhook] change failed", ch.field, err));
    }
  }
  // Claude + the Graph send can take a few seconds, so the AI agent answers after Meta has its 200.
  if (toAnswer.size) {
    after(async () => {
      for (const id of toAnswer) await runAiAgent(id).catch((err) => console.error("[meta webhook] AI agent failed", id, err));
    });
  }
  return NextResponse.json({ received: true });
}
