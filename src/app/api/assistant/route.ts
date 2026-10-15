import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { withKey, ProviderError } from "@/lib/keys";
import { getSettings } from "@/lib/settings";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30),
});

/** A short, current snapshot of the business so the assistant can answer questions about it. */
async function businessSnapshot() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [stages, txns, openConvos] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
    db.transaction.findMany({ where: { date: { gte: monthStart } }, select: { type: true, amount: true, category: true } }),
    db.conversation.count({ where: { unread: { gt: 0 } } }),
  ]);
  const income = txns.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  return [
    `Leads by stage: ${stages.map((s) => `${s.stage} ${s._count._all}`).join(", ") || "none"}.`,
    `This month: income ${income.toFixed(2)}, expenses ${expenses.toFixed(2)}, net ${(income - expenses).toFixed(2)}.`,
    `Conversations with unread messages: ${openConvos}.`,
  ].join("\n");
}

export const POST = route(async (req) => {
  const { messages } = Body.parse(await req.json());
  const settings = await getSettings();
  const system = [
    "You are the built-in assistant for Vanita Business OS, a CRM for an AI voice receptionist, web development and dropshipping business.",
    "Answer briefly and practically. Only state figures given in the snapshot; say so if something is not in it.",
    "Current snapshot:",
    await businessSnapshot(),
  ].join("\n");

  try {
    const text = await withKey("CLAUDE", async (secret) => {
      const res = await new Anthropic({ apiKey: secret }).messages.create({
        model: settings.claudeModel,
        max_tokens: 800,
        system,
        messages,
      });
      return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    });
    return json({ reply: text });
  } catch (err) {
    if (err instanceof ProviderError) return json({ error: "No active Claude key. Add one in Integrations." }, 400);
    throw err;
  }
});
