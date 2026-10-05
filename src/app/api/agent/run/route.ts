import { z } from "zod";
import { json, route } from "@/lib/api";
import { runAgent } from "@/lib/agent/runner";

const Body = z.object({ leadId: z.string().optional(), conversationId: z.string().optional(), commentId: z.string().optional() }).refine((b) => b.leadId || b.conversationId || b.commentId, "Pick a lead, conversation or comment");

/** "Run agent now" — runs the agent immediately on one lead / thread / comment, ignoring ownership and debounce. */
export const POST = route(async (req) => {
  const b = Body.parse(await req.json());
  const run = await runAgent({ trigger: "MANUAL", ...b }, { manual: true });
  return json(run);
});
