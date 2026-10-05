import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  label: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(99).optional(),
});

export const PATCH = route<Ctx>(
  async (req, { params }) => {
    const { id } = await params;
    const p = Patch.parse(await req.json());
    const k = await db.apiKey.update({ where: { id }, data: { ...p, ...(p.status === "ACTIVE" ? { lastError: null } : {}) } });
    return json({ id: k.id, status: k.status });
  },
  { admin: true },
);

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    await db.apiKey.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
