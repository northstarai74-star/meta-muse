import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  title: z.string().trim().min(1, "Describe the follow-up").max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date"),
});

/** Adds a follow-up to a lead. Stored at noon UTC on the due date so the date reads the same in every timezone. */
export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const b = Body.parse(await req.json());
  const dueAt = new Date(`${b.dueDate}T12:00:00Z`);
  if (Number.isNaN(dueAt.getTime())) return json({ error: "Pick a valid due date" }, 400);
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) return json({ error: "Not found" }, 404);

  const [task] = await db.$transaction([
    db.task.create({ data: { leadId: id, title: b.title, dueAt } }),
    db.activity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text: `Follow-up set for ${b.dueDate}: ${b.title}` } }),
  ]);
  return json(task, 201);
});
