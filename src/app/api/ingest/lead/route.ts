import { z } from "zod";
import { json, tokenRoute } from "@/lib/api";
import { SERVICES, STAGES } from "@/lib/constants";
import { ingestProspect } from "@/lib/ingest";

const opt = z.string().trim().max(2000).optional();
const Body = z
  .object({
    name: opt,
    email: z.string().trim().email().optional(),
    phone: opt,
    company: opt,
    website: opt,
    industry: opt,
    country: opt,
    instagramHandle: opt,
    message: opt,
    source: z.enum(["API", "COLD_EMAIL", "IMPORT"]).default("API"),
    service: z.enum(SERVICES).optional(),
    stage: z.enum(STAGES).optional(),
  })
  .refine((b) => b.email || b.phone, { message: "Send an email or a phone number" });

/**
 * Adds one lead from an automation (n8n, a form, an email-reply workflow).
 * With `service` the lead is created as-is; without it Claude classifies `message`.
 * Returns 200 with status "duplicate" or "do_not_contact" instead of creating anything in those cases.
 */
export const POST = tokenRoute(async (req) => {
  const b = Body.parse(await req.json());
  const { source, service, stage, ...contact } = b;
  const r = await ingestProspect(contact, { source, service, stage });
  return json(r, r.status === "created" ? 201 : 200);
});
