import { db } from "../db";
import { ProviderError, withKey } from "../keys";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function complete(apiKey: string, model: string, system: string, messages: ChatMessage[], maxTokens: number) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Vanita Business OS" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: system }, ...messages] }),
  });
  if (!res.ok) throw new ProviderError(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status);
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** True when a key is available, either in the Integrations vault or as OPENROUTER_API_KEY. */
export async function hasOpenRouterKey() {
  if (process.env.OPENROUTER_API_KEY) return true;
  return (await db.apiKey.count({ where: { provider: "OPENROUTER", status: "ACTIVE" } })) > 0;
}

/** One chat completion through OpenRouter. Vault keys rotate round-robin; OPENROUTER_API_KEY is the fallback. */
export async function chat(opts: { model: string; system: string; messages: ChatMessage[]; maxTokens: number }): Promise<string> {
  const run = (apiKey: string) => complete(apiKey, opts.model, opts.system, opts.messages, opts.maxTokens);
  if ((await db.apiKey.count({ where: { provider: "OPENROUTER", status: "ACTIVE" } })) > 0) return withKey("OPENROUTER", run);
  if (process.env.OPENROUTER_API_KEY) return run(process.env.OPENROUTER_API_KEY);
  throw new ProviderError("No OpenRouter API key configured");
}
