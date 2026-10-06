import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/** Any signed-in user can change their own password (the current one is required). */
export const PUT = route(async (req, _ctx, me) => {
  const limited = await rateLimit(`password:${me.id}:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limited.ok) return json({ error: "Too many attempts. Try again later." }, 429);

  const { currentPassword, newPassword } = Body.parse(await req.json());
  const user = await db.user.findUnique({ where: { id: me.id } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return json({ error: "Current password is incorrect" }, 400);
  }
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  return json({ ok: true });
});
