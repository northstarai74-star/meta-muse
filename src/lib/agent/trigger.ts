import { enqueue } from "../jobs";
import { getSettings } from "../settings";

export type Trigger = "DM" | "COMMENT" | "LEAD" | "STALE" | "FOLLOWUP" | "MANUAL";
export type RunInput = { trigger: Trigger; leadId?: string; conversationId?: string; commentId?: string; reason?: string };

/** Wait this long before running so a burst of messages is handled as one conversation turn. */
const DEBOUNCE_MS = 8_000;

/** Queues an agent run. Never throws: capturing a lead must not fail because the agent could not be scheduled. */
export async function scheduleAgent(input: RunInput, opts: { delayMs?: number } = {}) {
  try {
    const settings = await getSettings();
    if (!settings.agentEnabled) return null;
    const key = input.conversationId ?? input.commentId ?? input.leadId ?? "";
    return await enqueue("AGENT_RUN", input, {
      runAt: new Date(Date.now() + (opts.delayMs ?? DEBOUNCE_MS)),
      dedupeKey: `agent:${input.trigger === "COMMENT" ? "comment" : input.conversationId ? "conv" : "lead"}:${key}`,
    });
  } catch (err) {
    console.error("[agent] failed to schedule run", err);
    return null;
  }
}
