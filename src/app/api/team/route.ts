import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const Body = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  title: z.string().optional(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

const COLORS = ["#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6"];

export const POST = route(
  async (req) => {
    const b = Body.parse(await req.json());
    const email = b.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) return json({ error: "That email is already in use" }, 409);
    const count = await db.user.count();
    const user = await db.user.create({
      data: { name: b.name, email, title: b.title || null, role: b.role, passwordHash: await bcrypt.hash(b.password, 10), avatarColor: COLORS[count % COLORS.length] },
      select: { id: true, name: true, email: true },
    });
    return json(user, 201);
  },
  { admin: true },
);
