import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(
  async (_req, { params }, user) => {
    const { id } = await params;
    if (id === user.id) return json({ error: "You can't remove your own account" }, 400);
    await db.user.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
