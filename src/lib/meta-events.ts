import { db } from "./db";
import { decrypt } from "./crypto";
import { debugToken, fetchLeadgen, fetchProfile, fetchRecentConversations, getConnection } from "./meta";
import { ingestComment, ingestLeadAd, ingestMessage } from "./ingest";
import { getSettings } from "./settings";

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
export type MetaEntry = { id: string; time?: number; messaging?: Messaging[]; changes?: Change[] };

/** Processes one webhook entry. Throws on failure so the job queue retries (ingest is idempotent per externalId). */
export async function processMetaEntry(entry: MetaEntry) {
  for (const ev of entry.messaging ?? []) {
    if (!ev.message?.text || ev.message.is_echo || !ev.sender?.id) continue;
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

  for (const ch of entry.changes ?? []) {
    if (ch.field === "comments" || ch.field === "feed") {
      const v = ch.value;
      const text = v.text ?? v.message;
      if (!text) continue;
      await ingestComment({
        igUserId: v.from?.id,
        handle: v.from?.username ?? v.from?.name,
        text,
        externalId: v.id ?? v.comment_id,
        postRef: v.media?.id ?? v.post_id,
      });
    } else if (ch.field === "leadgen") {
      if (!ch.value.leadgen_id) continue;
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
}

/** Pulls recent Instagram DM threads and imports anything new. */
export async function syncMetaConversations() {
  const conn = await getConnection();
  const convos = await fetchRecentConversations();
  let imported = 0;
  for (const c of convos) {
    const them = c.participants?.data.find((p) => p.id !== conn.igBusinessId && p.id !== conn.pageId);
    if (!them) continue;
    // oldest first so new-lead creation sees the first inbound message
    for (const m of [...(c.messages?.data ?? [])].reverse()) {
      if (!m.message) continue;
      const r = await ingestMessage({
        igUserId: them.id,
        name: them.name,
        handle: them.username,
        text: m.message,
        externalId: m.id,
        threadId: c.id,
        direction: m.from.id === them.id ? "IN" : "OUT",
        at: new Date(m.created_time),
      });
      if (r) imported++;
    }
  }
  await db.metaConnection.update({ where: { id: "singleton" }, data: { lastSyncAt: new Date() } });
  return { imported };
}

/** Recurring: backfill DMs the webhook may have missed. No-op in demo mode or without credentials. */
export async function scheduledSync() {
  const [settings, conn] = await Promise.all([getSettings(), getConnection()]);
  if (settings.demoMode || !conn.pageId) return { skipped: true };
  return syncMetaConversations();
}

export type TokenStatus = { checkedAt: string; valid: boolean; expiresAt: string | null; error: string | null };
export const TOKEN_STATUS_KEY = "meta.tokenStatus";

/** Recurring: records whether the saved Meta page token is still valid / when it expires (shown on the dashboard). */
export async function checkMetaToken() {
  const conn = await getConnection();
  if (!conn.appId || !conn.appSecretEnc || !conn.accessTokenEnc) return { skipped: true };
  let status: TokenStatus;
  try {
    const r = await debugToken(conn.appId, decrypt(conn.appSecretEnc), decrypt(conn.accessTokenEnc));
    status = { checkedAt: new Date().toISOString(), valid: r.valid, expiresAt: r.expiresAt?.toISOString() ?? null, error: r.error };
  } catch (e) {
    status = { checkedAt: new Date().toISOString(), valid: false, expiresAt: null, error: (e as Error).message };
  }
  const value = JSON.stringify(status);
  await db.setting.upsert({ where: { key: TOKEN_STATUS_KEY }, create: { key: TOKEN_STATUS_KEY, value }, update: { value } });
  return status;
}
