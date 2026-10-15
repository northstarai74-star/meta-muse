import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { upsertBrevoContact } from "@/lib/providers";

// Pushes CRM contacts that have an email address into Brevo. Capped per call to stay inside the function time limit.
export const maxDuration = 60;

export const POST = route(
  async () => {
    const contacts = await db.contact.findMany({ where: { email: { not: null } }, take: 200, orderBy: { createdAt: "desc" } });
    let synced = 0;
    const failed: string[] = [];
    for (const c of contacts) {
      try {
        await upsertBrevoContact({ email: c.email!, name: c.name });
        synced++;
      } catch (err) {
        failed.push(`${c.email}: ${err instanceof Error ? err.message : "error"}`);
        if (failed.length >= 5) break;
      }
    }
    return json({ synced, total: contacts.length, failed });
  },
  { admin: true },
);
