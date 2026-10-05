import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(
  async (_req, { params }, user) => {
    const { id } = await params;
    if (id === user.id) return json({ error: "You can't remove your own account" }, 400);
    const target = await db.user.findUnique({ where: { id }, select: { authId: true } });
    await db.user.delete({ where: { id } });
    // Without an app user row the account can no longer use the workspace; also remove the Supabase login itself.
    if (target?.authId) await createAdminClient().auth.admin.deleteUser(target.authId);
    return json({ ok: true });
  },
  { admin: true },
);
