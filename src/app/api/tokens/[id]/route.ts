import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    await db.apiToken.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
