import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { parseDay } from "@/lib/followups";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const p = Patch.parse(await req.json());
  const before = await db.task.findUnique({ where: { id } });
  if (!before) return json({ error: "Not found" }, 404);

  const data = {
    ...(p.title !== undefined && { title: p.title }),
    ...(p.dueAt !== undefined && { dueAt: parseDay(p.dueAt) }),
    ...(p.done !== undefined && { done: p.done, doneAt: p.done ? new Date() : null }),
  };
  const task = await db.task.update({ where: { id }, data });
  if (p.done === true && !before.done) {
    await db.activity.create({ data: { leadId: before.leadId, userId: user.id, type: "TASK", text: `Follow-up done: ${before.title}` } });
  }
  return json(task);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.task.deleteMany({ where: { id } });
  return json({ ok: true });
});
