import { z } from "zod";
import { json, route } from "@/lib/api";
import { ProviderError } from "@/lib/keys";
import { rateLimit } from "@/lib/rate-limit";
import { runAssistant } from "@/lib/assistant";

// Only user/assistant turns are accepted from the browser — a client can never inject a system or tool message.
const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(30),
});

export const POST = route(async (req, _ctx, user) => {
  const limit = rateLimit(`assistant:${user.id}`, 20, 60_000);
  if (!limit.ok) return json({ error: `Slow down a little — try again in ${limit.retryAfter}s` }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const { messages } = Body.parse(await req.json());
  if (messages[messages.length - 1].role !== "user") return json({ error: "The last message must be from you" }, 400);

  try {
    return json(await runAssistant(messages, user));
  } catch (e) {
    if (e instanceof ProviderError) {
      if (/No active OPENROUTER/.test(e.message)) return json({ error: "Add an OpenRouter API key in Integrations to turn the assistant on.", setup: true }, 503);
      if (e.status === 401 || e.status === 403) return json({ error: "OpenRouter rejected the API key — check it in Integrations." }, 502);
      if (e.status === 402) return json({ error: "OpenRouter says the account is out of credits." }, 502);
      if (e.status === 429) return json({ error: "OpenRouter is rate limiting right now — try again in a moment." }, 429);
      return json({ error: `The assistant couldn't answer: ${e.message.slice(0, 160)}` }, 502);
    }
    throw e;
  }
});
