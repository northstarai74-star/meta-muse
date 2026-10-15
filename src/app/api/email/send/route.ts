import { z } from "zod";
import { json, route } from "@/lib/api";
import { sendEmail } from "@/lib/providers";

const Body = z.object({
  to: z.array(z.string().email("Invalid recipient email")).min(1, "Add at least one recipient").max(50),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  text: z.string().trim().min(1, "Message is empty").max(20000),
});

export const POST = route(async (req) => {
  const b = Body.parse(await req.json());
  await sendEmail(b);
  return json({ ok: true, sent: b.to.length });
});
