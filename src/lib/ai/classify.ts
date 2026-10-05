import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withKey } from "../keys";
import { getSettings } from "../settings";
import { db } from "../db";

export const ClassificationSchema = z.object({
  service: z.enum(["AI_VOICE", "WEB_DEV", "DROPSHIPPING", "UNASSIGNED"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(300),
  suggestedAgent: z.enum(["AI", "HUMAN"]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const KEYWORDS: Record<"AI_VOICE" | "WEB_DEV" | "DROPSHIPPING", RegExp> = {
  AI_VOICE: /(receptionist|voice|call|phone|answer(ing)? calls|missed calls|appointment|booking|ai agent|front desk)/i,
  WEB_DEV: /(website|web ?site|web app|landing page|shopify theme|redesign|seo|ecommerce site|portfolio|developer|build (me )?a (site|app))/i,
  DROPSHIPPING: /(dropship|product|supplier|wholesale|store|sourcing|shipping|aliexpress|winning product|bulk order|price list|moq)/i,
};

/** Offline fallback used in demo mode or when no Claude key is available. */
export function heuristicClassify(text: string): Classification {
  let best: Classification["service"] = "UNASSIGNED";
  let hits = 0;
  for (const [service, re] of Object.entries(KEYWORDS)) {
    const count = (text.match(new RegExp(re.source, "gi")) ?? []).length;
    if (count > hits) {
      hits = count;
      best = service as Classification["service"];
    }
  }
  const intent = /(price|quote|cost|how much|interested|book|buy|order|call me|dm me|asap|urgent|budget)/i.test(text);
  const score = Math.min(95, 25 + hits * 15 + (intent ? 25 : 0));
  return {
    service: best,
    score: best === "UNASSIGNED" ? Math.min(score, 30) : score,
    summary: text.length > 140 ? text.slice(0, 137) + "…" : text,
    suggestedAgent: best === "AI_VOICE" || best === "DROPSHIPPING" ? "AI" : "HUMAN",
  };
}

const SYSTEM = `You qualify inbound leads for a small agency with three services:
- AI_VOICE: AI voice receptionist agents that answer business phone calls and book appointments
- WEB_DEV: website / web app development
- DROPSHIPPING: dropshipping products, supplier sourcing and store setup
Given a message from a prospect, reply with ONLY a JSON object:
{"service":"AI_VOICE|WEB_DEV|DROPSHIPPING|UNASSIGNED","score":0-100 purchase-intent score,"summary":"one sentence <=200 chars","suggestedAgent":"AI|HUMAN"}
Use HUMAN when the lead is high value, complex or emotional; AI for simple FAQ-style enquiries. Use UNASSIGNED when it fits none of the services.`;

export async function classifyText(text: string): Promise<Classification> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) return heuristicClassify(text);

  try {
    const raw = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    });
    const match = raw.match(/\{[\s\S]*\}/);
    return ClassificationSchema.parse(JSON.parse(match?.[0] ?? "{}"));
  } catch {
    // Never lose a lead because classification failed.
    return heuristicClassify(text);
  }
}

export async function suggestReply(history: { direction: string; text: string }[]): Promise<string> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  const last = [...history].reverse().find((m) => m.direction === "IN")?.text ?? "";
  if (settings.demoMode || !hasKey) {
    const c = heuristicClassify(last);
    const opener = "Hi! Thanks for reaching out 👋";
    const body: Record<string, string> = {
      AI_VOICE: "Our AI voice receptionist answers every call, books appointments and never misses a lead. Want a quick 10-min demo this week?",
      WEB_DEV: "We build fast, conversion-focused websites. Could you share your business, goals and a rough budget so I can send a proposal?",
      DROPSHIPPING: "We can help with product sourcing and store setup. What niche are you in, and what order volume are you planning?",
      UNASSIGNED: "Could you tell me a bit more about what you're looking for so I can point you to the right person?",
    };
    return `${opener} ${body[c.service]}`;
  }
  const transcript = history
    .slice(-12)
    .map((m) => `${m.direction === "IN" ? "Prospect" : "Us"}: ${m.text}`)
    .join("\n");
  return withKey("CLAUDE", async (apiKey) => {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: settings.claudeModel,
      max_tokens: 250,
      system:
        "You write short, friendly Instagram DM replies for an agency offering AI voice receptionists, web development and dropshipping. Reply with only the message text (max 3 sentences), ending with a clear next step.",
      messages: [{ role: "user", content: transcript }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : "";
  });
}
