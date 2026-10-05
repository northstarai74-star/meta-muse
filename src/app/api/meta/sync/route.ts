import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { syncMetaConversations } from "@/lib/meta-events";

export const POST = route(
  async () => {
    const settings = await getSettings();
    if (settings.demoMode) return json({ error: "Turn off demo mode in Settings to sync from Meta" }, 400);
    return json(await syncMetaConversations());
  },
  { admin: true },
);
