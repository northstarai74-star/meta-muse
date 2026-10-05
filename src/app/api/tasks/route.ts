import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { addFollowup, parseDay } from "@/lib/followups";

const Body = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().min(1, "Describe the follow-up").max(200),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
  assignedUserId: z.string().nullable().optional(),
});

export const POST = route(async (req, _ctx, user) => {
  const b = Body.parse(await req.json());
  if (!(await db.lead.findUnique({ where: { id: b.leadId }, select: { id: true } }))) return json({ error: "Lead not found" }, 404);
  const assignee = b.assignedUserId === undefined ? user.id : b.assignedUserId;
  if (assignee && !(await db.user.findUnique({ where: { id: assignee }, select: { id: true } }))) return json({ error: "Team member not found" }, 400);

  const task = await addFollowup({ leadId: b.leadId, title: b.title, dueAt: parseDay(b.dueAt), assignedUserId: assignee, actorId: user.id });
  return json(task, 201);
});
