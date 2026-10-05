import { z } from "zod";
import { json, route } from "@/lib/api";
import { ProviderError } from "@/lib/keys";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { synthesizeSpeech } from "@/lib/assistant";

const Body = z.object({ text: z.string().trim().min(1).max(1500) });

/** Text → speech through ElevenLabs. The key never leaves the server; this endpoint streams back audio/mpeg. */
export const POST = route(async (req, _ctx, user) => {
  const limit = rateLimit(`speak:${user.id}`, 30, 60_000);
  if (!limit.ok) return json({ error: "Too many voice requests — try again shortly" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const { text } = Body.parse(await req.json());
  const { voiceId } = await getSettings();
  try {
    const audio = await synthesizeSpeech(text, voiceId);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ProviderError) {
      if (/No active ELEVENLABS/.test(e.message)) return json({ error: "Add an ElevenLabs API key in Integrations to enable the voice.", setup: true }, 503);
      return json({ error: `Voice failed: ${e.message.slice(0, 160)}` }, 502);
    }
    throw e;
  }
});
