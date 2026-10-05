import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";

const Body = z.object({
  title: z.string().trim().min(1, "Give the reply a title").max(60),
  body: z.string().trim().min(1, "Write the reply text").max(1000),
});

export const GET = route(async () => json(await db.template.findMany({ orderBy: { createdAt: "asc" } })));

export const POST = route(async (req) => json(await db.template.create({ data: Body.parse(await req.json()) }), 201));
