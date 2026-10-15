import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { WEBSITE_FIELDS, getSite } from "@/lib/website";

const Body = z.object(Object.fromEntries(WEBSITE_FIELDS.map((f) => [f, z.string().max(2000).optional()])) as Record<string, z.ZodOptional<z.ZodString>>);

export const GET = route(async () => json(await getSite()));

// Only admins change the public website content.
export const PUT = route(
  async (req) => {
    const b = Body.parse(await req.json());
    await db.$transaction(
      Object.entries(b)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) =>
          db.setting.upsert({ where: { key: `site.${key}` }, create: { key: `site.${key}`, value: value! }, update: { value: value! } }),
        ),
    );
    return json(await getSite());
  },
  { admin: true },
);
