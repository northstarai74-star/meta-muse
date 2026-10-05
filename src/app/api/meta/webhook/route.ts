import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { fetchLeadgen, fetchProfile, getConnection, safeEqual, verifySignature } from "@/lib/meta";
import { ingestComment, ingestLeadAd, ingestMessage } from "@/lib/ingest";

// Public endpoint (excluded from the login proxy). Protected by Meta's verify token + HMAC signature.

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

async function processMessaging(ev: Messaging) {
  if (!ev.message?.text || ev.message.is_echo || !ev.sender?.id) return;
  let profile: { name?: string; username?: string } = {};
  try {
    profile = await fetchProfile(ev.sender.id);
  } catch {}
  await ingestMessage({
    igUserId: ev.sender.id,
    name: profile.name,
    handle: profile.username,
    text: ev.message.text,
    externalId: ev.message.mid,
    at: ev.timestamp ? new Date(ev.timestamp) : undefined,
  });
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
    await ingestLeadAd({
      externalId: ch.value.leadgen_id,
      formName: lead.form_id ? `Form ${lead.form_id}` : undefined,
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

  // Respond fast to Meta (<5s) but process inline. Each event is isolated so one failure
  // is logged without dropping the rest of the batch (we don't rely on Meta retrying).
  for (const entry of payload.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      await processMessaging(ev).catch((err) => console.error("[meta webhook] message failed", ev.message?.mid, err));
    }
    for (const ch of entry.changes ?? []) {
      await processChange(ch).catch((err) => console.error("[meta webhook] change failed", ch.field, err));
    }
  }
  return NextResponse.json({ received: true });
}
