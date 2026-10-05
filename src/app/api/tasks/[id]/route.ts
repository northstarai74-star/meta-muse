import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { done } = z.object({ done: z.boolean() }).parse(await req.json());
  return json(await db.task.update({ where: { id }, data: { done, doneAt: done ? new Date() : null } }));
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await db.task.delete({ where: { id } });
  return json({ ok: true });
});
