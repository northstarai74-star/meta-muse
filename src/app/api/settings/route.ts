import { z } from "zod";
import { json, route } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";
import { LEVELS, TOOLS } from "@/lib/agent/meta";

const Body = z.object({
  demoMode: z.boolean().optional(),
  autoAssign: z.boolean().optional(),
  claudeModel: z.string().min(1).optional(),
  agentEnabled: z.boolean().optional(),
  agentAutonomy: z.partialRecord(z.enum(TOOLS), z.enum(LEVELS)).optional(),
  agentMinConfidence: z.number().int().min(0).max(100).optional(),
  agentDailySendCap: z.number().int().min(0).max(10_000).optional(),
  agentDailyTokenCap: z.number().int().min(0).max(50_000_000).optional(),
  agentStaleHours: z.number().int().min(1).max(720).optional(),
});

export const PUT = route(
  async (req) => {
    const body = Body.parse(await req.json());
    const patch: Parameters<typeof saveSettings>[0] = { ...body, agentAutonomy: undefined };
    if (body.agentAutonomy) patch.agentAutonomy = { ...(await getSettings()).agentAutonomy, ...body.agentAutonomy };
    else delete patch.agentAutonomy;
    await saveSettings(patch);
    return json({ ok: true });
  },
  { admin: true },
);
