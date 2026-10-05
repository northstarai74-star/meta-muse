import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { fetchRecentConversations, getConnection } from "@/lib/meta";
import { ingestMessage } from "@/lib/ingest";

export const POST = route(
  async () => {
    const settings = await getSettings();
    if (settings.demoMode) return json({ error: "Turn off demo mode in Settings to sync from Meta" }, 400);

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
    return json({ imported });
  },
  { admin: true },
);
