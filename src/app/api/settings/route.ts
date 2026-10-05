import { z } from "zod";
import { json, route } from "@/lib/api";
import { saveSettings } from "@/lib/settings";

const Body = z.object({
  demoMode: z.boolean().optional(),
  autoAssign: z.boolean().optional(),
  claudeModel: z.string().min(1).optional(),
});

export const PUT = route(
  async (req) => {
    await saveSettings(Body.parse(await req.json()));
    return json({ ok: true });
  },
  { admin: true },
);
