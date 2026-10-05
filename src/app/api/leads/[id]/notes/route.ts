import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }, user) => {
  const { id } = await params;
  const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(await req.json());
  if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) return json({ error: "Not found" }, 404);
  const note = await db.activity.create({ data: { leadId: id, userId: user.id, type: "NOTE", text } });
  return json(note, 201);
});
