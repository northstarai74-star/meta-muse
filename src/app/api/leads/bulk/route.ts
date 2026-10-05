import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { pickAssignee } from "@/lib/ingest";
import { SERVICE_META } from "@/lib/constants";

const Body = z.object({
  ids: z.array(z.string()).min(1).max(500),
  service: z.enum(["AI_VOICE", "WEB_DEV", "DROPSHIPPING"]).optional(),
  assignedUserId: z.string().nullable().optional(),
  assignedAgent: z.enum(["AI", "HUMAN"]).optional(),
});

/** Bulk assign: choosing a service routes each lead using the assignment rule for that service. */
export const POST = route(async (req, _ctx, user) => {
  const b = Body.parse(await req.json());
  const data: Record<string, unknown> = {};
  if (b.service) {
    const a = await pickAssignee(b.service);
    Object.assign(data, { service: b.service, assignedAgent: a.agent, assignedUserId: a.userId });
  }
  if (b.assignedUserId !== undefined) data.assignedUserId = b.assignedUserId;
  if (b.assignedAgent) data.assignedAgent = b.assignedAgent;

  await db.lead.updateMany({ where: { id: { in: b.ids } }, data });
  if (b.service) await db.deal.updateMany({ where: { leadId: { in: b.ids } }, data: { service: b.service } });
  await db.activity.createMany({
    data: b.ids.map((leadId) => ({
      leadId,
      userId: user.id,
      type: "ASSIGNED",
      text: b.service ? `Bulk-assigned to ${SERVICE_META[b.service].label}` : "Bulk-updated assignment",
    })),
  });
  return json({ updated: b.ids.length });
});
