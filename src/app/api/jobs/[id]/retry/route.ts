import { json, route } from "@/lib/api";
import { retryJob } from "@/lib/jobs";
import { kick } from "@/lib/worker";
import { after } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(
  async (_req, { params }) => {
    const { id } = await params;
    if (!(await retryJob(id))) return json({ error: "Only failed jobs can be retried" }, 409);
    after(kick);
    return json({ ok: true });
  },
  { admin: true },
);
