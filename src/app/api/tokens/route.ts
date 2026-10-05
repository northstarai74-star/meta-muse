import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { createApiToken } from "@/lib/tokens";

export const GET = route(
  async () => json(await db.apiToken.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, label: true, hint: true, lastUsedAt: true, createdAt: true } })),
  { admin: true },
);

// The plaintext token is in this response only. It cannot be shown again.
export const POST = route(
  async (req) => {
    const { label } = z.object({ label: z.string().trim().min(1, "Give the token a label").max(60) }).parse(await req.json());
    return json(await createApiToken(label), 201);
  },
  { admin: true },
);
