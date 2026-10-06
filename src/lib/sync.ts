import { db } from "./db";
import { fetchRecentConversations, getConnection } from "./meta";
import { ingestMessage } from "./ingest";

/**
 * Backfills recent Instagram DM threads from the Graph API. Already-stored messages are skipped by
 * their Meta ID, so this is safe to run repeatedly (manual "Sync now" and the scheduled cron).
 * It never triggers the AI agent: old messages may already have been answered elsewhere.
 */
export async function syncFromMeta() {
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
