import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  title: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  // Admin reset: sets a new password without knowing the old one
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const PATCH = route<Ctx>(
  async (req, { params }, me) => {
    const { id } = await params;
    const b = Patch.parse(await req.json());
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return json({ error: "Team member not found" }, 404);

    if (b.role === "MEMBER" && target.role === "ADMIN") {
      if (id === me.id) return json({ error: "You can't remove your own admin role" }, 400);
      if ((await db.user.count({ where: { role: "ADMIN" } })) <= 1) return json({ error: "There must be at least one admin" }, 400);
    }
    const email = b.email?.toLowerCase();
    if (email && email !== target.email && (await db.user.findUnique({ where: { email } }))) {
      return json({ error: "That email is already in use" }, 409);
    }

    const user = await db.user.update({
      where: { id },
      data: {
        name: b.name,
        email,
        title: b.title === undefined ? undefined : b.title?.trim() || null,
        role: b.role,
        passwordHash: b.password ? await bcrypt.hash(b.password, 10) : undefined,
      },
      select: { id: true, name: true, email: true, title: true, role: true },
    });
    return json(user);
  },
  { admin: true },
);

export const DELETE = route<Ctx>(
  async (_req, { params }, user) => {
    const { id } = await params;
    if (id === user.id) return json({ error: "You can't remove your own account" }, 400);
    await db.user.delete({ where: { id } });
    return json({ ok: true });
  },
  { admin: true },
);
