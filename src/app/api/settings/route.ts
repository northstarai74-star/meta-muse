import { z } from "zod";
import { json, route } from "@/lib/api";
import { saveSettings } from "@/lib/settings";

const Body = z.object({
  demoMode: z.boolean().optional(),
  autoAssign: z.boolean().optional(),
  claudeModel: z.string().min(1).optional(),
  assistantModel: z.string().trim().min(1).max(100).optional(),
  assistantInstructions: z.string().max(4000).optional(),
  voiceId: z.string().trim().regex(/^[A-Za-z0-9]{10,40}$/, "That doesn't look like an ElevenLabs voice ID").optional(),
  speakReplies: z.boolean().optional(),
});

export const PUT = route(
  async (req) => {
    await saveSettings(Body.parse(await req.json()));
    return json({ ok: true });
  },
  { admin: true },
);
