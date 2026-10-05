import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const Body = z.object({
  service: z.enum(["AI_VOICE", "WEB_DEV", "DROPSHIPPING"]),
  agent: z.enum(["AI", "HUMAN"]),
  userId: z.string().nullable(),
});

/** Auto-assignment rule: where new leads of a service land by default. */
export const PUT = route(
  async (req) => {
    const b = Body.parse(await req.json());
    const rule = await db.assignmentRule.upsert({
      where: { service: b.service },
      create: b,
      update: { agent: b.agent, userId: b.userId },
    });
    return json(rule);
  },
  { admin: true },
);
