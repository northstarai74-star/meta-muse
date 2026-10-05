import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { editActionText, executeAction, rejectAction } from "@/lib/agent/runner";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ decision: z.enum(["approve", "reject"]), text: z.string().min(1).max(900).optional() });

/** Approve (optionally with edited text) or reject a queued agent action. Approving executes it immediately. */
export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const b = Body.parse(await req.json());
  if (b.decision === "reject") {
    await rejectAction(id, user);
  } else {
    if (b.text) await editActionText(id, b.text);
    await executeAction(id, { id: user.id, name: user.name });
  }
  return json(await db.agentAction.findUnique({ where: { id }, select: { id: true, status: true, note: true } }));
});
