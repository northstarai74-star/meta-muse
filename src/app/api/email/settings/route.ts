import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { getSender } from "@/lib/providers";

export const GET = route(async () => json((await getSender()) ?? { email: "", name: "" }));

const Body = z.object({ email: z.string().email("Enter a valid sender email"), name: z.string().trim().max(80).default("") });

// The sender must be a verified sender in Brevo, otherwise Brevo rejects the send.
export const PUT = route(
  async (req) => {
    const b = Body.parse(await req.json());
    await db.$transaction([
      db.setting.upsert({ where: { key: "email.senderEmail" }, create: { key: "email.senderEmail", value: b.email }, update: { value: b.email } }),
      db.setting.upsert({ where: { key: "email.senderName" }, create: { key: "email.senderName", value: b.name }, update: { value: b.name } }),
    ]);
    return json({ email: b.email, name: b.name });
  },
  { admin: true },
);
