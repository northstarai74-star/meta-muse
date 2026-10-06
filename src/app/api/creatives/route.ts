import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { ASPECTS, submitImage } from "@/lib/higgsfield";

const Body = z.object({
  prompt: z.string().trim().min(3, "Describe the image you want").max(2000),
  aspect: z.enum(ASPECTS).default("1:1"),
});

/** Starts a Higgsfield image generation; the Studio page polls GET /api/creatives/[id] until it finishes. */
export const POST = route(async (req, _ctx, user) => {
  const { prompt, aspect } = Body.parse(await req.json());
  if ((await getSettings()).demoMode) return json({ error: "Turn off demo mode in Settings to generate with Higgsfield" }, 400);
  if (!(await db.apiKey.count({ where: { provider: "HIGGSFIELD", status: "ACTIVE" } }))) {
    return json({ error: "Add a Higgsfield key in Integrations first" }, 400);
  }

  let submitted;
  try {
    submitted = await submitImage(prompt, aspect);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Higgsfield request failed" }, 502);
  }
  const { job, keyId } = submitted;
  const creative = await db.creative.create({
    data: {
      prompt,
      aspect,
      requestId: job.request_id,
      apiKeyId: keyId,
      status: job.status ?? "queued",
      imageUrl: job.images?.[0]?.url ?? null,
      userId: user.id,
    },
  });
  return json(creative, 201);
});
